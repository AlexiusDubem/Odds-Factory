import { useCallback, useState, useEffect } from 'react'
import type { Slip } from './types'
import { sampleMatches } from './data/sampleMatches'
import { SlipEditorPanel } from './components/SlipEditorPanel'

type Tab = 'edit'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'edit', label: 'Optimize Booking Code', icon: 'fa-solid fa-wand-magic-sparkles' },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('edit')
  const [slips, setSlips] = useState<Slip[]>([])
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2000)
    return () => clearTimeout(t)
  }, [])

  const handleSlipUpdated = useCallback((slip: Slip) => {
    setSlips((prev) => prev.map((s) => (s.id === slip.id ? slip : s)))
  }, [])

  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
           <img src="/logo.png" className="w-[150vw] h-auto object-cover blur-sm" alt="" />
        </div>
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
           <img src="/logo.png" className="w-24 h-24 object-contain animate-pulse mb-6 drop-shadow-2xl bg-white rounded-2xl p-2" alt="Odds Factory" />
           <h1 className="text-2xl sm:text-3xl font-black text-white tracking-[0.2em] uppercase font-sans mb-2">Odds Factory</h1>
           <p className="text-accent text-xs sm:text-sm font-bold tracking-widest uppercase">Initializing Engine...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface-elevated/90 backdrop-blur sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="Odds Factory" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Odds Factory</h1>
                <p className="text-xs text-slate-500">
                  Smart Booking Code Optimization
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-sm text-slate-500">
              <i className="fa-solid fa-bolt text-warning"></i>
              <span>Ready to Optimize</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-surface sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent/15 text-accent'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-surface-hover'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {activeTab === 'edit' && (
          <SlipEditorPanel
            matches={sampleMatches}
            slips={slips}
            setSlips={setSlips}
            onSlipUpdated={handleSlipUpdated}
          />
        )}
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-slate-500 bg-surface">
        Odds Factory Logic — June 2026 · Auto-optimization for SportyBet codes
      </footer>
    </div>
  )
}

export default App
