import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import type { Slip } from '../types'

export function SavedSlipsPanel({ onLoadSlip }: { onLoadSlip: (slip: Slip) => void }) {
  const [savedSlips, setSavedSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSlipIds, setExpandedSlipIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  const toggleExpand = (slipId: string) => {
    setExpandedSlipIds((prev) => {
      const next = new Set(prev)
      if (next.has(slipId)) {
        next.delete(slipId)
      } else {
        next.add(slipId)
      }
      return next
    })
  }

  const handleDeleteSlip = async (slipId: string) => {
    if (!auth.currentUser) return
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'slips', slipId))
      setConfirmDeleteId(null)
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopySummary = (slip: Slip) => {
    const lines = [
      `ODDS FACTORY SLIP: ${slip.name || 'Accumulator Ticket'}`,
      `Combined Odds: ${slip.combinedOdds ? slip.combinedOdds.toFixed(2) : '1.00'}×`,
      `Survival Chance: ${Math.round(slip.survivalProbability || 70)}%`,
      `Selections (${slip.legs?.length || 0}):`,
      ...(slip.legs || []).map((leg, idx) =>
        `${idx + 1}. ${leg.matchLabel} — ${leg.market} @${Number(leg.odds).toFixed(2)}`
      ),
      '',
      'Generated with Odds Factory AI'
    ]
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(slip.id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {})
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  const getModeBadge = (mode?: string) => {
    switch (mode) {
      case 'single_acca':
        return { label: 'SURE ACCA', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
      case 'bank_pool':
        return { label: 'BANK POOL', color: 'bg-teal-50 text-teal-800 border-teal-200' }
      case 'night_midnight':
        return { label: 'MIDNIGHT', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' }
      default:
        return { label: 'MODEL-RANKED', color: 'bg-[#e9f7e4] text-[#287252] border-[#cce7c5]' }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans animate-in fade-in duration-200">
        <section className="space-y-2">
          <div className="font-mono text-[10px] uppercase font-bold tracking-[0.08em] text-[#84918a]">
            Ticket library
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-1.5px] text-[#16201c] leading-[1.12]">
            Saved tickets.
          </h2>
        </section>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-5 bg-zinc-200 rounded w-1/3"></div>
                <div className="h-6 bg-zinc-200 rounded w-20"></div>
              </div>
              <div className="h-4 bg-zinc-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans animate-in fade-in duration-200">
      {/* ── Page Intro ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="font-mono text-[10px] uppercase font-bold tracking-[0.08em] text-[#84918a]">
          Ticket library
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-1.5px] text-[#16201c] leading-[1.12]">
          Saved tickets.
        </h2>
        <p className="text-xs sm:text-sm text-[#71807a] max-w-xl leading-relaxed">
          Your saved accumulator tickets, verified selections, and model-ranked slips.
        </p>
      </section>

      {/* ── Section Title ───────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between pt-2">
        <h3 className="text-base font-extrabold tracking-[-0.5px] text-[#16201c]">
          Recent tickets
        </h3>
        <span className="font-mono text-[10px] font-medium text-[#688177]">
          {savedSlips.length} {savedSlips.length === 1 ? 'TICKET RECORDED' : 'TICKETS RECORDED'}
        </span>
      </div>

      {savedSlips.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#f7f8f4] text-[#84918a] flex items-center justify-center text-2xl border border-zinc-200">
            <i className="fa-solid fa-receipt" />
          </div>
          <h4 className="text-base font-extrabold text-[#16201c]">No saved tickets yet</h4>
          <p className="text-xs text-[#71807a] max-w-sm mx-auto leading-relaxed">
            Generate your first accumulator in the Acca Builder or audit a SportyBet booking code to save a ticket here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedSlips.map((slip) => {
            const isExpanded = expandedSlipIds.has(slip.id)
            const hasTraps = slip.droppedPicks && slip.droppedPicks.length > 0
            const healthScore = Math.round(slip.survivalProbability || 70)
            const badge = getModeBadge(slip.mode)

            const healthColor =
              healthScore >= 65
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : healthScore >= 40
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'

            return (
              <div
                key={slip.id}
                className="card overflow-hidden border border-[#e5e9e5] shadow-xs hover:border-[#ced7ce] transition-all bg-white"
              >
                {/* ── Main Ticket Header Row ──────────────────────────────────── */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm sm:text-base text-[#16201c]">
                        {slip.name || 'Accumulator Ticket'}
                      </span>
                      <span className={`inline-block font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                      {hasTraps && (
                        <span className="inline-block font-mono text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          {slip.droppedPicks?.length} TOXIC LEGS DROPPED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#71807a] flex-wrap">
                      <span className="font-medium text-[#16201c]">
                        {slip.legs?.length || 0} {(slip.legs?.length === 1 ? 'game' : 'games')}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-[#84918a]">
                        {formatDate(slip.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Right side stats and actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0f2ee]">
                    {/* Combined Odds */}
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-[#84918a] block font-mono uppercase tracking-wider">
                        Total Odds
                      </span>
                      <b className="font-mono font-black text-base sm:text-lg text-[#16201c]">
                        {slip.combinedOdds ? slip.combinedOdds.toFixed(2) : '1.00'}×
                      </b>
                    </div>

                    {/* Survival Score */}
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-[#84918a] block font-mono uppercase tracking-wider">
                        Survival
                      </span>
                      <span className={`inline-block font-mono font-black text-xs px-2.5 py-0.5 rounded-full border ${healthColor}`}>
                        {healthScore}%
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onLoadSlip(slip)}
                        className="px-3 py-1.5 rounded-lg bg-[#16201c] hover:bg-[#202d28] text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Load into Slip Auditor"
                      >
                        <span>Audit</span>
                        <i className="fa-solid fa-arrow-right text-[10px] text-[#dfff46]" />
                      </button>

                      <button
                        onClick={() => handleCopySummary(slip)}
                        className="p-1.5 px-2 rounded-lg border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer text-xs"
                        title="Copy slip summary"
                      >
                        <i className={`fa-solid ${copiedId === slip.id ? 'fa-check text-emerald-600' : 'fa-copy'}`} />
                      </button>

                      <button
                        onClick={() => setConfirmDeleteId(confirmDeleteId === slip.id ? null : slip.id)}
                        title="Delete ticket"
                        className="p-1.5 px-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-xs"
                      >
                        <i className="fa-regular fa-trash-can" />
                      </button>

                      <button
                        onClick={() => toggleExpand(slip.id)}
                        className="p-1.5 px-2 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer text-xs"
                        title={isExpanded ? 'Collapse selections' : 'Expand selections'}
                      >
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── In-UI Delete Confirmation ───────────────────────────────── */}
                {confirmDeleteId === slip.id && (
                  <div className="bg-rose-50 border-t border-rose-200 p-3 px-5 flex items-center justify-between text-xs text-rose-900 animate-in fade-in duration-150">
                    <span className="font-semibold flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation text-rose-600" />
                      Permanently delete this saved ticket?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteSlip(slip.id)}
                        disabled={isDeleting}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        {isDeleting ? 'Deleting…' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 bg-white border border-rose-300 text-zinc-700 font-semibold rounded-lg hover:bg-zinc-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Expanded Leg View ───────────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-[#e5e9e5] bg-[#fafbfa] p-4 sm:p-5 space-y-2.5 animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold text-[#84918a] uppercase tracking-wider font-mono">
                      Selections breakdown ({slip.legs?.length || 0})
                    </div>

                    {(!slip.legs || slip.legs.length === 0) ? (
                      <p className="text-xs text-zinc-500 italic py-2">
                        No individual leg details stored for this ticket.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#ecefe9] border border-[#e5e9e5] rounded-xl overflow-hidden bg-white">
                        {slip.legs.map((leg, idx) => {
                          const prob = Math.round(leg.probability > 1 ? leg.probability : leg.probability * 100)
                          const evVal = leg.ev !== undefined ? Number(leg.ev) : (leg.probability * leg.odds - 1)
                          const evText = evVal >= 0 ? `+${(evVal * 100).toFixed(1)}% EV` : `${(evVal * 100).toFixed(1)}% EV`

                          return (
                            <div
                              key={leg.id || idx}
                              className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#fbfcfb] transition-colors"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-black text-zinc-400">
                                    {idx + 1}.
                                  </span>
                                  <span className="text-xs font-bold text-[#16201c] truncate">
                                    {leg.matchLabel}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-600 pl-4 flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    {leg.market}
                                  </span>
                                  <span className="text-zinc-400 font-mono text-[10px]">
                                    Prob: {prob}%
                                  </span>
                                  <span className="text-zinc-400 font-mono text-[10px]">
                                    {evText}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 pl-4 sm:pl-0">
                                <span className="font-mono font-bold text-xs text-[#16201c] bg-zinc-100 px-2.5 py-1 rounded-lg">
                                  @{Number(leg.odds).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
