import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import type { Slip } from '../types'

export function SavedSlipsPanel({ onLoadSlip }: { onLoadSlip: (slip: Slip) => void }) {
  const [savedSlips, setSavedSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#71807a]">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-3 text-[#183b2d]" />
        <p className="font-mono text-xs text-[#71807a]">Syncing saved tickets…</p>
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
          Your saved analysis and model-ranked tickets, ordered by most recent.
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
        <div className="card p-10 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#f7f8f4] text-[#84918a] flex items-center justify-center text-xl">
            <i className="fa-regular fa-clock" />
          </div>
          <h4 className="text-sm font-extrabold text-[#16201c]">No saved tickets yet</h4>
          <p className="text-xs text-[#71807a] max-w-sm mx-auto">
            Generate sure picks in the Acca Builder or audit a booking code to save your first ticket.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-[#e5e9e5] shadow-xs">
          {savedSlips.map((slip) => {
            const hasTraps = slip.droppedPicks && slip.droppedPicks.length > 0
            const healthScore = Math.round(slip.survivalProbability || 74)

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

                <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
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
