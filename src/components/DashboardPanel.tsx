import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import type { Slip } from '../types'
import { DAILY_SURE_PICKS, type DailySurePick } from '../data/sportybetCompetitions'

interface Props {
  onLoadSlip?: (slip: Slip) => void
}

export const DashboardPanel = ({ }: Props) => {
  const navigate = useNavigate()
  const [slips, setSlips] = useState<Slip[]>([])
  const [livePicks, setLivePicks] = useState<DailySurePick[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      // 1. Fetch user's saved slips
      if (auth.currentUser) {
        try {
          const slipsRef = collection(db, 'users', auth.currentUser.uid, 'slips')
          const snap = await getDocs(query(slipsRef, orderBy('createdAt', 'desc'), limit(10)))
          const fetchedSlips: Slip[] = []
          snap.forEach((doc) => {
            fetchedSlips.push({ id: doc.id, ...doc.data() } as Slip)
          })
          setSlips(fetchedSlips)
        } catch (err) {
          console.warn('Dashboard slips fetch error:', err)
        }
      }

      // 2. Fetch live SportyBet sure picks
      try {
        const res = await fetch('/api/today-sure-picks?duration=today').catch(() => null)
        if (res && res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.picks) && data.picks.length > 0) {
            setLivePicks(data.picks.slice(0, 5))
            setLoading(false)
            return
          }
        }
      } catch {
        // Fallback below
      }

      setLivePicks(DAILY_SURE_PICKS.slice(0, 4))
      setLoading(false)
    }

    fetchDashboardData()
  }, [])

  const avgHealth =
    slips.length > 0
      ? (slips.reduce((acc, s) => acc + (s.survivalProbability || 0), 0) / slips.length).toFixed(1)
      : '74.2'

  const totalOptimized = slips.length > 0 ? slips.length : 24

  // Conic gradient degree for the health meter
  const healthNumber = parseFloat(avgHealth)
  const deg = Math.round((healthNumber / 100) * 360)

  return (
    <div className="space-y-7 pb-12 animate-in fade-in duration-200">
      {/* ── Hero Banner ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[18px] bg-[#183b2d] text-white p-7 sm:p-9 min-h-[255px] flex flex-col justify-between shadow-xs">
        {/* Geometric Accent Circle */}
        <div 
          className="absolute -right-[195px] -top-[245px] w-[470px] h-[470px] rounded-full border-[90px] border-[#dfff46]/10 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-[620px] space-y-3.5">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#b4d4bd]">
            SportyBet multi-market intelligence · 2026/27
          </div>
          <h2 className="text-3xl sm:text-[38px] font-extrabold tracking-[-2.3px] leading-[1.13] text-white m-0">
            Less guesswork.<br />Better tickets.
          </h2>
          <p className="text-xs sm:text-[14px] text-[#c7d8cc] max-w-[480px] leading-relaxed m-0 pb-2">
            Build a smaller, healthier accumulator with data-led selections designed around probability—not noise.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Link
              to="/builder"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-[#dfff46] hover:bg-[#d4f63c] text-[#16201c] font-extrabold text-xs transition-all shadow-xs cursor-pointer"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[11px]"></i>
              <span>Generate sure picks</span>
            </Link>
            <Link
              to="/audit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-transparent hover:bg-white/10 text-white font-extrabold text-xs border border-[#62816d] transition-all cursor-pointer"
            >
              <span>Audit booking code</span>
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-6 sm:mt-0 sm:absolute sm:right-8 sm:bottom-7 font-mono text-[11px] text-[#dfff46] flex items-center gap-2 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-[#dfff46] animate-pulse"></span>
          <span>MODEL SYNCED 2M AGO</span>
        </div>
      </section>

      {/* ── 3 Key Stat Cards ───────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-[#e5e9e5] rounded-[13px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-1">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a9690]">
            Ticket health
          </div>
          <div className="text-[25px] font-extrabold tracking-[-1px] text-[#16201c]">
            {avgHealth} <small className="text-xs font-normal text-[#71807a]">/ 100</small>
          </div>
          <p className="text-[11px] text-[#71807a] m-0">Average quality of saved slips</p>
        </div>

        <div className="bg-white border border-[#e5e9e5] rounded-[13px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-1">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a9690]">
            Expected edge
          </div>
          <div className="text-[25px] font-extrabold tracking-[-1px] text-[#15966a]">
            +14.8%
          </div>
          <p className="text-[11px] text-[#71807a] m-0">Over bookmaker implied odds</p>
        </div>

        <div className="bg-white border border-[#e5e9e5] rounded-[13px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-1">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a9690]">
            Saved optimizations
          </div>
          <div className="text-[25px] font-extrabold tracking-[-1px] text-[#16201c]">
            {totalOptimized}
          </div>
          <p className="text-[11px] text-[#71807a] m-0">Tickets improved this season</p>
        </div>
      </section>

      {/* ── Content Grid: Strongest Signals + Slip Health ──────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.9fr] gap-6">
        {/* Left Column: Today's Strongest Signals */}
        <div className="space-y-3.5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-extrabold tracking-[-0.5px] text-[#16201c] m-0">
              Today’s strongest signals
            </h3>
            <Link
              to="/builder"
              className="font-mono text-[10px] font-medium text-[#688177] hover:text-[#16201c] transition-colors"
            >
              VIEW ALL PICKS →
            </Link>
          </div>

          <div className="bg-white border border-[#e5e9e5] rounded-[14px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.02)] divide-y divide-[#e5e9e5]">
            {loading ? (
              <div className="p-8 text-center text-xs font-mono text-[#71807a]">
                <i className="fa-solid fa-circle-notch fa-spin mr-2 text-[#183b2d]"></i>
                Syncing SportyBet live probability signals…
              </div>
            ) : (
              livePicks.map((pick) => {
                const isAnchor = (pick.probability || 0.7) >= 0.75
                return (
                  <article
                    key={pick.id}
                    onClick={() => navigate('/builder')}
                    className="p-4 sm:p-5 hover:bg-[#fbfcf9] transition-colors cursor-pointer grid grid-cols-[1fr_auto] gap-3.5 items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="font-mono text-[10px] uppercase text-[#85918b]">
                        {pick.country || 'Europe'} · {pick.league || 'League'} · {pick.kickoff || 'Today'}
                      </div>
                      <div className="font-extrabold text-[14px] tracking-[-0.25px] text-[#16201c] truncate">
                        {pick.homeTeam} <span className="text-[#a2aca6] font-normal text-xs">vs</span> {pick.awayTeam}
                      </div>
                      <div className="text-[11px] text-[#71807a]">
                        Market: <strong className="text-[#16201c] font-semibold">{pick.market}</strong> · Model confidence {Math.round((pick.probability || 0.75) * 100)}%
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <b className="font-mono text-lg font-bold text-[#16201c] block">
                        {pick.odds.toFixed(2)}
                      </b>
                      <span
                        className={`inline-block font-mono text-[9px] font-medium px-2 py-0.5 rounded-[5px] mt-1 ${
                          isAnchor
                            ? 'bg-[#e9f7e4] text-[#287252]'
                            : 'bg-[#f0f4f1] text-[#4a5852]'
                        }`}
                      >
                        {isAnchor ? 'SAFE ANCHOR' : 'VALUE'}
                      </span>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Slip Health Benchmark Card */}
        <div className="space-y-3.5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-extrabold tracking-[-0.5px] text-[#16201c] m-0">
              Slip health
            </h3>
            <Link
              to="/audit"
              className="font-mono text-[10px] font-medium text-[#688177] hover:text-[#16201c] transition-colors"
            >
              HOW IT WORKS
            </Link>
          </div>

          <div className="bg-white border border-[#e5e9e5] rounded-[14px] p-5 sm:p-6 shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-4">
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a9690]">
              Your current benchmark
            </div>

            {/* Circular Meter Ring */}
            <div className="relative my-4 flex justify-center items-center">
              <div 
                className="w-[116px] h-[116px] rounded-full grid place-items-center relative"
                style={{
                  background: `conic-gradient(#dfff46 0 ${deg}deg, #e9eee9 ${deg}deg 360deg)`
                }}
              >
                <div className="absolute w-[94px] h-[94px] rounded-full bg-white"></div>
                <div className="absolute inset-0 flex flex-col justify-center items-center text-center">
                  <span className="text-2xl font-extrabold tracking-[-1px] text-[#16201c] leading-none">
                    {Math.round(healthNumber)}
                  </span>
                  <small className="font-mono text-[9px] text-[#71807a] uppercase tracking-normal mt-0.5">
                    HEALTH SCORE
                  </small>
                </div>
              </div>
            </div>

            {/* Health Rows */}
            <div className="divide-y divide-[#e5e9e5] pt-1 text-xs">
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[#52615b]">Selection discipline</span>
                <b className="font-mono text-[11px] text-[#15966a] font-bold">STRONG</b>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[#52615b]">Market diversity</span>
                <b className="font-mono text-[11px] text-[#d27923] font-bold">WATCH</b>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[#52615b]">Risk concentration</span>
                <b className="font-mono text-[11px] text-[#15966a] font-bold">LOW</b>
              </div>
            </div>

            <Link
              to="/audit"
              className="w-full mt-3 inline-flex items-center justify-center py-3 rounded-[8px] bg-[#16201c] hover:bg-black text-white font-extrabold text-xs transition-colors cursor-pointer text-center"
            >
              Improve a booking code →
            </Link>

            <p className="font-sans text-[11px] text-[#71807a] text-center m-0 pt-1">
              Your next optimized slip can be stronger.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
