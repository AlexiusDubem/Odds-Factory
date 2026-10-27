// Dedicated Firebase push worker. Its narrow scope deliberately avoids
// competing with the application PWA worker at `/`.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCP9RNmj5Wfr7UJXEKUIp5Yg8CSepzzks',
  authDomain: 'oddsfactory-betsai.firebaseapp.com',
  projectId: 'oddsfactory-betsai',
  storageBucket: 'oddsfactory-betsai.firebasestorage.app',
  messagingSenderId: '431503465290',
  appId: '1:431503465290:web:06a70c5d6be18a11c63fb3',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Odds Factory Alert'
  return self.registration.showNotification(title, {
    body: payload.notification?.body || payload.data?.message || 'New model-ranked picks are ready.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: payload.data?.url || payload.fcmOptions?.link || '/builder' },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/builder'
  event.waitUntil(clients.openWindow(targetUrl))
})
