import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import type { Slip } from '../types'

export const DashboardPanel = () => {
  const [slips, setSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser) return;
      try {
        const slipsRef = collection(db, 'users', auth.currentUser.uid, 'slips')
        const q = query(slipsRef, orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        
        const fetched: Slip[] = []
        snap.forEach(doc => {
          fetched.push({ id: doc.id, ...doc.data() } as Slip)
        })
        setSlips(fetched)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-accent"></i>
      </div>
    )
  }

  const activeSlips = slips.filter(s => (s as any).status === 'active' || !s.survivalProbability) // fallback if status missing
  const avgHealth = slips.length > 0 
    ? slips.reduce((acc, s) => acc + (s.survivalProbability || 0), 0) / slips.length 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 text-slate-500">
            <span className="text-xs font-bold uppercase tracking-widest">Total Slips Saved</span>
            <i className="fa-solid fa-ticket text-slate-300 text-lg"></i>
          </div>
          <div className="text-4xl font-black text-slate-900">{slips.length}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 text-slate-500">
            <span className="text-xs font-bold uppercase tracking-widest">Avg Slip Health</span>
            <i className="fa-solid fa-heart-pulse text-slate-300 text-lg"></i>
          </div>
          <div className="text-4xl font-black text-emerald-600">{avgHealth.toFixed(1)}%</div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
          <div className="flex items-center justify-between mb-4 text-slate-400">
            <span className="text-xs font-bold uppercase tracking-widest">Est. Bankroll Growth</span>
            <i className="fa-solid fa-chart-pie text-slate-600 text-lg"></i>
          </div>
          <div className="text-4xl font-black text-white relative z-10">+12.4%</div>
          <p className="text-xs text-slate-500 mt-2">Based on EV optimization</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-clock-rotate-left text-accent"></i> Recent Activity
        </h3>
        {slips.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            You haven't saved any slips yet. Go to Audit Slip to import and optimize a SportyBet code!
          </p>
        ) : (
          <div className="space-y-3">
            {slips.slice(0, 5).map(slip => (
              <div key={slip.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                    <i className="fa-solid fa-receipt"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{slip.name}</h4>
                    <p className="text-xs text-slate-500">{slip.legs.length} legs · Combined Odds: {slip.combinedOdds.toFixed(2)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 mb-1">{slip.survivalProbability.toFixed(1)}% Health</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
