import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyARS5Mzvp22Wt1qn8HFknlaAl83YHRPwyY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "odds-factory.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "odds-factory",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "odds-factory.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "461615555734",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:461615555734:web:09a6343d1a0ed953cdceb7",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-5ZEL06L9DR"
}

// Safely initialize Firebase app without throwing module evaluation errors
let firebaseApp
try {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
} catch (e) {
  console.warn('Firebase initialization error, retrying with fallback config:', e)
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

export const app = firebaseApp
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Initialize Messaging (conditionally because it requires browser support)
export const messaging = async () => {
  try {
    const supported = await isSupported()
    if (supported) {
      return getMessaging(app)
    }
  } catch (e) {
    console.warn('Firebase messaging not supported on this device/browser:', e)
  }
  return null
}
