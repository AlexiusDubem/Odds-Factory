import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCP9RNmj5Wfrv7UJXEKUIp5Yg8CSepzzks'
export const isFirebaseConfigured = Boolean(
  rawApiKey && rawApiKey.trim() !== '' && !rawApiKey.includes('your_api_key')
)

const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'oddsfactory-betsai.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'oddsfactory-betsai',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'oddsfactory-betsai.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '431503465290',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:431503465290:web:06a70c5d6be18a11c63fb3',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-2FBDYZLMY8',
}

let firebaseApp
try {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
} catch (e) {
  console.warn('Firebase initialization error, retrying:', e)
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

export const app = firebaseApp
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

export const messaging = async () => {
  try {
    if (!isFirebaseConfigured) return null
    const supported = await isSupported()
    if (supported) {
      return getMessaging(app)
    }
  } catch (e) {
    console.warn('Firebase messaging not supported on this device/browser:', e)
  }
  return null
}
