import type { Slip } from '../types'

interface Props {
  slip: Slip
  onClose: () => void
}

export function TicketPreviewModal({ slip, onClose }: Props) {
  const stakeSuggestion = Math.max(1, Math.round((slip.survivalProbability / 100) * 5))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] border border-[#e4e9e3] font-sans">
        {/* Header / Branding */}
        <div className="p-4 sm:p-5 border-b border-[#e4e9e3] bg-[#fbfcf9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Odds Factory" className="w-8 h-8 object-contain rounded-lg shadow-2xs" />
            <div>
              <div className="eyebrow">Verified Ticket Ledger</div>
              <h2 className="text-base font-extrabold text-[#16201c] tracking-tight">{slip.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-[#f4f6f2] border border-[#e4e9e3] text-[#71807a] hover:text-[#16201c] flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Ticket Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#fbfcf9]">
          {slip.legs.map((leg, idx) => (
            <div
              key={leg.id}
              className="bg-white rounded-xl p-3.5 border border-[#e4e9e3] shadow-2xs flex flex-col gap-1.5"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-[10px] font-mono text-[#84918a] uppercase flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#16201c] text-[#dfff46] inline-grid place-items-center text-[9px] font-bold">
                      {idx + 1}
                    </span>
                    <span>{leg.sport || 'FOOTBALL'}</span>
                  </div>
                  <p className="text-sm font-extrabold text-[#16201c] mt-0.5">{leg.matchLabel}</p>
                </div>
                <span className="pill text-[10px] bg-[#f4f6f2] text-[#53625b] border border-[#e4e9e3]">
                  {leg.probability}% chance
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-[#f4f6f2]">
                <span className="text-xs font-extrabold text-[#183b2d]">{leg.market}</span>
                <span className="font-mono font-extrabold text-sm text-[#16201c]">@{leg.odds.toFixed(2)}x</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Summary */}
        <div className="p-4 sm:p-5 border-t border-[#e4e9e3] bg-white space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#fbfcf9] border border-[#e4e9e3] text-center">
              <span className="text-[10px] font-mono uppercase text-[#84918a] block">Combined Multiplier</span>
              <b className="text-xl font-mono font-extrabold text-[#16201c]">{slip.combinedOdds.toFixed(2)}x</b>
            </div>
            <div className="p-3 rounded-xl bg-[#fbfcf9] border border-[#e4e9e3] text-center">
              <span className="text-[10px] font-mono uppercase text-[#84918a] block">Ticket Survival Chance</span>
              <b className="text-xl font-mono font-extrabold text-emerald-800">
                {slip.survivalProbability < 0.1 ? '<0.1' : slip.survivalProbability.toFixed(1)}%
              </b>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-[#edf4e9] border border-[#dbe8d6] rounded-xl text-xs text-[#1d5d3d]">
            <span className="font-semibold flex items-center gap-1.5">
              <i className="fa-solid fa-coins text-[#183b2d]" /> Stake Recommendation:
            </span>
            <b className="font-bold">{stakeSuggestion} Unit{stakeSuggestion > 1 ? 's' : ''} (~₦{(stakeSuggestion * 500).toLocaleString()})</b>
          </div>

          <button
            onClick={onClose}
            className="primary w-full py-3 text-xs font-bold cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}
