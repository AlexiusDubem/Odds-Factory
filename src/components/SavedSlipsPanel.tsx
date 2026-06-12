import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import type { Slip } from '../types'

export function SavedSlipsPanel({ onLoadSlip }: { onLoadSlip: (slip: Slip) => void }) {
  const [savedSlips, setSavedSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth.currentUser) return

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
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-4" />
        <p>Loading your saved slips...</p>
      </div>
    )
  }

  if (savedSlips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl text-slate-300 mb-6">
          <i className="fa-regular fa-folder-open" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Saved Slips</h2>
        <p className="text-sm text-slate-500 text-center max-w-sm">
          You haven't saved any optimized booking codes yet. Head over to the editor to optimize and save your first ticket!
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-4">
      <h2 className="text-2xl font-bold text-slate-900 px-2">Your Saved Slips</h2>
      <div className="grid gap-4">
        {savedSlips.map((slip) => (
          <div key={slip.id} className="bg-white rounded-2xl p-5 border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold text-slate-900 text-lg tracking-widest">{slip.name}</span>
                <span className="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600 font-semibold border border-slate-200">
                  {slip.legs.length} legs
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Survival: <strong className={slip.survivalProbability >= 60 ? 'text-emerald-600' : slip.survivalProbability >= 40 ? 'text-amber-500' : 'text-red-500'}>{slip.survivalProbability.toFixed(1)}%</strong>
                {' · '} Combined Odds: <strong className="text-accent">{slip.combinedOdds.toFixed(2)}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => onLoadSlip(slip)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-sm transition-colors border border-slate-200"
              >
                View Details
              </button>
              <button 
                onClick={() => handleDeleteSlip(slip.id)}
                className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 font-semibold transition-colors border border-red-100"
                title="Delete Slip"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
