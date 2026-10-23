import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import type { Slip } from './types'
import { sampleMatches } from './data/sampleMatches'
import { LoginPanel } from './components/LoginPanel'
import { NotificationCenter } from './components/NotificationCenter'
import { SlipEditorPanel } from './components/SlipEditorPanel'
import { SavedSlipsPanel } from './components/SavedSlipsPanel'
import { DashboardPanel } from './components/DashboardPanel'
import { ProfilePanel } from './components/ProfilePanel'
import { ControlPanel } from './components/ControlPanel'
import { AccaBuilderPanel } from './components/AccaBuilderPanel'
import { auth, db, messaging, isFirebaseConfigured } from './config/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { getToken } from 'firebase/messaging'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { UpdatePrompt } from './components/UpdatePrompt'

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-line' },
  { path: '/builder', label: 'Sure Picks', icon: 'fa-solid fa-star' },
  { path: '/audit', label: 'Audit Slip', icon: 'fa-solid fa-wand-magic-sparkles' },
  { path: '/history', label: 'History', icon: 'fa-solid fa-clock-rotate-left' },
  { path: '/profile', label: 'Profile', icon: 'fa-solid fa-user' },
]

function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [slips, setSlips] = useState<Slip[]>([])

  const handleSendToAudit = (newSlip: Slip) => {
    setSlips((prev) => [newSlip, ...prev.filter((s) => s.id !== newSlip.id)])
    navigate('/audit')
  }

  useEffect(() => {
    // If Firebase credentials are not set, auto-login as preview guest
    if (!isFirebaseConfigured) {
      setUser({
        uid: 'guest-local-user',
        email: 'preview@oddsfactory.local',
        displayName: 'Guest Previewer',
      } as any)
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setLoading(false)

      if (currentUser) {
        // Request Web Push token and save to DB
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const m = await messaging()
            if (m) {
              const token = await getToken(m, { 
                vapidKey: 'YOUR_PUBLIC_VAPID_KEY_HERE' // Optional, if using web push certs
              })
              if (token) {
                await setDoc(doc(db, 'users', currentUser.uid, 'fcmTokens', token), {
                  token,
                  createdAt: serverTimestamp(),
                  device: navigator.userAgent
                }, { merge: true })
              }
            }
          }
        } catch (err) {
          console.error('FCM Token error:', err)
        }
      }
    })
    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-accent"></i>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <LoginPanel onContinueAsGuest={() => setUser({ uid: 'guest-user', email: 'guest@oddsfactory.local', displayName: 'Guest' } as any)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-black text-xs shadow-xs">
                OF
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black text-zinc-950 tracking-tight">Odds Factory</h1>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full hidden sm:inline-block">
                    ● Live Engine
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 font-medium leading-none mt-0.5">
                  AI Betting Intelligence Platform
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span className="font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200/60 px-3 py-1 rounded-full text-xs hidden sm:inline-block">
                {user.email}
              </span>
              <NotificationCenter />
              <button 
                onClick={() => { if (isFirebaseConfigured) { signOut(auth) } else { setUser(null) } }} 
                className="hover:text-rose-600 transition-colors flex items-center gap-1.5 font-bold text-xs bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="hidden sm:block border-b border-zinc-200/80 bg-[#FAFAFA] sticky top-[61px] z-40">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-zinc-200/60 p-1 rounded-2xl inline-flex gap-1 overflow-x-auto">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-500 hover:text-zinc-950 hover:bg-white/50'
                }`}
              >
                <i className={`${link.icon} text-xs`}></i>
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
          <Route path="/builder" element={<AccaBuilderPanel onSendToAudit={handleSendToAudit} />} />
          <Route path="/audit" element={
            <SlipEditorPanel
              matches={sampleMatches}
              slips={slips}
              setSlips={setSlips}
              onSlipUpdated={(slip) => setSlips((prev) => prev.map((s) => (s.id === slip.id ? slip : s)))}
            />
          } />
          <Route path="/history" element={
            <SavedSlipsPanel 
              onLoadSlip={(slip) => {
                setSlips([slip])
              }} 
            />
          } />
          <Route path="/profile" element={<ProfilePanel />} />
          <Route path="/control" element={<ControlPanel />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-3 inset-x-3 bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl shadow-lg px-2 py-1.5 z-50 flex justify-around items-center" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              isActive
                ? 'text-zinc-950 font-black'
                : 'text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <i className={`${link.icon} text-base mb-0.5`}></i>
            <span className="text-[9px] font-bold tracking-tight">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="hidden sm:block border-t border-border py-4 text-center text-xs text-slate-500 bg-surface">
        Odds Factory v2 — AI audits your betting slip before you place it.
      </footer>

      <UpdatePrompt />
    </div>
  )
}

export default App
