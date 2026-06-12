import { useEffect, useState } from 'react'
import { collection, getDocs, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

interface UserStats {
  id: string
  email: string
  slipCount: number
  lastLogin: string
}

interface DroppedPickStats {
  matchLabel: string
  market: string
  count: number
}

export const ControlPanel = () => {
  const [users, setUsers] = useState<UserStats[]>([])
  const [droppedPicks, setDroppedPicks] = useState<DroppedPickStats[]>([])
  const [totalSlips, setTotalSlips] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Notification Form State
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifTarget, setNotifTarget] = useState('ALL')
  const [isSending, setIsSending] = useState(false)
  
  // Analytics Filter State
  const [timeFilter, setTimeFilter] = useState<number>(24 * 60 * 60 * 1000) // Default 24h

  const fetchAdminData = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true)
      const usersRef = collection(db, 'users')
      const userSnap = await getDocs(usersRef)
      
      let allSlipsCount = 0
      const userData: UserStats[] = []
      
      for (const userDoc of userSnap.docs) {
        const data = userDoc.data()
        const slipsRef = collection(db, 'users', userDoc.id, 'slips')
        const slipsSnap = await getDocs(slipsRef)
        allSlipsCount += slipsSnap.size
        
        userData.push({
          id: userDoc.id,
          email: data.email || 'Unknown',
          slipCount: slipsSnap.size,
          lastLogin: data.lastLogin?.toDate().toLocaleDateString() || 'Never'
        })
      }
      
      // Fetch global matches
      const matchesRef = collection(db, 'processed_matches')
      const matchesSnap = await getDocs(matchesRef)
      
      // Fetch dropped picks for analytics
      const droppedRef = collection(db, 'dropped_picks')
      const droppedSnap = await getDocs(droppedRef)
      
      const pickCounts: Record<string, number> = {}
      const cutoffTime = timeFilter > 0 ? Date.now() - timeFilter : 0;
      
      droppedSnap.docs.forEach(d => {
        const data = d.data()
        // Filter by time if timeFilter > 0 (0 means ALL time)
        if (cutoffTime > 0 && data.droppedAt && typeof data.droppedAt.toMillis === 'function') {
          if (data.droppedAt.toMillis() < cutoffTime) return;
        }
        
        const key = `${data.matchLabel} | ${data.market}`
        pickCounts[key] = (pickCounts[key] || 0) + 1
      })
      
      const sortedPicks = Object.entries(pickCounts)
        .map(([key, count]) => {
          const [matchLabel, market] = key.split(' | ')
          return { matchLabel, market, count }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10

      setUsers(userData)
      setTotalSlips(allSlipsCount)
      setTotalMatches(matchesSnap.size)
      setDroppedPicks(sortedPicks)
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err)
      setError('Permission Denied. Are you sure you are the Admin? Check Firestore Rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [timeFilter]) // Re-fetch when time filter changes

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user profile?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId))
      alert('User profile deleted. Refreshing data...')
      fetchAdminData()
    } catch (err) {
      console.error(err)
      alert('Failed to delete user.')
    }
  }

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notifTitle.trim() || !notifMessage.trim()) return
    
    setIsSending(true)
    try {
      const targets = notifTarget === 'ALL' ? users.map(u => u.id) : [notifTarget]
      
      for (const uid of targets) {
        await addDoc(collection(db, 'users', uid, 'notifications'), {
          title: notifTitle,
          message: notifMessage,
          read: false,
          createdAt: serverTimestamp()
        })
      }
      
      alert(`Notification sent to ${targets.length} user(s).`)
      setNotifTitle('')
      setNotifMessage('')
    } catch (err) {
      console.error(err)
      alert('Failed to send notification.')
    } finally {
      setIsSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-accent"></i>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-center">
        <i className="fa-solid fa-lock text-4xl text-slate-300 mb-4"></i>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-md">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-bolt text-amber-500"></i> Control Center
          </h2>
          <p className="text-sm text-slate-500">Superadmin Dashboard</p>
        </div>
        <button onClick={fetchAdminData} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors">
          <i className="fa-solid fa-rotate-right mr-2"></i> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 text-slate-400">
            <span className="text-xs font-bold uppercase tracking-widest">Total Users</span>
            <i className="fa-solid fa-users text-slate-600 text-lg"></i>
          </div>
          <div className="text-4xl font-black text-white">{users.length}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 text-slate-500">
            <span className="text-xs font-bold uppercase tracking-widest">Total Slips Processed</span>
            <i className="fa-solid fa-receipt text-slate-300 text-lg"></i>
          </div>
          <div className="text-4xl font-black text-slate-900">{totalSlips}</div>
        </div>

        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 text-emerald-600">
            <span className="text-xs font-bold uppercase tracking-widest">Total Matches Analyzed</span>
            <i className="fa-solid fa-futbol text-emerald-300 text-lg"></i>
          </div>
          <div className="text-4xl font-black text-emerald-700">{totalMatches}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">User Database</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3 border-b border-slate-100">User UID</th>
                  <th className="px-6 py-3 border-b border-slate-100">Email</th>
                  <th className="px-6 py-3 border-b border-slate-100">Slips</th>
                  <th className="px-6 py-3 border-b border-slate-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{u.id.substring(0, 8)}...</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{u.email}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-bold">{u.slipCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-wide"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-trash-can text-slate-400"></i> Top Dropped Picks
            </h3>
            <select 
              value={timeFilter}
              onChange={(e) => setTimeFilter(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={24 * 60 * 60 * 1000}>Last 24H</option>
              <option value={7 * 24 * 60 * 60 * 1000}>Last 7 Days</option>
              <option value={30 * 24 * 60 * 60 * 1000}>Last 30 Days</option>
              <option value={0}>All Time</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px]">
             {droppedPicks.length === 0 ? (
               <div className="p-8 text-center text-slate-500 text-sm">No picks dropped in this timeframe.</div>
             ) : (
               <ul className="divide-y divide-slate-100">
                 {droppedPicks.map((pick, i) => (
                   <li key={i} className="p-4 flex items-center justify-between hover:bg-slate-50">
                     <div className="min-w-0 pr-4">
                       <p className="text-sm font-bold text-slate-900 truncate">{pick.matchLabel}</p>
                       <p className="text-xs text-slate-500">{pick.market}</p>
                     </div>
                     <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold text-xs">
                       {pick.count}
                     </div>
                   </li>
                 ))}
               </ul>
             )}
          </div>
        </div>

        {/* Push Notification Sender */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 mt-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
            <i className="fa-solid fa-paper-plane text-accent"></i> Broadcast Notification
          </h3>
          <form onSubmit={handleSendNotification} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Target Audience</label>
                <select 
                  value={notifTarget}
                  onChange={e => setNotifTarget(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="ALL">All Users</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Notification Title</label>
                <input 
                  type="text" 
                  value={notifTitle}
                  onChange={e => setNotifTitle(e.target.value)}
                  placeholder="e.g. Server Maintenance"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Message</label>
              <textarea 
                value={notifMessage}
                onChange={e => setNotifMessage(e.target.value)}
                placeholder="Type your message to users here..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent min-h-[100px]"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isSending}
              className="px-6 py-3 bg-accent text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {isSending ? 'Broadcasting...' : 'Send Notification'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
