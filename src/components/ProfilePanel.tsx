import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

export const ProfilePanel = () => {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid)
        const snap = await getDoc(userRef)
        if (snap.exists()) {
          // setProfile(snap.data())
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchProfile()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-accent"></i>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white pointer-events-none"></div>
        <div className="relative z-10">
          <div className="w-24 h-24 bg-slate-900 rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl border-4 border-white">
            <i className="fa-solid fa-user-astronaut text-4xl text-white"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-900">{auth.currentUser?.email}</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">OddsFactory Member</p>
        </div>
      </div>

      {/* Freemium Banner */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 shadow-md text-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-lg flex items-center gap-2">
            <i className="fa-solid fa-crown text-amber-400"></i> Freemium Access Activated
          </h3>
          <p className="text-sm text-violet-100 mt-1 max-w-xl">
            OddsFactory is currently in Freemium mode! Premium plans are coming soon, but for now, enjoy full unlimited Pro access on the house.
          </p>
        </div>
        <button className="px-5 py-2.5 bg-white text-indigo-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors shrink-0">
          You're a Pro!
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-dna text-accent"></i> Betting DNA
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">
                <span>Risk Tolerance</span>
                <span className="text-amber-500">Medium</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 w-[60%] rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">
                <span>Favorite Sport</span>
                <span className="text-blue-500">Football</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[85%] rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">
                <span>Market Preference</span>
                <span className="text-emerald-500">1X2 & Goals</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[70%] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm text-white">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-blue-400"></i> Account Status
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Subscription</span>
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <i className="fa-solid fa-crown text-xs"></i> Pro Plan <span className="text-[10px] text-slate-400 uppercase">(Early Access Free)</span>
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">API Calls Used</span>
              <span className="font-bold">142 / 1000</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Joined</span>
              <span className="font-bold">June 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
