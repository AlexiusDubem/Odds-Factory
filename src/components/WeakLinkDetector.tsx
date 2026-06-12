import type { SmartDropResult } from '../engine/smartDropping'

interface Props {
  smartDropResult: SmartDropResult | null;
  onApplyDrops: (legIds: string[]) => void;
  onCancel: () => void;
}

export function WeakLinkDetector({ smartDropResult, onApplyDrops, onCancel }: Props) {
  if (!smartDropResult || smartDropResult.droppedLegs.length === 0) return null;

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-link-slash text-red-500"></i> Weak Link Detector™
        </h3>
        <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
          {smartDropResult.droppedLegs.length} Picks Flagged
        </span>
      </div>

      <p className="text-sm text-slate-600 mb-6">
        The AI has identified the following picks as mathematically toxic to your ticket's survival probability. 
        Dropping them drastically improves your slip.
      </p>

      <div className="space-y-4 mb-6">
        {smartDropResult.droppedLegs.map((drop, idx) => {
          // We need the original legs passed in, or just map them from the original slip.
          // For now, assume the legId matches the UI.
          return (
            <div key={drop.legId} className="bg-white border border-red-100 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Pick Threat Level: <span className="text-red-500">CRITICAL</span></h4>
                  <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-robot text-slate-400"></i> {drop.rationale}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto text-center md:text-left bg-slate-50 rounded-lg p-2 md:p-0 md:bg-transparent">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">EV</div>
                  <div className="text-sm font-bold text-red-500">{drop.ev.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Volatility</div>
                  <div className="text-sm font-bold text-amber-500">{Math.round(drop.volatility * 100)}%</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Ticket Compare</div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-slate-400">Original Odds</div>
              <div className="text-lg font-bold text-slate-700 line-through">{(smartDropResult.optimizedSlip.combinedOdds + smartDropResult.droppedLegs.reduce((a,b)=>a+b.oddsReduction,0)).toFixed(2)}</div>
            </div>
            <i className="fa-solid fa-arrow-right text-slate-300"></i>
            <div>
              <div className="text-xs text-emerald-600 font-bold">Optimized Odds</div>
              <div className="text-xl font-black text-emerald-600">{smartDropResult.optimizedSlip.combinedOdds.toFixed(2)}</div>
            </div>
            <div className="border-l border-slate-200 pl-6 hidden sm:block">
              <div className="text-xs text-blue-600 font-bold">Win Probability Lift</div>
              <div className="text-xl font-black text-blue-600">+{Math.round(smartDropResult.droppedLegs.reduce((a,b)=>a+b.sspIncrease,0) * 100)}%</div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors w-full md:w-auto">
            Dismiss
          </button>
          <button 
            onClick={() => onApplyDrops(smartDropResult.droppedLegs.map(l => l.legId))}
            className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-md shadow-red-500/20 w-full md:w-auto flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-scissors"></i> Drop Weak Links
          </button>
        </div>
      </div>
    </div>
  )
}
