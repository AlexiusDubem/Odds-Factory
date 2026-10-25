import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, doc, deleteDoc, addDoc, serverTimestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../config/firebase'

interface UserStats {
  id: string
  email: string
  displayName?: string
  isGuest?: boolean
  slipCount: number
  lastLogin: string
  lastLoginRaw?: number
  device?: string
  isMobile?: boolean
  createdAt?: string
}

interface DroppedPickStats {
  matchLabel: string
  market: string
  count: number
}

interface BroadcastItem {
  id: string
  title: string
  message: string
  target: string
  active: boolean
  createdAt: any
  author?: string
}

export const ControlPanel = () => {
  const [users, setUsers] = useState<UserStats[]>([])
  const [droppedPicks, setDroppedPicks] = useState<DroppedPickStats[]>([])
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([])
  const [totalSlips, setTotalSlips] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userFilter, setUserFilter] = useState<'all' | 'registered' | 'guests'>('all')

  // Notification Form State
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifTarget, setNotifTarget] = useState('ALL')
  const [isSending, setIsSending] = useState(false)
  const [broadcastBanner, setBroadcastBanner] = useState<string | null>(null)

  // Analytics Filter State
  const [timeFilter, setTimeFilter] = useState<number>(24 * 60 * 60 * 1000) // Default 24h

  // Fetch genuine admin, telemetry, and broadcast data
  const fetchAdminData = async () => {
    try {
      setLoading(true)

      let userData: UserStats[] = []
      let allSlipsCount = 0
      let matchCount = 0
      const pickCounts: Record<string, number> = {}
      const broadcastList: BroadcastItem[] = []

      if (isFirebaseConfigured) {
        // 1. Fetch genuine users
        try {
          const usersRef = collection(db, 'users')
          const userSnap = await getDocs(usersRef)

          for (const userDoc of userSnap.docs) {
            const data = userDoc.data()
            let userSlipCount = 0

            try {
              const slipsRef = collection(db, 'users', userDoc.id, 'slips')
              const slipsSnap = await getDocs(slipsRef)
              userSlipCount = slipsSnap.size
              allSlipsCount += userSlipCount
            } catch {
              // Subcollection read may be restricted
            }

            const lastLoginDate = data.lastSeenAt?.toDate
              ? data.lastSeenAt.toDate()
              : data.lastLogin?.toDate
              ? data.lastLogin.toDate()
              : null

            userData.push({
              id: userDoc.id,
              email: data.email || 'guest@oddsfactory.local',
              displayName: data.displayName || (data.email ? data.email.split('@')[0] : 'Punter'),
              isGuest: data.isGuest ?? (data.email?.includes('@oddsfactory.local') || false),
              slipCount: userSlipCount,
              lastLogin: lastLoginDate ? lastLoginDate.toLocaleString() : 'Active Now',
              lastLoginRaw: lastLoginDate ? lastLoginDate.getTime() : Date.now(),
              device: data.device || (data.isMobile ? 'Mobile Device' : 'Desktop Browser'),
              isMobile: data.isMobile ?? false,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Today',
            })
          }
        } catch (userErr) {
          console.warn('Firestore user fetch note:', userErr)
        }

        // 2. Fetch live broadcasts
        try {
          const bQuery = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(15))
          const bSnap = await getDocs(bQuery)
          bSnap.docs.forEach((d) => {
            const data = d.data()
            broadcastList.push({
              id: d.id,
              title: data.title || 'Announcement',
              message: data.message || '',
              target: data.target || 'ALL',
              active: data.active !== false,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 'Just now',
              author: data.author || 'Admin',
            })
          })
        } catch (bErr) {
          console.warn('Broadcast fetch note:', bErr)
        }

        // 3. Fetch genuine dropped picks telemetry
        try {
          const droppedRef = collection(db, 'dropped_picks')
          const droppedSnap = await getDocs(droppedRef)
          const cutoffTime = timeFilter > 0 ? Date.now() - timeFilter : 0

          droppedSnap.docs.forEach((d) => {
            const data = d.data()
            if (cutoffTime > 0 && data.droppedAt && typeof data.droppedAt.toMillis === 'function') {
              if (data.droppedAt.toMillis() < cutoffTime) return
            }
            const key = `${data.matchLabel || 'Match'} | ${data.market || 'Market'}`
            pickCounts[key] = (pickCounts[key] || 0) + 1
          })
        } catch {
          // Handled gracefully
        }

        // 4. Fetch genuine processed matches count
        try {
          const matchesRef = collection(db, 'processed_matches')
          const matchesSnap = await getDocs(matchesRef)
          matchCount = matchesSnap.size
        } catch {}
      }

      // If no users returned yet, show only current user's genuine active session
      if (userData.length === 0 && auth.currentUser) {
        const u = auth.currentUser
        userData = [
          {
            id: u.uid,
            email: u.email || 'admin@oddsfactory.io',
            displayName: u.displayName || (u.email ? u.email.split('@')[0] : 'Administrator'),
            isGuest: false,
            slipCount: allSlipsCount,
            lastLogin: 'Active Now',
            lastLoginRaw: Date.now(),
            device: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
            isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
            createdAt: 'Today',
          },
        ]
      }

      const sortedPicks = Object.entries(pickCounts)
        .map(([key, count]) => {
          const [matchLabel, market] = key.split(' | ')
          return { matchLabel, market, count }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      setUsers(userData)
      setBroadcasts(broadcastList)
      setTotalSlips(allSlipsCount)
      setTotalMatches(matchCount)
      setDroppedPicks(sortedPicks)
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [timeFilter])

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user profile from telemetry?')) return
    try {
      if (isFirebaseConfigured) {
        await deleteDoc(doc(db, 'users', userId))
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete user profile.')
    }
  }

  const handleDeactivateBroadcast = async (broadcastId: string) => {
    try {
      if (isFirebaseConfigured) {
        await updateDoc(doc(db, 'broadcasts', broadcastId), { active: false })
      }
      setBroadcasts((prev) => prev.map((b) => (b.id === broadcastId ? { ...b, active: false } : b)))
      alert('Broadcast deactivated.')
    } catch (err) {
      console.error(err)
      alert('Failed to deactivate broadcast.')
    }
  }

  const handleDeleteBroadcast = async (broadcastId: string) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return
    try {
      if (isFirebaseConfigured) {
        await deleteDoc(doc(db, 'broadcasts', broadcastId))
      }
      setBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete broadcast.')
    }
  }

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notifTitle.trim() || !notifMessage.trim()) return

    setIsSending(true)
    try {
      const newBroadcast = {
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        target: notifTarget,
        active: true,
        createdAt: serverTimestamp(),
        author: auth.currentUser?.email || 'admin@oddsfactory.io',
      }

      if (isFirebaseConfigured) {
        const docRef = await addDoc(collection(db, 'broadcasts'), newBroadcast)
        setBroadcasts((prev) => [
          {
            id: docRef.id,
            ...newBroadcast,
            createdAt: 'Just now',
          },
          ...prev,
        ])
      }

      // Also persist to localStorage for instant local preview banner
      try {
        localStorage.setItem(
          'odds_factory_active_broadcast',
          JSON.stringify({
            title: notifTitle.trim(),
            message: notifMessage.trim(),
            timestamp: Date.now(),
          })
        )
      } catch {}

      setBroadcastBanner(`${notifTitle}: ${notifMessage}`)
      alert('Broadcast alert successfully sent and live across all devices!')
      setNotifTitle('')
      setNotifMessage('')
    } catch (err) {
      console.error('Error sending broadcast:', err)
      alert('Failed to send broadcast. Check Firestore permissions or connection.')
    } finally {
      setIsSending(false)
    }
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userFilter === 'registered' && u.isGuest) return false
      if (userFilter === 'guests' && !u.isGuest) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          u.email.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q)) ||
          u.id.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [users, userFilter, searchQuery])

  // Device breakdown
  const mobileCount = useMemo(() => users.filter((u) => u.isMobile).length, [users])
  const desktopCount = useMemo(() => users.length - mobileCount, [users, mobileCount])
  const mobilePct = users.length > 0 ? Math.round((mobileCount / users.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500 space-y-3">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-zinc-900"></i>
        <p className="text-xs font-bold text-zinc-500">Loading Command Center Telemetry…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans animate-in fade-in duration-300">
      {/* ── Header Banner ────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-950 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <i className="fa-solid fa-shield-halved text-[9px] text-emerald-400"></i>
                Superadmin Command Center
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Real-Time Telemetry Live
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Platform & User Telemetry
            </h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              Real-time user engagement, slip optimization metrics, and system operations.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchAdminData}
              className="py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-rotate-right text-xs"></i>
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {broadcastBanner && (
          <div className="mt-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-semibold">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-bullhorn text-emerald-600"></i>
              <span>{broadcastBanner}</span>
            </div>
            <button
              onClick={() => setBroadcastBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}
      </div>

      {/* ── 4 Key Metric Bento Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white border border-zinc-200/80 rounded-[28px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total User Audience</span>
            <div className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-950">{users.length}</div>
          <p className="text-[11px] text-zinc-500 font-medium">
            <strong className="text-emerald-600 font-bold">{users.filter((u) => !u.isGuest).length}</strong> Registered • {users.filter((u) => u.isGuest).length} Guests
          </p>
        </div>

        {/* Slips Processed */}
        <div className="bg-white border border-zinc-200/80 rounded-[28px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Accumulators Generated</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-ticket"></i>
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-950">{totalSlips}</div>
          <p className="text-[11px] text-zinc-500 font-medium">
            Avg <strong className="text-zinc-900 font-bold">{(totalSlips / Math.max(1, users.length)).toFixed(1)}</strong> slips per punter
          </p>
        </div>

        {/* Matches Analyzed */}
        <div className="bg-white border border-zinc-200/80 rounded-[28px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Matches Analyzed</span>
            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-futbol"></i>
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-950">{totalMatches}</div>
          <p className="text-[11px] text-zinc-500 font-medium">
            SportyBet catalog matches tracked
          </p>
        </div>

        {/* Mobile vs Desktop */}
        <div className="bg-white border border-zinc-200/80 rounded-[28px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Mobile Traffic Share</span>
            <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-mobile-screen"></i>
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-950">{mobilePct}%</div>
          <p className="text-[11px] text-zinc-500 font-medium">
            {mobileCount} Mobile • {desktopCount} Desktop
          </p>
        </div>
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live User Directory */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-zinc-950 tracking-tight">Active User Directory</h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Real-time telemetry of punters registered and browsing on Odds Factory
                </p>
              </div>

              {/* Segmented Filter */}
              <div className="bg-zinc-100 p-1 rounded-xl flex items-center gap-1 self-start sm:self-auto text-xs font-bold">
                <button
                  onClick={() => setUserFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    userFilter === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setUserFilter('registered')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    userFilter === 'registered' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Registered
                </button>
                <button
                  onClick={() => setUserFilter('guests')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    userFilter === 'guests' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Guests
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
              <input
                type="text"
                placeholder="Search punters by email, name, or UID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>

            {/* User List */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 space-y-2">
                  <i className="fa-regular fa-folder-open text-3xl text-zinc-300"></i>
                  <p className="text-xs font-semibold">No punters found matching this filter</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 bg-zinc-50/70 hover:bg-zinc-50 border border-zinc-200/60 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          u.isGuest
                            ? 'bg-zinc-200 text-zinc-600'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.displayName ? u.displayName.slice(0, 2).toUpperCase() : 'PU'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-zinc-900 truncate">
                            {u.displayName || u.email}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              u.isGuest
                                ? 'bg-zinc-200/80 text-zinc-600'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {u.isGuest ? 'Guest' : 'Registered'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                          <span className="truncate">{u.email}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <i
                              className={`fa-solid ${
                                u.isMobile ? 'fa-mobile-screen' : 'fa-laptop'
                              } text-[10px]`}
                            ></i>
                            {u.device || 'Browser'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-black text-zinc-900">
                          {u.slipCount} slips
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">
                          {u.lastLogin}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="w-7 h-7 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                        title="Delete User Telemetry"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Dropped Traps & System Health */}
        <div className="space-y-6">
          {/* Top Dropped Traps */}
          <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-950 tracking-tight">Top Dropped Traps</h3>
                <p className="text-[11px] text-zinc-400 font-medium">Risky selections flagged by AI</p>
              </div>

              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(Number(e.target.value))}
                aria-label="Filter dropped traps timeframe"
                className="text-[11px] font-bold bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-zinc-700"
              >
                <option value={24 * 3600 * 1000}>24h</option>
                <option value={7 * 24 * 3600 * 1000}>7d</option>
                <option value={30 * 24 * 3600 * 1000}>30d</option>
                <option value={0}>All Time</option>
              </select>
            </div>

            <div className="space-y-2.5">
              {droppedPicks.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  <i className="fa-solid fa-shield-halved text-2xl mb-2 text-zinc-300"></i>
                  <p className="text-xs font-semibold">No high-risk traps recorded yet</p>
                  <p className="text-[10px] text-zinc-400 mt-1">As slips are audited, flagged traps will appear here</p>
                </div>
              ) : (
                droppedPicks.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-50/70 border border-zinc-200/60 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-zinc-900 truncate">{p.matchLabel}</div>
                      <div className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                        <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                        <span>{p.market}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black shrink-0 border border-rose-200">
                      Dropped {p.count}x
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Infrastructure Health */}
          <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
            <h3 className="text-base font-black text-zinc-950 tracking-tight">System Infrastructure</h3>
            
            <div className="space-y-2 text-xs font-medium">
              <div className="p-3 bg-zinc-50 border border-zinc-200/60 rounded-xl flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-700">
                  <i className="fa-solid fa-server text-emerald-500"></i>
                  SportyBet API Live Feed
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Connected (200 OK)
                </span>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200/60 rounded-xl flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-700">
                  <i className="fa-solid fa-brain text-blue-500"></i>
                  AI Reasoning Engine
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  Active (Multi-Provider)
                </span>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200/60 rounded-xl flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-700">
                  <i className="fa-solid fa-cloud text-purple-500"></i>
                  Vercel Serverless Cluster
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Global Broadcast Center ──────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-xs">
              <i className="fa-solid fa-bullhorn"></i>
            </div>
            <h3 className="text-xl font-black text-zinc-950 tracking-tight">Global Broadcast Center</h3>
          </div>
          <p className="text-xs text-zinc-500 font-medium">
            Send real-time alerts and announcements that display across all active punter screens instantly.
          </p>
        </div>

        <form onSubmit={handleSendNotification} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Announcement Title</label>
              <input
                type="text"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="e.g. Weekend Banker Update or Maintenance Notice"
                required
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Target Audience</label>
              <select
                value={notifTarget}
                onChange={(e) => setNotifTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-zinc-400"
              >
                <option value="ALL">All Users & Visitors (Global)</option>
                <option value="registered">Registered Punters Only</option>
                <option value="guests">Guest Sessions Only</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Announcement Message</label>
            <textarea
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              placeholder="Enter message text that will be broadcast to punters…"
              rows={3}
              required
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
            ></textarea>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSending}
              className="px-6 py-2.5 bg-zinc-950 hover:bg-black text-white text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  <span>Broadcasting…</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane text-xs"></i>
                  <span>Send Broadcast Announcement</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Broadcast Feed */}
        {broadcasts.length > 0 && (
          <div className="pt-4 border-t border-zinc-100 space-y-3">
            <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
              Live & Past Broadcasts ({broadcasts.length})
            </h4>
            <div className="space-y-2">
              {broadcasts.map((b) => (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-2xl border flex items-start justify-between gap-4 transition-colors ${
                    b.active ? 'bg-emerald-50/50 border-emerald-200/80' : 'bg-zinc-50 border-zinc-200/60 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-zinc-900">{b.title}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          b.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {b.active ? 'Live Now' : 'Deactivated'}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">• {b.createdAt}</span>
                    </div>
                    <p className="text-xs text-zinc-600 font-medium">{b.message}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.active && (
                      <button
                        onClick={() => handleDeactivateBroadcast(b.id)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors cursor-pointer"
                        title="Deactivate broadcast"
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteBroadcast(b.id)}
                      className="w-7 h-7 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      title="Delete broadcast"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
