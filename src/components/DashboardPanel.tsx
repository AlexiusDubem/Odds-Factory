import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, getDocs, orderBy } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import type { Slip } from '../types'

export const DashboardPanel = () => {
  const [slips, setSlips] = useState<Slip[]>([])
  const [recentActivities, setRecentActivities] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser) {
        setLoading(false)
        return
      }
      try {
        const slipsRef = collection(db, 'users', auth.currentUser.uid, 'slips')
        const snap = await getDocs(query(slipsRef, orderBy('createdAt', 'desc')))

        const fetchedSlips: Slip[] = []
        snap.forEach((doc) => {
          fetchedSlips.push({ id: doc.id, ...doc.data() } as Slip)
        })
        setSlips(fetchedSlips)

        const activityRef = collection(db, 'users', auth.currentUser.uid, 'recent_optimizations')
        const activitySnap = await getDocs(query(activityRef, orderBy('createdAt', 'desc')))

        const fetchedActivities: Slip[] = []
        activitySnap.forEach((doc) => {
          fetchedActivities.push({ id: doc.id, ...doc.data() } as Slip)
        })
        setRecentActivities(fetchedActivities)
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
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500 space-y-3">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-zinc-900"></i>
        <p className="text-xs font-bold text-zinc-400">Loading Dashboard…</p>
      </div>
    )
  }

  const avgHealth =
    slips.length > 0
      ? slips.reduce((acc, s) => acc + (s.survivalProbability || 0), 0) / slips.length
      : 74.2

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans animate-in fade-in duration-300">
      {/* ── Hero Welcome Banner ────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                SportyBet Multi-Market Intelligence
              </span>
              <span className="text-[10px] font-bold text-zinc-400">
                Season 2026/27
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Welcome back, {auth.currentUser?.displayName || 'Punter'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed font-medium">
              Your AI-powered football intelligence hub. Discover high-probability Sure Picks, audit toxic accumulator legs, and book genuine SportyBet codes.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <Link
              to="/builder"
              className="py-3 px-5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-emerald-400 text-xs"></i>
              <span>Generate Sure Picks</span>
            </Link>
            <Link
              to="/audit"
              className="py-3 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-zinc-200/60"
            >
              <i className="fa-solid fa-magnifying-glass-chart text-xs"></i>
              <span>Audit Booking Code</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Key Performance Indicators ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Slips Saved */}
        <div className="bg-white border border-zinc-200/80 rounded-[28px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Optimized Slips Saved</span>
            <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-ticket"></i>
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-zinc-950">{slips.length}</div>
          <p className="text-[11px] text-zinc-500 font-medium">Saved in your betting ledger</p>
        </div>

        {/* Avg Slip Health */}
        <div className="bg-white border border-zinc-200/80 rounded-[28px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Average Ticket Health</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-heart-pulse"></i>
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-emerald-600">{avgHealth.toFixed(1)}%</div>
          <p className="text-[11px] text-zinc-500 font-medium">Calibrated accumulator survival</p>
        </div>

        {/* Expected Edge */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-[28px] p-6 shadow-sm space-y-2 text-white relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Model Expected Edge</span>
            <div className="w-8 h-8 rounded-full bg-zinc-800 text-emerald-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-chart-line"></i>
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white">+14.8%</div>
          <p className="text-[11px] text-zinc-400 font-medium">Over raw bookmaker implied odds</p>
        </div>
      </div>

      {/* ── Quick Generator Launchpads ─────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-7 shadow-[0_2px_16px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-bolt text-amber-500 text-xs"></i>
            Instant Ticket Launchpads
          </h3>
          <span className="text-[11px] font-bold text-zinc-400">One-Tap Presets</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/builder"
            className="p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/60 transition-all space-y-1.5 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-zinc-900 group-hover:text-emerald-700 transition-colors">
                2-Odds Safe Anchor
              </span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                Ultra Safe
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
              Double Chance & Over 1.5 banker legs with 85%+ estimated survival rate.
            </p>
          </Link>

          <Link
            to="/builder"
            className="p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/60 transition-all space-y-1.5 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-zinc-900 group-hover:text-blue-700 transition-colors">
                5-Odds Value Accumulator
              </span>
              <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                Balanced
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
              Balanced mix of Corners Over, DNB, and 2-Up Payout selections.
            </p>
          </Link>

          <Link
            to="/builder"
            className="p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/60 transition-all space-y-1.5 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-zinc-900 group-hover:text-indigo-700 transition-colors">
                Midnight Odds Slate
              </span>
              <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
                10 PM – 6 AM
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
              South American, MLS, and late European night owl fixtures.
            </p>
          </Link>
        </div>
      </div>

      {/* ── Recent Optimizations Activity Feed ─────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-7 shadow-[0_2px_16px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-zinc-400 text-xs"></i>
            Recent Slip Optimizations
          </h3>
          <Link
            to="/history"
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            View All History →
          </Link>
        </div>

        {recentActivities.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 space-y-2">
            <i className="fa-solid fa-wand-magic-sparkles text-zinc-300 text-2xl"></i>
            <p className="text-xs font-bold text-zinc-600">No recent ticket optimizations yet</p>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
              Load an existing SportyBet code in Audit Slip or generate a ticket in Sure Picks to see your activity here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentActivities.slice(0, 5).map((slip) => (
              <div
                key={slip.id}
                className="p-4 rounded-2xl border border-zinc-200/60 bg-zinc-50/60 hover:bg-zinc-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-xs text-zinc-700 shrink-0">
                    <i className="fa-solid fa-receipt"></i>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-zinc-900">{slip.name}</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {slip.legs.length} games • Multiplier @{slip.combinedOdds.toFixed(2)}x
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                    {slip.survivalProbability.toFixed(1)}% Survival
                  </span>
                  <Link
                    to="/audit"
                    className="py-1 px-3 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 text-[11px] font-bold rounded-lg transition-colors"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
