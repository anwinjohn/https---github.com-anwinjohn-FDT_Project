export interface LiveNotification {
  notification_id: string;
  title: string;
  message: string;
  notification_type?: string;
  created_at?: string;
  link?: string | null;
  meta?: Record<string, unknown> | null;
}

interface ServerMessage {
  type: string;
  notification?: LiveNotification;
  count?: number;
}

type NotificationListener = (notification: LiveNotification) => void;
type CountListener = (count: number) => void;

class NotificationRealtimeService {
  private socket: WebSocket | null = null;
  private notificationListeners = new Set<NotificationListener>();
  private countListeners = new Set<CountListener>();
  private reconnectTimer: number | null = null;
  private reconnectDelay = 5000;
  private closedByUs = false;
  private unread = 0;

  start(username: string): void {
    this.closedByUs = false;
    void username;
    this.connect();
  }

  stop(): void {
    this.closedByUs = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* already closed */
      }
      this.socket = null;
    }
    this.reconnectDelay = 5000;
  }

  onNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  onUnreadCount(listener: CountListener): () => void {
    this.countListeners.add(listener);
    return () => this.countListeners.delete(listener);
  }

  setUnread(count: number): void {
    this.unread = count;
    this.countListeners.forEach((listener) => listener(count));
  }

  getUnread(): number {
    return this.unread;
  }

  private connect(): void {
    const base = (window.__APP_CONFIG__?.api?.baseUrl ?? '') as string;
    if (this.socket || !base) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    const wsUrl = `${base.replace(/^http/, 'ws')}/ws/notifications?token=${encodeURIComponent(token)}`;
    try {
      this.socket = new WebSocket(wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectDelay = 5000;
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data)) as ServerMessage;
        if (msg.type === 'notification' && msg.notification) {
          this.notificationListeners.forEach((listener) =>
            listener(msg.notification!)
          );
        } else if (
          msg.type === 'unread_count' &&
          typeof msg.count === 'number'
        ) {
          this.setUnread(msg.count);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    this.socket.onerror = () => {
      /* onclose always follows an error; reconnect handled there */
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (!this.closedByUs) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUs || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 120000);
  }
}

export const notificationRealtime = new NotificationRealtimeService();
