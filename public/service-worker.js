/* Push + notification-click handling for the FDT dashboard.
 * Scope: delivered via push events; all data comes from the server payload.
 */

/* eslint-disable no-restricted-globals */
const FALLBACK_ICON = '/ARIE_Logo.png';

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = { title: 'Notification', body: event.data.text() };
  }

  const data = payload || {};
  const title = data.title || 'Fraud Detection Tool';
  const tag = data.tag || data.notification_id || `push-${Date.now()}`;

  const options = {
    body: data.body || data.message || '',
    icon: data.icon || FALLBACK_ICON,
    badge: data.badge || FALLBACK_ICON,
    tag,
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.require_interaction),
    data: {
      link: data.link || null,
      notification_id: data.notification_id || null,
      tag,
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      // Tell any open app window so the in-app list refreshes without a poll.
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clientList.forEach((client) => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          notification: {
            notification_id: data.notification_id || tag,
            title,
            message: options.body,
            notification_type: data.notification_type || 'info',
            created_at: data.created_at || new Date().toISOString(),
            link: data.link || null,
          },
        });
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.link) || '/dashboard';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appClient = clientList.find((c) => 'focus' in c);
      if (appClient) {
        await appClient.focus();
        appClient.postMessage({
          type: 'NOTIFICATION_CLICKED',
          link: target,
          notification_id: event.notification.data?.notification_id || null,
        });
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
