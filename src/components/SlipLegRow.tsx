import type { SlipLeg } from '../types'
interface Props {
  leg: SlipLeg
  index: number
  onRemove?: () => void
}

const PROFILE_LABELS: Record<string, string> = {
  high_goal: 'High Goal Expectancy',
  low_goal: 'Low Goal Expectancy',
  controlled: 'Tactical Match',
  chaos: 'High Volatility',
  balanced: 'Balanced Matchup',
  high_scoring: 'High Scoring',
  low_scoring: 'Low Scoring',
  controlled_favorite: 'Strong Favorite',
  volatile: 'Volatile',
  even_matchup: 'Even Matchup',
  generic_favorite: 'Favorite',
  generic_underdog: 'Underdog',
  generic_balanced: 'Balanced',
  generic_volatile: 'Volatile',
}

export function SlipLegRow({ leg, index, onRemove }: Props) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border group hover:bg-surface-hover transition-colors">
      {/* Index */}
      <span className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 mt-0.5">
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        {/* Match label */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{leg.matchLabel}</span>
        </div>

        {/* Market + odds + probability */}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-accent font-semibold text-sm">{leg.market}</span>
          <span className="text-slate-800 font-bold text-sm">@{leg.odds.toFixed(2)}</span>
          <span className="text-emerald-600 font-bold text-xs">{leg.probability.toFixed(1)}% Win Prob</span>

          {/* Swap indicator */}
          {leg.wasSwapped && leg.previousMarket && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <i className="fa-solid fa-arrow-right-arrow-left text-[9px]" />
              <span className="line-through opacity-60">{leg.previousMarket}</span>
            </span>
          )}
          {leg.wasSwapped === false && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <i className="fa-solid fa-check text-[9px]" />
              Optimal
            </span>
          )}
        </div>

        {/* Rationale */}
        <p className="text-xs text-slate-500 font-medium mt-1.5 line-clamp-2 leading-relaxed">
          <i className="fa-solid fa-robot text-accent/70 mr-1"></i> {leg.rationale}
        </p>
      </div>

      {/* Remove button — visible on hover */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-danger transition-all p-2 shrink-0"
          title="Remove leg"
        >
          <i className="fa-solid fa-trash text-xs" />
        </button>
      )}
    </div>
  )
}