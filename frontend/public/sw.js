// Push subscription background handler.
// Served from public/sw.js to circumvent bundler compilation.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()

    if (data.type === 'reminder') {
      event.waitUntil(
        self.registration.showNotification(data.title || 'SmartReminder', {
          body: data.body,
          tag: data.tag,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          requireInteraction: false,
          data: { reminder_id: data.reminder_id },
        })
      )
    }
  } catch (err) {
    console.error('Error handling background push notification:', err)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((c) => c.navigate('/dashboard'))
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/dashboard')
      }
    })
  )
})
