import type { SmartDropResult } from '../engine/smartDropping'

interface Props {
  smartDropResult: SmartDropResult | null;
  onApplyDrops: (legIds: string[]) => void;
  onCancel: () => void;
}

export function WeakLinkDetector({ smartDropResult, onApplyDrops, onCancel }: Props) {
  if (!smartDropResult || smartDropResult.droppedLegs.length === 0) return null;

  return (
    <div className="card p-5 sm:p-6 border border-rose-200 bg-[#fffdfd] rounded-2xl shadow-xs mb-6 animate-in fade-in slide-in-from-top-3 duration-300 font-sans space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-rose-100">
        <div>
          <div className="eyebrow flex items-center gap-1.5 text-rose-700">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>Ticket Survival Hazard</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#16201c] tracking-tight mt-0.5">
            Weak Link Audit
          </h3>
        </div>
        <span className="pill text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          {smartDropResult.droppedLegs.length} High-Risk Legs Flagged
        </span>
      </div>

      <p className="text-xs text-[#71807a] leading-relaxed">
        The statistical pipeline identified the following selections as having negative expected value or excessive volatility. Dropping them protects your ticket chance.
      </p>

      <div className="space-y-2.5">
        {smartDropResult.droppedLegs.map((drop, idx) => (
          <div
            key={drop.legId}
            className="p-3.5 bg-white border border-[#e4e9e3] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold text-xs inline-grid place-items-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="space-y-0.5">
                <h4 className="font-extrabold text-[#16201c] text-sm">{drop.matchLabel}</h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-rose-700">{drop.market}</span>
                  <span className="text-[#84918a]">·</span>
                  <span className="font-mono text-[#71807a]">EV: {drop.ev >= 0 ? `+${drop.ev.toFixed(2)}` : drop.ev.toFixed(2)}</span>
                </div>
                <p className="fine leading-relaxed">
                  {drop.rationale}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right sm:border-l sm:border-[#e4e9e3] sm:pl-4">
              <span className="text-[10px] font-mono text-[#84918a] uppercase block">Volatility</span>
              <span className="font-mono font-bold text-sm text-rose-600">
                {Math.round(drop.volatility * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="result-bar flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="eyebrow">Ticket Projection After Drop</div>
          <div className="flex items-center gap-4 text-xs font-mono mt-1">
            <div>
              <span className="text-[#84918a] block text-[10px]">Original Odds</span>
              <span className="line-through text-[#71807a]">
                {(smartDropResult.optimizedSlip.combinedOdds + smartDropResult.droppedLegs.reduce((a, b) => a + b.oddsReduction, 0)).toFixed(2)}x
              </span>
            </div>
            <i className="fa-solid fa-arrow-right text-[#84918a]"></i>
            <div>
              <span className="text-[#84918a] block text-[10px]">Optimized Odds</span>
              <b className="text-emerald-800 text-base">{smartDropResult.optimizedSlip.combinedOdds.toFixed(2)}x</b>
            </div>
            <div className="border-l border-[#dbe8d6] pl-4">
              <span className="text-[#84918a] block text-[10px]">Estimated Win Probability Boost</span>
              <b className="text-emerald-800 text-base">+{Math.round(smartDropResult.droppedLegs.reduce((a, b) => a + b.sspIncrease, 0) * 100)}%</b>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onCancel}
            className="chip font-bold text-xs flex-1 sm:flex-none justify-center"
          >
            Keep All Legs
          </button>
          <button
            onClick={() => onApplyDrops(smartDropResult.droppedLegs.map((l) => l.legId))}
            className="primary py-2 px-4 text-xs font-bold flex-1 sm:flex-none flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-scissors text-lime text-xs"></i>
            <span>Drop Weak Legs</span>
          </button>
        </div>
      </div>
    </div>
  )
}
