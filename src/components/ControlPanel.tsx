import { useEffect, useState } from 'react'
import { collection, query, getDocs, orderBy, collectionGroup } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

interface UserStats {
  id: string
  email: string
  slipCount: number
  lastLogin: string
}

export const ControlPanel = () => {
  const [users, setUsers] = useState<UserStats[]>([])
  const [totalSlips, setTotalSlips] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAdminData = async () => {
      if (!auth.currentUser) return;
      try {
        // Fetch all users
        const usersRef = collection(db, 'users')
        const userSnap = await getDocs(usersRef)
        
        let allSlipsCount = 0
        const userData: UserStats[] = []
        
        // This is a naive fetch for demo purposes. In production, 
        // you'd use Cloud Functions to aggregate these counts.
        for (const userDoc of userSnap.docs) {
          const data = userDoc.data()
          
          // Fetch their slips
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
        // Fetch all global matches processed
        const matchesRef = collection(db, 'processed_matches')
        const matchesSnap = await getDocs(matchesRef)
        
        setUsers(userData)
        setTotalSlips(allSlipsCount)
        setTotalMatches(matchesSnap.size)
      } catch (err: any) {
        console.error('Failed to fetch admin data:', err)
        setError('Permission Denied. Are you sure you are the Admin? Check Firestore Rules.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchAdminData()
  }, [])

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-bolt text-amber-500"></i> Control Center
          </h2>
          <p className="text-sm text-slate-500">Superadmin Dashboard</p>
        </div>
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">User Database</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3 border-b border-slate-100">User UID</th>
                <th className="px-6 py-3 border-b border-slate-100">Email</th>
                <th className="px-6 py-3 border-b border-slate-100">Slips Audited</th>
                <th className="px-6 py-3 border-b border-slate-100">Last Login</th>
                <th className="px-6 py-3 border-b border-slate-100 text-right">Actions</th>
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
                  <td className="px-6 py-4 text-slate-500">{u.lastLogin}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-accent hover:text-accent/80 text-xs font-bold uppercase tracking-wide">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
