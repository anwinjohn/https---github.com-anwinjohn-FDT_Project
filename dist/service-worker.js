self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    const notificationTag = data.tag || `notification-${Date.now()}`;

    const options = {
      body: data.body || '',
      icon: data.icon || '/icon.png',
      badge: data.badge || '/badge.png',
      tag: notificationTag,
      requireInteraction: data.requireInteraction || false,
      sound: data.sound || '/notification-tone.wav',
      ...data.options,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );

    const broadcast = new BroadcastChannel('push-notifications');
    broadcast.postMessage({
      type: 'notification-shown',
      data: {
        title: data.title,
        body: data.body,
        tag: notificationTag,
        timestamp: Date.now(),
      },
    });
    broadcast.close();
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const broadcast = new BroadcastChannel('push-notifications');
  broadcast.postMessage({
    type: 'notification-clicked',
    data: {
      tag: event.notification.tag,
      timestamp: Date.now(),
    },
  });
  broadcast.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  const broadcast = new BroadcastChannel('push-notifications');
  broadcast.postMessage({
    type: 'notification-closed',
    data: {
      tag: event.notification.tag,
      timestamp: Date.now(),
    },
  });
  broadcast.close();
});
