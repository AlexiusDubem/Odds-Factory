import { getToken } from 'firebase/messaging'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { messaging, db, auth } from '../config/firebase'

const PUSH_TOKEN_KEY = 'odds_factory_fcm_token'

export function phoneAlertsAreEnabled(): boolean {
  return typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    Boolean(localStorage.getItem(PUSH_TOKEN_KEY))
}

export async function requestPhoneNotificationPermission(): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (!('Notification' in window)) {
      return { success: false, error: 'Push notifications are not supported on this browser.' }
    }

    if (!window.isSecureContext) {
      return { success: false, error: 'Phone alerts require the secure HTTPS version of Odds Factory.' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' }
    }

    const msgInstance = await messaging()
    if (!msgInstance) {
      return { success: false, error: 'Firebase messaging is not available on this device.' }
    }

    // Keep Firebase's worker out of the root scope. The root scope belongs to
    // the Vite PWA worker; two workers competing for it causes update/reload
    // loops on installed apps.
    let registration: ServiceWorkerRegistration | undefined
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('/firebase-push/firebase-messaging-sw.js', {
        scope: '/firebase-push/',
      })
    }

    const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      return { success: false, error: 'Phone alerts are not configured yet. Add the Firebase Web Push certificate before enabling alerts.' }
    }
    const token = await getToken(msgInstance, {
      serviceWorkerRegistration: registration,
      vapidKey,
    }).catch(err => {
      console.warn('FCM token registration failed:', err)
      return null
    })

    if (!token) {
      return { success: false, error: 'Firebase could not register this device for phone alerts. Please try again.' }
    }

    const finalToken = token
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
      await setDoc(doc(db, 'users', user.uid), {
        fcmToken: finalToken,
        fcmTokenUpdatedAt: serverTimestamp(),
      }, { merge: true })
      await setDoc(doc(db, 'users', user.uid, 'fcmTokens', finalToken), {
        token: finalToken,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }

    localStorage.setItem(PUSH_TOKEN_KEY, finalToken)

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

    // The server reads every saved device token with Admin credentials. Client
    // reads are deliberately avoided so a partial Firestore result can never
    // turn a broadcast into a partial phone delivery.
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) {
      return { success: false, recipientCount: 0, error: 'Please sign in again before sending phone alerts.' }
    }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }
    let pushRes = await fetch('/api/send-push', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, message, url, broadcastId })
    }).catch(() => null)
    const result = pushRes ? await pushRes.json().catch(() => null) : null
    if (!pushRes?.ok || !result?.success) {
      return { success: false, recipientCount: 0, error: result?.error || 'Phone alert could not be delivered.' }
    }
    return { success: true, recipientCount: result.broadcastedCount || 0 }
  } catch (err: any) {
    return { success: false, recipientCount: 0, error: err.message }
  }
}
