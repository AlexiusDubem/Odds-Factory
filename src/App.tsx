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

const ADMIN_EMAIL = 'alexiusdubem7@gmail.com'

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

  const isAdmin = Boolean(user?.email && user.email.toLowerCase().trim() === ADMIN_EMAIL)

  const handleSendToAudit = (newSlip: Slip) => {
    setSlips((prev) => [newSlip, ...prev.filter((s) => s.id !== newSlip.id)])
    navigate('/audit')
  }

  // 1. Auth & Telemetry tracking
  useEffect(() => {
    if (!isFirebaseConfigured) {
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
      <div className="min-h-screen bg-[#f7f8f4] flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Odds Factory"
          className="w-12 h-12 object-contain rounded-2xl animate-pulse shadow-xs"
        />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f8f4] flex items-center justify-center p-4">
        <LoginPanel />
      </div>
    )
  }

  // Greeting & date calculations
  const now = new Date()
  const hour = now.getHours()
  const greetingTime = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const todayFormatted = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const firstName = user.displayName?.split(' ')[0] || (user.email ? user.email.split('@')[0] : 'Punter')
  const initials = (user.displayName || user.email || 'OF')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#16201c]">
      {/* ── Active Broadcast Announcement Banner ──────────────────────────── */}
      {activeBroadcast && (
        <div className="bg-[#183b2d] text-white px-4 py-2.5 text-xs font-semibold border-b border-[#2d5543] shadow-sm animate-in fade-in duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#dfff46] shrink-0 animate-ping"></span>
              <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] uppercase font-mono font-bold tracking-wider text-[#dfff46] shrink-0 border border-[#dfff46]/20">
                Live Broadcast
              </span>
              <span className="truncate">
                <strong className="text-white">{activeBroadcast.title}:</strong>{' '}
                <span className="text-[#c7d8cc]">{activeBroadcast.message}</span>
              </span>
            </div>
            <button
              onClick={() => handleDismissBroadcast(activeBroadcast.id)}
              className="text-[#c7d8cc] hover:text-white text-xs px-2 py-1 rounded hover:bg-black/20 transition-colors cursor-pointer shrink-0"
              title="Dismiss announcement"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {/* ── Main App Grid (Desktop Sidebar + Main Content) ────────────────── */}
      <div className="app-container">
        {/* Desktop Sticky Sidebar */}
        <aside className="side">
          <div className="brand">
            <img
              src="/logo.png"
              alt="Odds Factory"
              className="w-7 h-7 object-contain rounded-lg shadow-2xs"
            />
            <span>Odds Factory</span>
          </div>

          <div className="nav">
            <div className="nav-label">Workspace</div>
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon-slot"><i className="fa-solid fa-shapes"></i></span>
              Overview
            </NavLink>
            <NavLink to="/builder" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon-slot"><i className="fa-solid fa-wand-magic-sparkles"></i></span>
              Model picks
            </NavLink>
            <NavLink to="/audit" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon-slot"><i className="fa-solid fa-magnifying-glass-chart"></i></span>
              Audit a slip
            </NavLink>

            <div className="nav-label">Library</div>
            <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon-slot"><i className="fa-regular fa-clock"></i></span>
              History
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon-slot"><i className="fa-regular fa-user"></i></span>
              Profile
            </NavLink>

            {/* Admin Center - ONLY available to alexiusdubem7@gmail.com */}
            {isAdmin && (
              <>
                <div className="nav-label">System</div>
                <NavLink to="/control" className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="icon-slot"><i className="fa-solid fa-shield-halved text-emerald-600"></i></span>
                  Superadmin
                </NavLink>
              </>
            )}
          </div>

          <div className="side-footer">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="avatar shrink-0">{initials}</div>
              <div className="min-w-0 truncate">
                <div className="truncate text-xs font-bold text-[#16201c] leading-tight">
                  {user.displayName || user.email?.split('@')[0]}
                </div>
                <div className="text-[10px] text-[#8a9690] font-mono leading-tight">
                  {isAdmin ? 'Superadmin' : 'Pro Member'}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (isFirebaseConfigured) {
                  signOut(auth)
                } else {
                  setUser(null)
                }
              }}
              title="Log out"
              className="text-[#8a9690] hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-[#edf1eb] cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
            </button>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <main className="main-content">
          <header className="top">
            <div className="greeting">
              <div className="eyebrow">{todayFormatted}</div>
              <h1>Good {greetingTime}, {firstName}.</h1>
            </div>
            <div className="actions">
              <NotificationCenter />
              <button onClick={() => navigate('/builder')} className="primary-btn">
                <i>✦</i> <span>Build a slip</span>
              </button>
            </div>
          </header>

          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPanel />} />
            <Route path="/builder" element={<AccaBuilderPanel onSendToAudit={handleSendToAudit} />} />
            <Route
              path="/audit"
              element={
                <SlipEditorPanel
                  matches={sampleMatches}
                  slips={slips}
                  setSlips={setSlips}
                  onSlipUpdated={(slip: Slip) => setSlips((prev) => prev.map((s) => (s.id === slip.id ? slip : s)))}
                />
              }
            />
            <Route
              path="/history"
              element={
                <SavedSlipsPanel
                  onLoadSlip={(slip) => {
                    handleSendToAudit(slip)
                  }}
                />
              }
            />
            <Route path="/profile" element={<ProfilePanel />} />
            {/* STRICT ADMIN ROUTE: Only accessible by alexiusdubem7@gmail.com */}
            <Route
              path="/control"
              element={isAdmin ? <ControlPanel /> : <Navigate to="/dashboard" replace />}
            />
          </Routes>
        </main>
      </div>

      {/* ── Mobile Tab Navigation Bar ───────────────────────────────────── */}
      <nav className="bottom-nav">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
          <i className="fa-solid fa-shapes"></i>
          <span>Overview</span>
        </NavLink>
        <NavLink to="/builder" className={({ isActive }) => (isActive ? 'active' : '')}>
          <i className="fa-solid fa-wand-magic-sparkles"></i>
          <span>Picks</span>
        </NavLink>
        <NavLink to="/audit" className={({ isActive }) => (isActive ? 'active' : '')}>
          <i className="fa-solid fa-magnifying-glass-chart"></i>
          <span>Audit</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
          <i className="fa-regular fa-clock"></i>
          <span>History</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          <i className="fa-regular fa-user"></i>
          <span>Profile</span>
        </NavLink>
        {isAdmin && (
          <NavLink to="/control" className={({ isActive }) => (isActive ? 'active' : '')}>
            <i className="fa-solid fa-shield-halved text-emerald-600"></i>
            <span>Admin</span>
          </NavLink>
        )}
      </nav>

      <UpdatePrompt />
    </div>
  )
}

export default App
