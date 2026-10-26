import type { SlipLeg } from '../types'

interface Props {
  leg: SlipLeg
  index: number
  onRemove?: () => void
}

export function SlipLegRow({ leg, index, onRemove }: Props) {
  const parts = leg.matchLabel.split(' vs ')
  const home = parts[0] || leg.matchLabel
  const away = parts[1] || ''

  return (
    <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:bg-[#fafbfa] transition-colors border-b border-[#e5e9e3] last:border-b-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#16201c] text-[#dfff46] inline-grid place-items-center text-[10px] font-mono font-bold shrink-0">
            {index + 1}
          </span>
          <span className="text-[10px] font-mono text-[#84918a] tracking-wider uppercase font-semibold">
            {leg.sport || 'FOOTBALL'}
          </span>
        </div>

        <div className="text-base font-extrabold text-[#16201c] tracking-tight">
          {away ? (
            <>
              {home} <span className="text-[#84918a] font-normal text-xs">vs</span> {away}
            </>
          ) : (
            leg.matchLabel
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-[#53625b]">
          <span className="font-extrabold text-[#16201c]">{leg.market}</span>
          <span>·</span>
          <span className="text-emerald-700 font-bold">{leg.probability.toFixed(0)}% Probability</span>

          {leg.wasSwapped && leg.previousMarket && (
            <span className="pill text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
              <i className="fa-solid fa-arrow-right-arrow-left text-[9px] mr-1" />
              Swapped from {leg.previousMarket}
            </span>
          )}
          {leg.wasSwapped === false && (
            <span className="pill text-[10px] bg-[#e9f7e4] text-[#1d5d3d] border border-[#b9e5b7]">
              ✓ Optimal selection
            </span>
          )}
        </div>

        {leg.rationale && (
          <p className="text-xs text-[#71807a] leading-relaxed font-normal pt-0.5">
            {leg.rationale}
          </p>
        )}
      </div>

      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1.5 shrink-0">
        <div className="font-mono font-extrabold text-xl text-[#16201c]">
          {leg.odds.toFixed(2)}x
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="chip py-1 px-2.5 text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50"
            title="Drop this pick from ticket"
          >
            <i className="fa-solid fa-trash-can text-[10px] mr-1" />
            Drop
          </button>
        )}
      </div>
    </div>
  )
}
