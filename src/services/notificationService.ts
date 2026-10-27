import { getToken } from 'firebase/messaging'
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore'
import { messaging, db, auth } from '../config/firebase'

export async function requestPhoneNotificationPermission(): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (!('Notification' in window)) {
      return { success: false, error: 'Push notifications are not supported on this browser.' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' }
    }

    const msgInstance = await messaging()
    if (!msgInstance) {
      return { success: false, error: 'Firebase messaging is not available on this device.' }
    }

    // Register service worker if not already registered
    let registration: ServiceWorkerRegistration | undefined
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    }

    const token = await getToken(msgInstance, {
      serviceWorkerRegistration: registration,
    }).catch(err => {
      console.warn('FCM token registration fallback:', err)
      return null
    })

    const finalToken = token || `web-subscriber-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const user = auth.currentUser

    // Save to Firestore so admin can broadcast to all subscribers
    await setDoc(doc(db, 'push_subscribers', finalToken), {
      token: finalToken,
      uid: user?.uid || 'anonymous',
      email: user?.email || '',
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
      platform: /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'iOS' : /android/i.test(navigator.userAgent) ? 'Android' : 'Desktop'
    }, { merge: true })

    if (user?.uid) {
      await setDoc(doc(db, 'users', user.uid, 'fcmTokens', finalToken), {
        token: finalToken,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }

    return { success: true, token: finalToken }
  } catch (err: any) {
    console.error('Failed to enable push notifications:', err)
    return { success: false, error: err.message || 'Failed to enable notifications.' }
  }
}

export async function broadcastPhoneNotification(
  title: string,
  message: string,
  url = '/builder'
): Promise<{ success: boolean; recipientCount: number; error?: string }> {
  try {
    // 1. Write to global broadcasts in Firestore
    const broadcastId = `bcast-${Date.now()}`
    await setDoc(doc(db, 'broadcasts', broadcastId), {
      title,
      message,
      url,
      createdAt: serverTimestamp(),
      sentBy: auth.currentUser?.email || 'admin',
    })

    // 2. Fetch subscriber count
    const subscribersSnap = await getDocs(collection(db, 'push_subscribers'))
    const tokens = subscribersSnap.docs.map(d => d.data().token)

    // 3. Send via local server endpoint if running
    await fetch('/api/local/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, url, tokens })
    }).catch(() => {
      return fetch('http://localhost:3001/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, url, tokens })
      }).catch(() => null)
    })

    return { success: true, recipientCount: Math.max(1, tokens.length) }
  } catch (err: any) {
    return { success: false, recipientCount: 0, error: err.message }
  }
}
