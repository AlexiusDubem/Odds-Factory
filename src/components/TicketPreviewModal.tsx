import type { Slip } from '../types'

interface Props {
  slip: Slip
  onClose: () => void
}

export function TicketPreviewModal({ slip, onClose }: Props) {
  // Suggest a simple unit-based stake
  const stakeSuggestion = Math.max(1, Math.round((slip.survivalProbability / 100) * 5))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header / Branding */}
        <div className="bg-slate-900 p-5 flex items-center justify-between shrink-0 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl -mr-10 -mt-10" />
          
          <div className="flex items-center gap-3 relative z-10">
            <img src="/logo.png" alt="Odds Factory" className="w-10 h-10 object-contain drop-shadow-md bg-white rounded-md p-1" />
            <div>
              <h2 className="text-lg font-black tracking-wider text-white uppercase font-sans">Odds Factory</h2>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Verified Ticket</p>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 text-slate-400 hover:text-white transition-colors p-2">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        {/* Ticket Body with Watermark */}
        <div className="flex-1 overflow-y-auto p-0 relative bg-slate-50">
          {/* Watermark Logo */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] overflow-hidden">
            <img src="/logo.png" alt="" className="w-96 h-96 object-contain rotate-[-15deg] grayscale" />
          </div>

          <div className="p-5 space-y-3 relative z-10">
            {slip.legs.map((leg) => (
              <div key={leg.id} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                <div className="flex justify-between items-start gap-2 ml-1">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{leg.sport}</p>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{leg.matchLabel}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-black">
                      EV: {leg.ev.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mt-1 ml-1 border border-slate-100">
                  <span className="text-sm font-bold text-accent">{leg.market}</span>
                  <span className="text-sm font-black text-slate-900">@{leg.odds.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Summary */}
        <div className="bg-white p-5 border-t border-slate-200 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Odds</p>
              <p className="text-xl font-black text-accent">{slip.combinedOdds.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Win Prob</p>
              <p className="text-xl font-black text-emerald-600">{slip.survivalProbability < 0.1 ? '<0.1' : slip.survivalProbability.toFixed(1)}%</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
            <span className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <i className="fa-solid fa-coins text-indigo-500" /> Stake Suggestion
            </span>
            <span className="text-sm font-black text-indigo-700">{stakeSuggestion} Unit{stakeSuggestion > 1 ? 's' : ''}</span>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all shadow-md active:scale-[0.98]"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}
