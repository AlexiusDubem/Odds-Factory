import type { ConfidenceTier } from '../types'

const TIER_STYLES: Record<ConfidenceTier, string> = {
  1: 'bg-tier1/20 text-tier1 border-tier1/40',
  2: 'bg-tier2/20 text-tier2 border-tier2/40',
  3: 'bg-tier3/20 text-tier3 border-tier3/40',
}

const TIER_LABELS: Record<ConfidenceTier, string> = {
  1: 'Tier 1 — Safe Core',
  2: 'Tier 2 — Good',
  3: 'Tier 3 — Risky',
}

interface Props {
  tier: ConfidenceTier
  compact?: boolean
}

export function TierBadge({ tier, compact }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${TIER_STYLES[tier]}`}
    >
      {compact ? `T${tier}` : TIER_LABELS[tier]}
    </span>
  )
}