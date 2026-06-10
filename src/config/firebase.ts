import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  projectId: "odds-factory",
  appId: "1:461615555734:web:09a6343d1a0ed953cdceb7",
  storageBucket: "odds-factory.firebasestorage.app",
  apiKey: "AIzaSyARS5Mzvp22Wt1qn8HFknlaAl83YHRPwyY",
  authDomain: "odds-factory.firebaseapp.com",
  messagingSenderId: "461615555734",
  measurementId: "G-5ZEL06L9DR"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Initialize Messaging (conditionally because it requires browser support)
export const messaging = async () => {
  const supported = await isSupported()
  if (supported) {
    return getMessaging(app)
  }
  return null
}
