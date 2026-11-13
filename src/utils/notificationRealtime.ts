/**
 * Live notification transport: one lightweight WebSocket for the whole app.
 *
 * Protocol (matches server/notifications.py):
 *   client -> server: {"type":"ping"}            keepalive, every HEARTBEAT_MS
 *   client -> server: {"type":"sync"}            on connect / reconnect
 *   server -> client: {"type":"pong"}
 *   server -> client: {"type":"unread_count","count":n}
 *   server -> client: {"type":"notification","notification":{...}}
 *
 * The socket carries only tiny control frames and new-notification pushes;
 * list/count state lives in NotificationCenterContext, which listens for
 * `onConnected` to run a single catch-up refresh after any disconnect.
 */
export interface LiveNotification {
  notification_id: string;
  title: string;
  message: string;
  notification_type?: string;
  created_at?: string;
  link?: string | null;
  meta?: Record<string, unknown> | null;
}

type NotificationListener = (notification: LiveNotification) => void;
type CountListener = (count: number) => void;
type ConnectedListener = () => void;

const HEARTBEAT_MS = 30000;
const HEARTBEAT_GRACE_MS = 10000;
const INITIAL_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

/** Backend socket route (server-side route: app.websocket("/ws/notifications")). */
const WS_PATH = '/notifications/ws';

class NotificationRealtimeService {
  private socket: WebSocket | null = null;
  private notificationListeners = new Set<NotificationListener>();
  private countListeners = new Set<CountListener>();
  private connectedListeners = new Set<ConnectedListener>();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private staleTimer: number | null = null;
  private reconnectDelay = INITIAL_RECONNECT_MS;
  private closedByUs = false;
  private username = '';
  private unread = 0;
  /** Set once the current connection proves it answers pings. */
  private pongSeen = false;

  start(username: string): void {
    this.username = username;
    this.closedByUs = false;
    if (!this.socket) this.connect();
  }

  stop(): void {
    this.closedByUs = true;
    this.clearTimers();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* already closed */
      }
      this.socket = null;
    }
    this.reconnectDelay = INITIAL_RECONNECT_MS;
  }

  onNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  onUnreadCount(listener: CountListener): () => void {
    this.countListeners.add(listener);
    return () => this.countListeners.delete(listener);
  }

  /** Fires every time the socket completes a reconnect (not on first open). */
  onReconnected(listener: ConnectedListener): () => void {
    this.connectedListeners.add(listener);
    return () => this.connectedListeners.delete(listener);
  }

  setUnread(count: number): void {
    this.unread = count;
    this.countListeners.forEach((listener) => listener(count));
  }

  getUnread(): number {
    return this.unread;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private connect(): void {
    if (this.socket || this.closedByUs) return;

    const base = (window.__APP_CONFIG__?.api?.baseUrl ?? '') as string;
    if (!base) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    const wsUrl = `${base.replace(/^http/, 'ws')}${WS_PATH}?token=${encodeURIComponent(token)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.pongSeen = false;
    const wasReconnect = this.reconnectDelay !== INITIAL_RECONNECT_MS;

    socket.onopen = () => {
      this.reconnectDelay = INITIAL_RECONNECT_MS;
      this.send({ type: 'sync' });
      this.startHeartbeat();
      if (wasReconnect) {
        this.connectedListeners.forEach((listener) => listener());
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      this.markAlive();
      try {
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (msg.type === 'pong') {
          this.pongSeen = true;
        } else if (msg.type === 'notification' && msg.notification) {
          this.dispatch(msg.notification as LiveNotification);
        } else if (
          msg.type === 'unread_count' &&
          typeof msg.count === 'number'
        ) {
          this.setUnread(msg.count);
        } else if (
          typeof msg.notification_id === 'string' &&
          typeof msg.title === 'string'
        ) {
          // Some backends stream the raw notification object without a
          // "notification" envelope; accept that shape too.
          this.dispatch(msg as unknown as LiveNotification);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    socket.onerror = () => {
      /* onclose always follows an error; reconnect handled there */
    };

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.stopHeartbeat();
      if (!this.closedByUs) this.scheduleReconnect();
    };
  }

  private dispatch(notification: LiveNotification): void {
    this.notificationListeners.forEach((listener) => listener(notification));
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(payload));
      } catch {
        /* connection is dying; onclose will handle the reconnect */
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: 'ping' });
      // Only servers that actually answer pings are held to the grace window.
      // Legacy/polling backends never reply, and killing those connections
      // would just churn reconnects every heartbeat.
      if (!this.pongSeen) return;
      this.staleTimer = window.setTimeout(() => {
        try {
          this.socket?.close();
        } catch {
          /* nothing to close */
        }
      }, HEARTBEAT_GRACE_MS);
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearStaleTimer();
  }

  private markAlive(): void {
    this.clearStaleTimer();
  }

  private clearStaleTimer(): void {
    if (this.staleTimer !== null) {
      window.clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUs || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
  }
}

export const notificationRealtime = new NotificationRealtimeService();
