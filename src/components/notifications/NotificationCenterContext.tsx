/**
 * Notification center: owns the persisted in-app notification list, the
 * unread badge, the realtime socket, and push registration.
 *
 * Performance notes:
 *  - One WebSocket for live delivery; no timers, no polling loops.
 *  - Initial load fetches list + unread count once per login.
 *  - The Push API wakes the page via the service worker, so nothing runs in
 *    the background when the tab is closed.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications as useToasts } from './NotificationContext';
import {
  AppNotification,
  NotificationType,
  notificationService,
} from '../../services/notificationService';
import { pushService, PushPermissionState } from '../../services/pushService';
import {
  LiveNotification,
  notificationRealtime,
} from '../../utils/notificationRealtime';

// Safety net for socket outages: one tiny unread-count call per interval, and
// a full refresh only when the count actually changed. Throttled so a hidden
// or background tab never generates meaningful traffic.
const SAFETY_NET_POLL_MS = 60000;
const VISIBILITY_REFRESH_MIN_MS = 30000;

interface NotificationCenterContextValue {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  permission: PushPermissionState;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationCenterContext = createContext<
  NotificationCenterContextValue | undefined
>(undefined);

const mapType = (raw?: string | null): NotificationType => {
  const t = (raw || '').toLowerCase();
  if (t.includes('alert')) return 'alert';
  if (t.includes('success') || t.includes('resolv')) return 'success';
  if (t.includes('warn')) return 'warning';
  if (t.includes('system')) return 'system';
  return 'info';
};

/**
 * Shows the OS-level notification (visible over other tabs and a minimized
 * window) for a live notification that arrived while the tab is hidden.
 * The tag matches the service worker's push tag, so if Web Push delivered
 * the same notification the two never duplicate.
 */
async function showOsNotificationWhenHidden(
  notification: AppNotification
): Promise<void> {
  if (document.visibilityState === 'visible') return;
  if (pushService.getState() !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) return;
    await registration.showNotification(notification.title, {
      body: notification.message,
      icon: '/ARIE_Logo.png',
      badge: '/ARIE_Logo.png',
      tag: notification.notification_id,
      data: {
        link: notification.link,
        notification_id: notification.notification_id,
      },
    });
  } catch {
    /* OS notification is best-effort */
  }
}

export const NotificationCenterProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const toast = useToasts();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushPermissionState>(() =>
    pushService.getState()
  );
  const username = user?.username ?? null;
  const seenIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  const recalcUnread = useCallback((list: AppNotification[]) => {
    setUnreadCount(list.reduce((n, item) => (item.is_read ? n : n + 1), 0));
  }, []);

  const refresh = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        notificationService.list(username),
        notificationService.unreadCount(username),
      ]);
      list.forEach((n) => seenIdsRef.current.add(n.notification_id));
      setItems(list);
      setUnreadCount(count);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications'
      );
    } finally {
      setLoading(false);
    }
  }, [username]);

  const handleIncoming = useCallback(
    (live: LiveNotification) => {
      const id = live.notification_id || `live-${Date.now()}`;
      if (seenIdsRef.current.has(id)) return;
      seenIdsRef.current.add(id);
      const mapped: AppNotification = {
        notification_id: id,
        user_id: username ?? '',
        type: mapType(live.notification_type),
        title: live.title,
        message: live.message,
        is_read: false,
        created_at: live.created_at || new Date().toISOString(),
        link: live.link ?? null,
        meta: live.meta ?? null,
      };
      setItems((prev) => [mapped, ...prev].slice(0, 100));
      setUnreadCount((c) => c + 1);
      toast.addNotification(
        live.message,
        mapType(live.notification_type) as 'info',
        8000,
        live.title
      );
      void showOsNotificationWhenHidden(mapped);
    },
    [toast, username]
  );

  // Bootstrap once per signed-in user.
  useEffect(() => {
    if (!isAuthenticated || !username) {
      bootstrappedRef.current = false;
      setItems([]);
      setUnreadCount(0);
      seenIdsRef.current = new Set();
      return;
    }
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void refresh();
    pushService
      .init(username)
      .then(() => setPermission(pushService.getState()))
      .catch(() => setPermission(pushService.getState()));
  }, [isAuthenticated, username, refresh]);

  // Safety net: while the socket is down, poll the tiny unread-count endpoint
  // and escalate to a full refresh only when the count changed. Also refresh
  // (throttled) when the tab becomes visible again.
  useEffect(() => {
    if (!isAuthenticated || !username) return;

    let lastCount = notificationRealtime.getUnread();
    let lastVisibilityRefresh = 0;

    const pollTimer = window.setInterval(async () => {
      if (notificationRealtime.isConnected()) return;
      const count = await notificationService.unreadCount(username);
      if (count !== lastCount) {
        lastCount = count;
        void refresh();
      }
    }, SAFETY_NET_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibilityRefresh < VISIBILITY_REFRESH_MIN_MS) return;
      lastVisibilityRefresh = now;
      void refresh();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, username, refresh]);

  // Live socket + service-worker bridge.
  useEffect(() => {
    if (!isAuthenticated) return;
    notificationRealtime.start(username ?? '');
    const offNotification = notificationRealtime.onNotification(handleIncoming);
    const offCount = notificationRealtime.onUnreadCount(setUnreadCount);
    // After any reconnect the server may have queued notifications we missed;
    // one catch-up fetch makes the list authoritative again.
    const offReconnected = notificationRealtime.onReconnected(() => {
      void refresh();
    });

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED' && event.data.notification) {
        handleIncoming(event.data.notification as LiveNotification);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      offNotification();
      offCount();
      offReconnected();
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      notificationRealtime.stop();
    };
  }, [isAuthenticated, username, handleIncoming, refresh]);

  const enablePush = useCallback(async () => {
    if (!username) return;
    const result = await pushService.enableFromUserGesture(username);
    setPermission(result.state);
    if (result.ok) {
      toast.addNotification(
        'Push notifications enabled for this device',
        'success'
      );
    } else if (result.error) {
      toast.addNotification(result.error, 'warning');
    }
  }, [username, toast]);

  const disablePush = useCallback(async () => {
    if (!username) return;
    await pushService.disable(username);
    toast.addNotification(
      'Push notifications turned off for this device',
      'info'
    );
  }, [username, toast]);

  const markRead = useCallback(
    async (id: string) => {
      if (!username) return;
      setItems((prev) =>
        prev.map((n) =>
          n.notification_id === id ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await notificationService.markRead(username, [id]);
      } catch {
        toast.addNotification('Could not update notification', 'error');
      }
    },
    [username, toast]
  );

  const markAllRead = useCallback(async () => {
    if (!username) return;
    const ids = items.filter((n) => !n.is_read).map((n) => n.notification_id);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationService.markRead(username, ids);
    } catch {
      toast.addNotification('Could not update notifications', 'error');
    }
  }, [items, username, toast]);

  const remove = useCallback(
    async (id: string) => {
      if (!username) return;
      const wasUnread = items.find(
        (n) => n.notification_id === id && !n.is_read
      );
      setItems((prev) => prev.filter((n) => n.notification_id !== id));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await notificationService.delete(username, id);
      } catch {
        toast.addNotification('Could not delete notification', 'error');
      }
    },
    [items, username, toast]
  );

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      error,
      permission,
      enablePush,
      disablePush,
      markRead,
      markAllRead,
      remove,
      refresh,
    }),
    [
      items,
      unreadCount,
      loading,
      error,
      permission,
      enablePush,
      disablePush,
      markRead,
      markAllRead,
      remove,
      refresh,
    ]
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  );
};

export const useNotificationCenter = (): NotificationCenterContextValue => {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) {
    throw new Error(
      'useNotificationCenter must be used within NotificationCenterProvider'
    );
  }
  return ctx;
};
