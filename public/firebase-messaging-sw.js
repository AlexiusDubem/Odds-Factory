// Odds Factory — Background Push Notification Service Worker
// Enables native system push notifications on Android & iOS lockscreens and notification centers

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyCP9RNmj5Wfrv7UJXEKUIp5Yg8CSepzzks",
  authDomain: "oddsfactory-betsai.firebaseapp.com",
  projectId: "oddsfactory-betsai",
  storageBucket: "oddsfactory-betsai.firebasestorage.app",
  messagingSenderId: "431503465290",
  appId: "1:431503465290:web:06a70c5d6be18a11c63fb3",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload)

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Odds Factory Alert'
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || 'New model-ranked picks are ready.',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/builder'
    },
    actions: [
      { action: 'open_app', title: 'Open Odds Factory' }
    ]
  }

  return self.registration.showNotification(notificationTitle, notificationOptions)
})

// Native Web Push Event Fallback
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json()
      const title = data.title || data.notification?.title || 'Odds Factory Alert'
      const options = {
        body: data.message || data.body || data.notification?.body || 'New model-ranked picks are ready.',
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/builder'
        }
      }
      event.waitUntil(self.registration.showNotification(title, options))
    } catch {
      const text = event.data.text()
      event.waitUntil(
        self.registration.showNotification('Odds Factory Alert', {
          body: text,
          icon: '/logo.png',
          badge: '/logo.png'
        })
      )
    }
  }
})

// When user taps the native phone notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/builder'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
