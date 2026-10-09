// Push subscription background handler + client actions
// Served from public/sw.js to circumvent bundler compilation

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/**
 * Helper to fetch with the token from IndexedDB.
 * Since the user might interact with the notification when the app is closed,
 * we need to fetch the access_token from the same IndexedDB store used by authStore.ts.
 */
async function fetchWithAuth(url, options) {
  let token = null
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('smartreminder-db', 1)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    token = await new Promise((resolve, reject) => {
      const tx = db.transaction('auth', 'readonly')
      const req = tx.objectStore('auth').get('access_token')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    // ignore IDB errors
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // fallback to action_token if access_token not found in IDB (e.g., cleared)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else if (options.actionToken) {
    headers['Authorization'] = `Bearer ${options.actionToken}`
  }

  return fetch(url, { ...options, headers })
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    console.log('[SW] push received')
    const data = event.data.json()

    if (data.type === 'cancel') {
      // Close notifications matching the target tag
      event.waitUntil(
        self.registration.getNotifications({ tag: data.tag }).then((notifications) => {
          notifications.forEach((n) => n.close())
        })
      )
      return
    }

    if (data.type === 'test') {
      event.waitUntil(
        self.registration.showNotification(data.title || 'Donezo Test 🔔', {
          body: data.body || 'Push notifications are working correctly!',
          tag: data.tag || 'test-push',
          icon: '/icon-192.png',
          badge: '/badge-96.png',
          requireInteraction: false,
        })
      )
    }

    if (data.type === 'reminder') {
      const options = {
        body: `Due: ${new Date(data.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
        tag: data.tag,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        actions: [
          { action: 'done', title: '✓ Done' },
          { action: 'snooze', title: '⏰ Snooze 10m' },
        ],
        requireInteraction: false,
        data: { task_id: data.task_id, due_at: data.due_at, action_token: data.action_token },
      }

      event.waitUntil(
        self.registration.showNotification(data.title, options)
      )
    }

  } catch (err) {
    console.error('Error handling background push notification:', err)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  console.log('[SW] notificationclick', { action: event.action, data: event.notification.data })
  const { task_id, due_at, action_token } = event.notification.data || {}

  // Handle in-notification action buttons for reminders
  // Where the server is. The page registers this file as /sw.js?api=https://your-server,
  // so the Done / Snooze buttons work on any deployment. Without it, we use this site's own address.
  const apiBaseUrl = (new URL(self.location.href).searchParams.get('api') || self.location.origin).replace(/\/$/, '')

  if (event.action === 'done') {
    event.waitUntil(
      fetchWithAuth(`${apiBaseUrl}/tasks/${task_id}/action`, {
        method: 'POST',
        actionToken: action_token,
        body: JSON.stringify({
          action: 'done',
          client_timestamp: new Date().toISOString(),
        }),
      })
    )
  } else if (event.action === 'snooze') {
    event.waitUntil(
      fetchWithAuth(`${apiBaseUrl}/tasks/${task_id}/action`, {
        method: 'POST',
        actionToken: action_token,
        body: JSON.stringify({
          action: 'snooze',
          client_timestamp: new Date().toISOString(),
          snooze_minutes: 10,
        }),
      })
    )
  } else {
    // Clicking the notification body (not an action button): open that reminder's update page.
    const targetUrl = task_id
      ? `/update/${task_id}${due_at ? `?due=${encodeURIComponent(due_at)}` : ''}`
      : '/dashboard'

    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((c) => c.navigate(targetUrl))
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
    )
  }
})
