import React from 'react'

export interface PunterDna {
  playstyle: 'banker' | 'goals' | 'corners' | 'winner' | 'all'
  preferredLeague: 'ucl_major' | 'all'
  targetProfile: 'safe' | 'balanced' | 'daring'
  completed: boolean
}

export const DEFAULT_PUNTER_DNA: PunterDna = {
  playstyle: 'banker',
  preferredLeague: 'ucl_major',
  targetProfile: 'safe',
  completed: false,
}

interface Props {
  isOpen: boolean
  currentDna: PunterDna
  onSave: (dna: PunterDna) => void
  onClose: () => void
}

export function PunterKycModal({ isOpen, currentDna, onSave, onClose }: Props) {
  const [dna, setDna] = React.useState<PunterDna>(currentDna)

  if (!isOpen) return null

  const handleSave = () => {
    const updated: PunterDna = { ...dna, completed: true }
    try {
      localStorage.setItem('odds_factory_punter_dna', JSON.stringify(updated))
    } catch {}
    onSave(updated)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-200 font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Punter DNA · Personalized Betting Profile
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-zinc-950 tracking-tight">
              What kind of games do you like to bet?
            </h2>
            <p className="text-xs text-zinc-500">
              Tell the intelligence engine your betting style so it tailors predictions to your favorite markets and competitions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Question 1: Betting Playstyle */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-zinc-800 uppercase font-mono tracking-wider">
            1. Your Primary Market Strategy
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                id: 'banker',
                title: '🛡️ The Safe Banker',
                desc: 'Double Chance (1X/X2), 2UP Early Payout, Over 1.5 Goals. Maximum survival.',
              },
              {
                id: 'goals',
                title: '⚽ The Goal Hunter',
                desc: 'Over 2.5 Goals & Both Teams to Score (GG). High scoring action.',
              },
              {
                id: 'corners',
                title: '🚩 Corner Specialist',
                desc: 'Over 7.5, 8.5, 9.5 Corners. Set-piece pressure without match-winner sweat.',
              },
              {
                id: 'winner',
                title: '🎯 Straight Wins & 2UP',
                desc: 'Match Winners (1X2) & 2UP Early Payout for high-confidence favorites.',
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDna({ ...dna, playstyle: opt.id as any })}
                className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                  dna.playstyle === opt.id
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="font-bold text-xs text-zinc-900">{opt.title}</div>
                <div className="text-[11px] text-zinc-500 mt-1 leading-snug">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Question 2: Competition Focus */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-zinc-800 uppercase font-mono tracking-wider">
            2. League Preference
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                id: 'ucl_major',
                title: '🏆 Champions League & Elite',
                desc: 'UCL, Europa League, EPL, La Liga, Serie A, Bundesliga, Ligue 1 only.',
              },
              {
                id: 'all',
                title: '🌍 All Professional Leagues',
                desc: 'Include Championship, Eredivisie, Primeira Liga, MLS, and top global tiers.',
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDna({ ...dna, preferredLeague: opt.id as any })}
                className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                  dna.preferredLeague === opt.id
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="font-bold text-xs text-zinc-900">{opt.title}</div>
                <div className="text-[11px] text-zinc-500 mt-1 leading-snug">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Question 3: Odds & Multiplier Target */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-zinc-800 uppercase font-mono tracking-wider">
            3. Target Multiplier
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'safe', label: '2x – 4x Multiplier', sub: '3–4 Solid Legs' },
              { id: 'balanced', label: '5x – 10x Multiplier', sub: '5–6 Balanced Legs' },
              { id: 'daring', label: '15x – 30x Multiplier', sub: '8–12 Big Return' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDna({ ...dna, targetProfile: opt.id as any })}
                className={`p-2.5 text-center rounded-xl border transition-all cursor-pointer ${
                  dna.targetProfile === opt.id
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="font-bold text-xs text-zinc-900">{opt.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs shadow-xs cursor-pointer flex items-center gap-2"
          >
            <i className="fa-solid fa-check text-emerald-400" />
            <span>Save Punter Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
