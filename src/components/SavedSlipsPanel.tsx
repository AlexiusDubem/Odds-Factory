import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import type { Slip } from '../types'

export function SavedSlipsPanel({ onLoadSlip }: { onLoadSlip: (slip: Slip) => void }) {
  const [savedSlips, setSavedSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth.currentUser) { setLoading(false); return }

    const slipsRef = collection(db, 'users', auth.currentUser.uid, 'slips')
    const q = query(slipsRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slipsData: Slip[] = []
      snapshot.forEach((doc) => {
        slipsData.push({ id: doc.id, ...doc.data() } as Slip)
      })
      setSavedSlips(slipsData)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching slips:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleDeleteSlip = async (slipId: string) => {
    if (!auth.currentUser) return
    if (!confirm('Are you sure you want to delete this saved slip?')) return
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'slips', slipId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete slip.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-4 text-emerald-500" />
        <p className="text-sm font-medium text-zinc-500">Loading saved accumulators...</p>
      </div>
    )
  }

  if (savedSlips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-zinc-200/80 p-10 max-w-2xl mx-auto shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center text-3xl text-zinc-400 mb-5">
          <i className="fa-solid fa-receipt" />
        </div>
        <h2 className="text-xl font-black text-zinc-900 tracking-tight mb-2">No Saved Accumulators</h2>
        <p className="text-sm text-zinc-500 max-w-md mb-6 leading-relaxed">
          You haven't saved any optimized booking codes yet. Generate or load a ticket in the Acca Builder or Slip Editor to begin.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Saved Slips & Vault</h2>
          <p className="text-xs text-zinc-500 font-medium">Archive of your audited and optimized accumulators</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700">
          <i className="fa-solid fa-layer-group text-zinc-400" />
          <span>{savedSlips.length} tickets</span>
        </div>
      </div>

      <div className="grid gap-3.5">
        {savedSlips.map((slip) => (
          <div key={slip.id} className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm hover:border-zinc-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-zinc-900 text-lg tracking-wider">{slip.name}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-600 border border-zinc-200 flex items-center gap-1.5">
                  <i className="fa-solid fa-list-check text-zinc-400 text-[10px]" />
                  {slip.legs.length} legs
                </span>
                {slip.droppedPicks && slip.droppedPicks.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-[11px] font-bold text-red-600 border border-red-200 flex items-center gap-1">
                    <i className="fa-solid fa-shield-virus text-[10px]" />
                    {slip.droppedPicks.length} traps dropped
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
                <span>
                  Survival Probability:{' '}
                  <strong className={slip.survivalProbability >= 60 ? 'text-emerald-600 font-bold' : slip.survivalProbability >= 40 ? 'text-amber-600 font-bold' : 'text-red-500 font-bold'}>
                    {slip.survivalProbability.toFixed(1)}%
                  </strong>
                </span>
                <span className="text-zinc-300">•</span>
                <span>
                  Odds: <strong className="text-zinc-900 font-bold">{slip.combinedOdds.toFixed(2)}x</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button 
                onClick={() => onLoadSlip(slip)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                <span>Load in Auditor</span>
              </button>
              <button 
                onClick={() => handleDeleteSlip(slip.id)}
                className="px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-400 font-semibold transition-colors border border-zinc-200"
                title="Delete Slip"
              >
                <i className="fa-solid fa-trash-can text-xs" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
