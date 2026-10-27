import { useEffect, useState, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import type { Slip } from '../types'

export function SavedSlipsPanel({ onLoadSlip }: { onLoadSlip: (slip: Slip) => void }) {
  const [savedSlips, setSavedSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all')

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false)
      return
    }

    const slipsRef = collection(db, 'users', auth.currentUser.uid, 'slips')
    const q = query(slipsRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const slipsData: Slip[] = []
        snapshot.forEach((d) => {
          slipsData.push({ id: d.id, ...d.data() } as Slip)
        })
        setSavedSlips(slipsData)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching slips:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const handleDeleteSlip = async (slipId: string) => {
    if (!auth.currentUser) return
    if (!confirm('Are you sure you want to delete this saved ticket?')) return
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'slips', slipId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete slip.')
    }
  }

  const handleUpdateStatus = async (slipId: string, newStatus: 'pending' | 'won' | 'lost') => {
    if (!auth.currentUser) return
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'slips', slipId), {
        status: newStatus,
        settledAt: newStatus !== 'pending' ? new Date().toISOString() : null,
      })
    } catch (err) {
      console.error('Failed to update ticket settlement:', err)
    }
  }

  // ── Metrics Calculation ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = savedSlips.length
    const won = savedSlips.filter((s) => s.status === 'won').length
    const lost = savedSlips.filter((s) => s.status === 'lost').length
    const settled = won + lost
    const winRate = settled > 0 ? Math.round((won / settled) * 100) : 0

    // Estimate P/L assuming flat 1 unit stake per ticket
    const netUnits = savedSlips.reduce((acc, s) => {
      if (s.status === 'won') return acc + (s.combinedOdds - 1)
      if (s.status === 'lost') return acc - 1
      return acc
    }, 0)

    const roi = settled > 0 ? Math.round((netUnits / settled) * 100) : 0

    return { total, won, lost, settled, winRate, netUnits: Number(netUnits.toFixed(2)), roi }
  }, [savedSlips])

  const filteredSlips = useMemo(() => {
    if (filter === 'all') return savedSlips
    return savedSlips.filter((s) => (s.status || 'pending') === filter)
  }, [savedSlips, filter])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#71807a]">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-3 text-[#183b2d]" />
        <p className="font-mono text-xs text-[#71807a]">Syncing optimization & settlement ledger…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans animate-in fade-in duration-200">
      {/* ── Page Intro ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="font-mono text-[10px] uppercase font-bold tracking-[0.08em] text-[#84918a]">
          Verified Ticket Ledger
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-1.5px] text-[#16201c] leading-[1.12]">
          Ticket history & performance.
        </h2>
        <p className="text-xs sm:text-sm text-[#71807a] max-w-xl leading-relaxed">
          Audit your model-ranked tickets, record actual outcomes, and measure verified return on investment (ROI).
        </p>
      </section>

      {/* ── Performance Metrics Ledger ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#84918a] block mb-1">
            Settled Strike Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-extrabold text-2xl text-[#16201c]">{metrics.winRate}%</span>
            <span className="text-[11px] font-mono text-[#71807a]">({metrics.won}W / {metrics.lost}L)</span>
          </div>
        </div>

        <div className="card p-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#84918a] block mb-1">
            Net Return (Units)
          </span>
          <span className={`font-mono font-extrabold text-2xl ${metrics.netUnits >= 0 ? 'text-[#15966a]' : 'text-rose-600'}`}>
            {metrics.netUnits >= 0 ? '+' : ''}{metrics.netUnits}u
          </span>
        </div>

        <div className="card p-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#84918a] block mb-1">
            Realized Yield / ROI
          </span>
          <span className={`font-mono font-extrabold text-2xl ${metrics.roi >= 0 ? 'text-[#15966a]' : 'text-rose-600'}`}>
            {metrics.roi >= 0 ? '+' : ''}{metrics.roi}%
          </span>
        </div>

        <div className="card p-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#84918a] block mb-1">
            Total Tickets Tracked
          </span>
          <span className="font-mono font-extrabold text-2xl text-[#16201c]">{metrics.total}</span>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <div className="flex items-center gap-1.5 bg-[#eef1ec] p-1 rounded-xl">
          {(['all', 'pending', 'won', 'lost'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all capitalize cursor-pointer ${
                filter === tab
                  ? 'bg-white text-[#16201c] shadow-xs'
                  : 'text-[#71807a] hover:text-[#16201c]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <span className="font-mono text-[10px] font-medium text-[#688177]">
          {filteredSlips.length} {filteredSlips.length === 1 ? 'TICKET DISPLAYED' : 'TICKETS DISPLAYED'}
        </span>
      </div>

      {/* ── Tickets List ────────────────────────────────────────────────── */}
      {filteredSlips.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#f7f8f4] text-[#84918a] flex items-center justify-center text-xl">
            <i className="fa-regular fa-clock" />
          </div>
          <h4 className="text-sm font-extrabold text-[#16201c]">No tickets matching this filter</h4>
          <p className="text-xs text-[#71807a] max-w-sm mx-auto">
            {filter === 'all'
              ? 'Generate model-ranked picks in Acca Builder or audit a booking code to record your first ticket.'
              : `No tickets currently marked as ${filter}.`}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-[#e5e9e5] shadow-xs">
          {filteredSlips.map((slip) => {
            const hasTraps = slip.droppedPicks && slip.droppedPicks.length > 0
            const healthScore = Math.round(slip.survivalProbability || 74)
            const status = slip.status || 'pending'

            return (
              <div
                key={slip.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fbfcf9] transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm sm:text-base text-[#16201c]">
                      {slip.name || 'Accumulator Ticket'}
                    </span>
                    <span className="inline-block font-mono text-[9px] font-semibold px-2 py-0.5 rounded bg-[#e9f7e4] text-[#287252]">
                      {hasTraps ? 'OPTIMIZED' : 'MODEL-RANKED'}
                    </span>
                  </div>
                  <div className="text-xs text-[#71807a]">
                    <span>{slip.legs?.length || 0} selections</span>
                    {hasTraps && (
                      <span className="ml-2 text-rose-600 font-semibold">
                        • {slip.droppedPicks?.length} weak link{slip.droppedPicks && slip.droppedPicks.length > 1 ? 's' : ''} removed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 flex-wrap">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-[#84918a] block font-mono">Odds</span>
                    <b className="font-mono font-bold text-sm text-[#16201c]">
                      {slip.combinedOdds ? slip.combinedOdds.toFixed(2) : '1.00'}×
                    </b>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-[#84918a] block font-mono">Health</span>
                    <b className="font-mono font-bold text-sm text-[#15966a]">
                      {healthScore}
                    </b>
                  </div>

                  {/* Outcome Status Dropdown / Button */}
                  <div className="flex items-center gap-1.5 bg-[#f5f7f4] border border-[#e4e9e3] p-1 rounded-xl">
                    {(['pending', 'won', 'lost'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleUpdateStatus(slip.id, s)}
                        className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all capitalize cursor-pointer ${
                          status === s
                            ? s === 'won'
                              ? 'bg-[#15966a] text-white shadow-xs'
                              : s === 'lost'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-[#16201c] text-[#dfff46] shadow-xs'
                            : 'text-[#71807a] hover:text-[#16201c]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onLoadSlip(slip)}
                      className="px-3 py-1.5 rounded-lg bg-[#16201c] hover:bg-[#202d28] text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Load</span>
                      <i className="fa-solid fa-arrow-right text-[10px] text-[#dfff46]" />
                    </button>
                    <button
                      onClick={() => handleDeleteSlip(slip.id)}
                      title="Delete ticket"
                      className="p-1.5 rounded-lg text-[#84918a] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <i className="fa-regular fa-trash-can text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
