import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import type { Slip } from './types'
import { sampleMatches } from './data/sampleMatches'
import { SlipEditorPanel } from './components/SlipEditorPanel'
import { SavedSlipsPanel } from './components/SavedSlipsPanel'
import { DashboardPanel } from './components/DashboardPanel'
import { ProfilePanel } from './components/ProfilePanel'
import { LoginPanel } from './components/LoginPanel'
import { auth, db, messaging } from './config/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { getToken } from 'firebase/messaging'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-line' },
  { path: '/audit', label: 'Audit Slip', icon: 'fa-solid fa-wand-magic-sparkles' },
  { path: '/history', label: 'History', icon: 'fa-solid fa-clock-rotate-left' },
  { path: '/profile', label: 'Profile', icon: 'fa-solid fa-user' },
]

function App() {
  const [slips, setSlips] = useState<Slip[]>([])
  const [showSplash, setShowSplash] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [authInitialized, setAuthInitialized] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setAuthInitialized(true)
      
      if (currentUser) {
        try {
          const m = await messaging()
          if (m) {
            const token = await getToken(m, { vapidKey: 'BOGUS_VAPID_KEY_REPLACE_LATER' }).catch(() => null)
            if (token) {
              await setDoc(doc(db, 'users', currentUser.uid), {
                fcmToken: token,
                lastLogin: serverTimestamp()
              }, { merge: true })
            }
          }
        } catch (err) {
          console.log('FCM Setup Error:', err)
        }
      }
    })
    const t = setTimeout(() => setShowSplash(false), 2000)
    return () => {
      clearTimeout(t)
      unsubscribe()
    }
  }, [])

  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
           <img src="/logo.png" className="w-[150vw] h-auto object-cover blur-sm" alt="" />
        </div>
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
           <img src="/logo.png" className="w-24 h-24 object-contain animate-pulse mb-6 drop-shadow-2xl bg-white rounded-2xl p-2" alt="Odds Factory" />
           <h1 className="text-2xl sm:text-3xl font-black text-white tracking-[0.2em] uppercase font-sans mb-2">Odds Factory</h1>
           <p className="text-accent text-xs sm:text-sm font-bold tracking-widest uppercase">Initializing Intelligence...</p>
        </div>
      </div>
    )
  }
  if (!authInitialized) {
    return null // wait for auth state to resolve
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100/50">
        <LoginPanel />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface-elevated/90 backdrop-blur sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="Odds Factory" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Odds Factory</h1>
                <p className="text-xs text-slate-500">
                  AI Betting Intelligence Platform
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-xs hidden sm:inline-block">
                {user.email}
              </span>
              <button 
                onClick={() => signOut(auth)} 
                className="hover:text-red-500 transition-colors flex items-center gap-1.5 font-medium"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="hidden sm:block border-b border-border bg-surface sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-surface-hover'
                }`}
              >
                <i className={link.icon}></i>
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-24 sm:pb-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPanel />} />
          <Route 
            path="/audit" 
            element={
              <SlipEditorPanel
                matches={sampleMatches}
                slips={slips}
                setSlips={setSlips}
                onSlipUpdated={(slip) => setSlips((prev) => prev.map((s) => (s.id === slip.id ? slip : s)))}
              />
            } 
          />
          <Route 
            path="/history" 
            element={
              <SavedSlipsPanel 
                onLoadSlip={(slip) => {
                  setSlips([slip])
                }} 
              />
            } 
          />
          <Route path="/profile" element={<ProfilePanel />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-2 py-2 z-50 flex justify-around items-center" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) => `flex flex-col items-center justify-center w-full py-1.5 rounded-xl transition-colors ${
              isActive
                ? 'text-accent'
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <i className={`${link.icon} text-xl mb-1`}></i>
            <span className="text-[10px] font-bold tracking-wide">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="hidden sm:block border-t border-border py-4 text-center text-xs text-slate-500 bg-surface">
        Odds Factory v2 — AI audits your betting slip before you place it.
      </footer>
    </div>
  )
}

export default App
