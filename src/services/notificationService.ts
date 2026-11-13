/**
 * Notification API service — routes every call through the shared apiClient
 * (no direct DB access from the browser).
 *
 * Backend contract (server/notifications.py, mounted at /notifications):
 *   POST /notifications/list            {username, unread_only?, limit?} -> [NotificationRecord]
 *   POST /notifications/unread-count    {username}                       -> {count}
 *   POST /notifications/mark-read       {username, notification_ids?}    -> {success}
 *   POST /notifications/delete          {username, notification_id}      -> {success}
 *   POST /notifications/subscribe       {browser push subscription, machine_info?}
 *   POST /notifications/unsubscribe     {username, endpoint}
 *   GET  /notifications/vapid-public-key                                 -> {public_key}
 */
import apiClient from '../utils/apiClient';

export interface AppNotification {
  notification_id: string;
  user_id: string;
  type: 'alert' | 'system' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  /** Optional deep link inside the SPA, e.g. "alerts/ALR-123" */
  link?: string | null;
  meta?: Record<string, unknown> | null;
}

export type NotificationType = AppNotification['type'];

const extractList = (payload: unknown): AppNotification[] => {
  if (Array.isArray(payload)) return payload as AppNotification[];
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.notifications)) return obj.notifications as AppNotification[];
  if (Array.isArray(obj.data)) return obj.data as AppNotification[];
  return [];
};

const extractCount = (payload: unknown): number => {
  if (typeof payload === 'number') return payload;
  if (!payload || typeof payload !== 'object') return 0;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.count === 'number') return obj.count;
  if (obj.data && typeof (obj.data as Record<string, unknown>).count === 'number') {
    return (obj.data as { count: number }).count;
  }
  return 0;
};

export const notificationService = {
  async list(username: string, unreadOnly = false, limit = 50): Promise<AppNotification[]> {
    const res = await apiClient.post<unknown>('notifications/list', {
      username,
      unread_only: unreadOnly,
      limit,
    });
    if (!res.success) throw new Error(res.error || 'Failed to load notifications');
    return extractList(res.data);
  },

  async unreadCount(username: string): Promise<number> {
    const res = await apiClient.post<unknown>('notifications/unread-count', { username });
    if (!res.success) return 0;
    return extractCount(res.data);
  },

  async markRead(username: string, notificationIds?: string[]): Promise<void> {
    const res = await apiClient.post('notifications/mark-read', {
      username,
      notification_ids: notificationIds ?? null,
    });
    if (!res.success) throw new Error(res.error || 'Failed to update notification');
  },

  async delete(username: string, notificationId: string): Promise<void> {
    const res = await apiClient.post('notifications/delete', {
      username,
      notification_id: notificationId,
    });
    if (!res.success) throw new Error(res.error || 'Failed to delete notification');
  },

  async subscribe(
    username: string,
    subscription: unknown,
    machineInfo?: unknown
  ): Promise<void> {
    const res = await apiClient.post('notifications/subscribe', {
      username,
      subscription,
      machine_info: machineInfo ?? null,
    });
    if (!res.success) throw new Error(res.error || 'Failed to enable push notifications');
  },

  async unsubscribe(username: string, endpoint: string): Promise<void> {
    const res = await apiClient.post('notifications/unsubscribe', { username, endpoint });
    if (!res.success) throw new Error(res.error || 'Failed to disable push notifications');
  },

  async getVapidPublicKey(): Promise<string | null> {
    const res = await apiClient.get<{ public_key?: string }>('notifications/vapid-public-key');
    if (!res.success || !res.data?.public_key) return null;
    return res.data.public_key;
  },
};
