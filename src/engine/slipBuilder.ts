import type { Match, Slip, SlipLeg, SlipMode } from '../types'
import { analyzeMatch } from './markets'

const MAX_LEGS: Record<SlipMode, number> = {
  single_acca: 15,
  bank_pool: 8,
  night_midnight: 12,
}

const MIN_LEGS = 3

function legFromMatch(match: Match, preferConservative: boolean): SlipLeg | null {
  const analysis = analyzeMatch(match)
  if (analysis.recommendations.length === 0) return null

  let pick = analysis.recommendations[0]

  if (preferConservative) {
    const conservative = analysis.recommendations.find(
      (r) =>
        r.tier === 1 ||
        r.market.includes('Under') ||
        r.market.includes('Home or Draw') ||
        r.market.includes('Both Halves')
    )
    if (conservative) pick = conservative
  }

  return {
    id: crypto.randomUUID(),
    matchId: match.id,
    matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
    sport: match.sport,
    profile: analysis.profile,
    market: pick.market,
    odds: pick.odds,
    probability: pick.probability,
    ev: pick.ev,
    tier: pick.tier,
    rationale: pick.rationale,
  }
}

function ensureVariety(legs: SlipLeg[]): SlipLeg[] {
  const marketTypes = new Set<string>()
  return legs.map((leg) => {
    const type = leg.market.includes('Over')
      ? 'over'
      : leg.market.includes('Under')
        ? 'under'
        : leg.market.includes('Spread') || leg.market.includes('Asian')
          ? 'handicap'
          : leg.market.includes('Draw') || leg.market.includes('Moneyline')
            ? 'result'
            : 'other'

    if (marketTypes.has(type) && legs.length > 5) {
      return leg
    }
    marketTypes.add(type)
    return leg
  })
}

export function buildSlip(
  matches: Match[],
  mode: SlipMode,
  name: string,
  stakePercent = 1.5
): Slip | null {
  const preferConservative = mode === 'night_midnight'
  const maxLegs = MAX_LEGS[mode]

  const legs: SlipLeg[] = []
  const usedMatchIds = new Set<string>()

  const sortedMatches = [...matches].sort((a, b) => {
    const aAnalysis = analyzeMatch(a)
    const bAnalysis = analyzeMatch(b)
    const aProb = aAnalysis.recommendations[0]?.probability ?? 0
    const bProb = bAnalysis.recommendations[0]?.probability ?? 0
    return bProb - aProb
  })

  for (const match of sortedMatches) {
    if (legs.length >= maxLegs) break
    if (usedMatchIds.has(match.id)) continue

    const leg = legFromMatch(match, preferConservative)
    if (!leg || leg.tier === 3) continue

    legs.push(leg)
    usedMatchIds.add(match.id)
  }

  if (legs.length < MIN_LEGS) return null

  const variedLegs = ensureVariety(legs)
  const combinedOdds = variedLegs.reduce((acc, leg) => acc * leg.odds, 1)
  const survivalProbability = variedLegs.reduce(
    (acc, leg) => acc * (leg.probability / 100),
    1
  )

  return {
    id: crypto.randomUUID(),
    name,
    mode,
    legs: variedLegs,
    combinedOdds,
    survivalProbability: survivalProbability * 100,
    createdAt: new Date().toISOString(),
    stakePercent,
  }
}

export function splitIntoBankPool(
  matches: Match[],
  poolSize = 8,
  stakePercent = 1.5
): Slip[] {
  const slips: Slip[] = []
  const chunks: Match[][] = []

  for (let i = 0; i < matches.length; i += poolSize) {
    chunks.push(matches.slice(i, i + poolSize))
  }

  chunks.forEach((chunk, index) => {
    const slip = buildSlip(chunk, 'bank_pool', `Bank Pool ${index + 1}`, stakePercent)
    if (slip) slips.push(slip)
  })

  return slips
}