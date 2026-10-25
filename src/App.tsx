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
import { doc, setDoc, serverTimestamp, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { UpdatePrompt } from './components/UpdatePrompt'

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-line' },
  { path: '/builder', label: 'Sure Picks', icon: 'fa-solid fa-star' },
  { path: '/audit', label: 'Audit Slip', icon: 'fa-solid fa-wand-magic-sparkles' },
  { path: '/history', label: 'History', icon: 'fa-solid fa-clock-rotate-left' },
  { path: '/profile', label: 'Profile', icon: 'fa-solid fa-user' },
  { path: '/control', label: 'Admin', icon: 'fa-solid fa-shield-halved' },
]

interface ActiveBroadcast {
  id: string
  title: string
  message: string
}

function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [slips, setSlips] = useState<Slip[]>([])
  const [activeBroadcast, setActiveBroadcast] = useState<ActiveBroadcast | null>(null)

  const handleSendToAudit = (newSlip: Slip) => {
    setSlips((prev) => [newSlip, ...prev.filter((s) => s.id !== newSlip.id)])
    navigate('/audit')
  }

  // 1. Auth & Telemetry tracking
  useEffect(() => {
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
        // Record user session telemetry in Firestore
        try {
          await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              uid: currentUser.uid,
              email: currentUser.email || 'guest@oddsfactory.local',
              displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Punter'),
              lastSeenAt: serverTimestamp(),
              device: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
              isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
              isGuest: !currentUser.email || currentUser.email.includes('@oddsfactory.local'),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {})
        } catch (e) {
          console.warn('Telemetry error:', e)
        }

        // Web push token registration
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const m = await messaging()
            if (m) {
              const token = await getToken(m, { vapidKey: 'YOUR_PUBLIC_VAPID_KEY_HERE' })
              if (token) {
                await setDoc(
                  doc(db, 'users', currentUser.uid, 'fcmTokens', token),
                  {
                    token,
                    createdAt: serverTimestamp(),
                    device: navigator.userAgent,
                  },
                  { merge: true }
                )
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

  // 2. Real-time Broadcast Listener
  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Check local storage for preview broadcasts
      try {
        const local = localStorage.getItem('odds_factory_active_broadcast')
        if (local) {
          const parsed = JSON.parse(local)
          setActiveBroadcast({ id: 'local-bcast', title: parsed.title, message: parsed.message })
        }
      } catch {}
      return
    }

    try {
      const bQuery = query(
        collection(db, 'broadcasts'),
        where('active', '==', true),
        orderBy('createdAt', 'desc'),
        limit(1)
      )
      const unsub = onSnapshot(bQuery, (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0]
          const data = d.data()
          const dismissedId = sessionStorage.getItem('dismissed_broadcast_id')
          if (dismissedId !== d.id) {
            setActiveBroadcast({
              id: d.id,
              title: data.title || 'Announcement',
              message: data.message || '',
            })
          }
        } else {
          setActiveBroadcast(null)
        }
      }, (err) => {
        console.warn('Broadcast listener note:', err)
      })
      return () => unsub()
    } catch {
      // Fallback
    }
  }, [])

  const handleDismissBroadcast = (id: string) => {
    try {
      sessionStorage.setItem('dismissed_broadcast_id', id)
    } catch {}
    setActiveBroadcast(null)
  }

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
      {/* ── Active Broadcast Announcement Banner ──────────────────────────── */}
      {activeBroadcast && (
        <div className="bg-zinc-950 text-white px-4 py-2.5 text-xs font-semibold border-b border-zinc-800 shadow-sm animate-in fade-in duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-ping"></span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] uppercase font-bold tracking-wider text-emerald-400 shrink-0">
                Live Broadcast
              </span>
              <span className="truncate">
                <strong className="text-zinc-100">{activeBroadcast.title}:</strong>{' '}
                <span className="text-zinc-300">{activeBroadcast.message}</span>
              </span>
            </div>
            <button
              onClick={() => handleDismissBroadcast(activeBroadcast.id)}
              className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title="Dismiss announcement"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
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
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1.5">
                    <i className="fa-solid fa-circle text-[6px] text-emerald-500 animate-pulse"></i>
                    <span>Live Engine</span>
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

      {/* ── Navigation ──────────────────────────────────────────────────── */}
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

      {/* ── Main View ───────────────────────────────────────────────────── */}
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
              onSlipUpdated={(slip: Slip) => setSlips((prev) => prev.map((s) => (s.id === slip.id ? slip : s)))}
            />
          } />
          <Route path="/history" element={
            <SavedSlipsPanel
              onLoadSlip={(slip) => {
                handleSendToAudit(slip)
              }}
            />
          } />
          <Route path="/profile" element={<ProfilePanel />} />
          <Route path="/control" element={<ControlPanel />} />
        </Routes>
      </main>

      {/* ── Mobile Tab Navigation Bar ───────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-200/80 bg-white/95 backdrop-blur-md z-50 px-2 py-1.5 flex justify-around">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) => `flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-bold ${
              isActive ? 'text-zinc-950 font-black' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <i className={`${link.icon} text-sm mb-1`}></i>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>

      <UpdatePrompt />
    </div>
  )
}

export default App
