import type { ConfidenceTier, Match, MatchProfile } from '../types'

const BASE_PROBABILITIES: Record<string, Record<string, number>> = {
  football: {
    high_goal: 72,
    low_goal: 70,
    controlled: 68,
    chaos: 63,
    balanced: 65,
  },
  basketball: {
    high_scoring: 70,
    low_scoring: 69,
    controlled_favorite: 67,
    volatile: 62,
    even_matchup: 64,
  },
  generic: {
    generic_favorite: 68,
    generic_underdog: 63,
    generic_balanced: 65,
    generic_volatile: 62,
  }
}

const MARKET_ADJUSTMENTS: Record<string, number> = {
  'Over 1.5': 1,
  'Both Halves Under 1.5 Yes': 1,
  'Under 2.5': 1,
  'Home or Draw': 1,
  'Asian Handicap -0.5': 1,
  'Asian Handicap +0.5': 1,
  'Draw No Bet': 1,
  'BTTS Yes': 0,
  'Over 2.5': 0,
  'Over Total Points': 1,
  'Under Total Points': 1,
  'Spread on Favorite': 1,
  'Moneyline (Favorite)': 0,
  'Spread on Underdog': 1,
  'Match Winner': 1,
  'Handicap': 1,
  'Over Total Games': 1,
  'Team Over': 0,
  'Team Under': 0,
}

export function estimateProbability(
  sport: string,
  profile: MatchProfile,
  market: string,
  match: Match,
  features: import('../types').ComputedFeatures
): number {
  const sportKey = sport.toLowerCase() === 'football' || sport.toLowerCase() === 'soccer' 
    ? 'football' 
    : sport.toLowerCase() === 'basketball' 
      ? 'basketball' 
      : 'generic'
      
  const base = BASE_PROBABILITIES[sportKey][profile as string] ?? 62
  const marketAdj = MARKET_ADJUSTMENTS[market] ?? 0

  let contextAdj = 0
  if (match.context.includes('friendly') || match.context.includes('youth')) {
    contextAdj -= 3
  }
  if (match.context.includes('playoffs')) {
    contextAdj -= 2
  }
  if (match.fatigue > 3) {
    contextAdj -= 2
  }
  if (match.injuries.length > 0) {
    contextAdj -= match.injuries.length
  }

  // ADVANCED ANALYTICAL LOGIC
  
  // H2H & Form Bonus
  const h2hAdvantage = features.h2hAdvantage ?? 50
  if (h2hAdvantage > 75) contextAdj += 6 // Extreme H2H dominance
  else if (h2hAdvantage > 60) contextAdj += 3 
  else if (h2hAdvantage < 25) contextAdj -= 6 // Extreme struggle
  else if (h2hAdvantage < 40) contextAdj -= 3

  const formMomentum = features.formMomentum ?? 50
  if (formMomentum > 80) contextAdj += 6 // Exceptional form
  else if (formMomentum > 65) contextAdj += 3
  else if (formMomentum < 20) contextAdj -= 6 // Terrible form
  else if (formMomentum < 35) contextAdj -= 3

  // Under 2.5 / Draw / Low Score correlations
  if (sportKey === 'football' && (market === 'Under 2.5' || market === 'Home or Draw' || market === 'Draw No Bet')) {
    const u25Signal = features.under25Signal ?? 50
    if (u25Signal > 80) contextAdj += 6 // Strong signal for tight defensive game
  }

  // BTTS / Over correlations
  if (sportKey === 'football' && (market === 'BTTS Yes' || market === 'Over 2.5' || market === 'Over 1.5')) {
    const bttsSignal = features.bttsSignal ?? 50
    if (bttsSignal > 80) contextAdj += 8 // High probability of both teams scoring
    else if (bttsSignal > 65) contextAdj += 4
    else if (bttsSignal < 35) contextAdj -= 5 // Defense is too solid or attack too weak
  }

  // AI Continuous Learning System Modifier
  const learningAdjustment = match.learningWeight ? (match.learningWeight - 50) / 10 : 0
  const clvAdjustment = match.clvErrorRate ? match.clvErrorRate * -0.5 : 0
  contextAdj += learningAdjustment + clvAdjustment

  if (features.dynamicMarketProb !== undefined) {
    return features.dynamicMarketProb
  }

  const fatigueBonus =
    market.includes('Under') || market.includes('Both Halves')
      ? Math.min(4, match.fatigue)
      : 0

  return Math.min(85, Math.max(50, base + marketAdj + contextAdj + fatigueBonus))
}

export function calculateEV(probability: number, odds: number): number {
  const probDecimal = probability / 100
  return probDecimal * odds - 1
}

export function getConfidenceTier(probability: number): ConfidenceTier {
  if (probability > 68) return 1
  if (probability >= 62) return 2
  return 3
}

export const MIN_PROBABILITY = 62

export function meetsMinimumProbability(probability: number): boolean {
  return probability >= MIN_PROBABILITY
}