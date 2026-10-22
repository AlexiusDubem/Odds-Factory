import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY
export const isFirebaseConfigured = Boolean(
  rawApiKey && rawApiKey.trim() !== '' && !rawApiKey.includes('your_api_key')
)

// Fallback configuration prevents Firebase from throwing auth/invalid-api-key synchronously during import
const firebaseConfig = {
  apiKey: isFirebaseConfigured ? rawApiKey : 'AIzaSyDummyKeyForDevModePreview123456',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'odds-factory-dev.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'odds-factory-dev',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'odds-factory-dev.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
}

if (!isFirebaseConfigured) {
  console.info('ℹ️ [Firebase] Running in Dev/Preview Mode. Guest session enabled.')
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
