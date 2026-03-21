self.addEventListener('push', function(event) {});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.matchAll({ type: 'window' }).then(windowClients => {
        for (let i = 0; i < windowClients.length; i++) {
            let client = windowClients[i];
            if (client.url.indexOf('/') !== -1 && 'focus' in client) {
                return client.focus();
            }
        }
        if (clients.openWindow) {
            return clients.openWindow('/');
        }
    }));
});