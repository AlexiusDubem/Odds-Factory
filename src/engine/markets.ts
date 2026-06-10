import type {
  MarketRecommendation,
  Match,
  ProfileResult,
  MarketOdds
} from '../types'
import { profileMatch } from './profiling'
import {
  calculateEV,
  estimateProbability,
  getConfidenceTier,
  meetsMinimumProbability,
} from './probability'

interface MarketConfig {
  primary: string[]
  secondary: string[]
  avoid: string[]
}

const FOOTBALL_MARKETS: Record<string, MarketConfig> = {
  high_goal: {
    primary: ['Over 1.5', 'Over 2.5', 'Home or Draw', 'Away or Draw'],
    secondary: ['BTTS Yes', 'Draw No Bet', 'Over 0.5'],
    avoid: ['Pure Away', 'Under 1.5'],
  },
  low_goal: {
    primary: ['Under 2.5', 'Under 3.5', 'Both Halves Under 1.5 Yes', 'Home or Draw'],
    secondary: ['Under 4.5', 'Draw No Bet', 'Away or Draw'],
    avoid: ['Over 2.5', 'Over 3.5'],
  },
  controlled: {
    primary: ['Home or Draw', 'Away or Draw', 'Draw No Bet'],
    secondary: ['Asian Handicap -0.5', 'Over 1.5', 'Under 3.5'],
    avoid: ['Pure Home', 'Pure Away'],
  },
  chaos: {
    primary: ['Over 1.5', 'Home or Draw', 'Away or Draw', 'BTTS Yes'],
    secondary: ['Both Halves Under 1.5 Yes', 'Over 0.5', 'Draw No Bet'],
    avoid: ['Pure Away', 'Under 1.5'],
  },
  balanced: {
    primary: ['Over 1.5', 'Home or Draw', 'Away or Draw'],
    secondary: ['Asian Handicap +0.5', 'Draw No Bet', 'Over 0.5', 'Under 3.5'],
    avoid: ['Over 3.5', 'Pure Away'],
  },
}

const BASKETBALL_MARKETS: Record<string, MarketConfig> = {
  high_scoring: {
    primary: ['Over Total Points', 'Moneyline'],
    secondary: ['Team Over', 'Spread on Favorite'],
    avoid: ['Tight Spread', 'Under Total Points'],
  },
  low_scoring: {
    primary: ['Under Total Points', 'Moneyline'],
    secondary: ['Team Under', 'Spread on Favorite'],
    avoid: ['Over Total Points', 'Team Over'],
  },
  controlled_favorite: {
    primary: ['Spread on Favorite', 'Moneyline (Favorite)', 'Moneyline'],
    secondary: ['Asian Handicap', 'Over Total Points'],
    avoid: ['Big Underdog Moneyline'],
  },
  volatile: {
    primary: ['Over Total Points', 'Moneyline'],
    secondary: ['Spread on Underdog', 'Team Over'],
    avoid: ['Tight Spread'],
  },
  even_matchup: {
    primary: ['Over Total Points', 'Moneyline'],
    secondary: ['Spread on Underdog', 'Asian Handicap'],
    avoid: [],
  },
}

const GENERIC_MARKETS: Record<string, MarketConfig> = {
  generic_favorite: {
    primary: ['Moneyline (Favorite)', 'Match Winner', 'Moneyline'],
    secondary: ['Spread on Favorite', 'Handicap'],
    avoid: ['Moneyline (Underdog)'],
  },
  generic_underdog: {
    primary: ['Spread on Underdog', 'Handicap (+)', 'Over Total Points'],
    secondary: ['Moneyline (Underdog)', 'Moneyline'],
    avoid: ['Moneyline (Favorite)'],
  },
  generic_balanced: {
    primary: ['Over Total Points', 'Over Total Games', 'Over 1.5', 'Moneyline'],
    secondary: ['Match Winner'],
    avoid: ['Under Total Points'],
  },
  generic_volatile: {
    primary: ['Over Total', 'BTTS Yes', 'Any Team to Win', 'Moneyline'],
    secondary: ['Spread on Underdog'],
    avoid: ['Under Total', 'Exact Score'],
  },
}

function findOdds(match: Match, marketName: string, availableMarketsMap?: Map<string, any[]>): MarketOdds | null {
  if (availableMarketsMap && availableMarketsMap.has(match.id)) {
    const rawMarkets = availableMarketsMap.get(match.id)!
    for (const m of rawMarkets) {
      if (!m.desc) continue;
      
      const isMatch = m.desc.toLowerCase().includes(marketName.toLowerCase()) || marketName.toLowerCase().includes(m.desc.toLowerCase())
      
      if (isMatch && m.outcomes && m.outcomes.length > 0) {
        // Pick the most likely outcome by default for the deterministic engine to avoid dropping
        const bestOutcome = [...m.outcomes].sort((a: any, b: any) => Number(a.odds) - Number(b.odds))[0]
        
        return {
          market: m.specifier ? `${m.desc} (${m.specifier}) — ${bestOutcome.desc}` : `${m.desc} — ${bestOutcome.desc}`,
          odds: Number(bestOutcome.odds) || 1.5,
          marketId: m.id,
          outcomeId: bestOutcome.id,
          specifier: m.specifier || ''
        }
      }
    }
  }

  // Fallback to dummy data
  const found = match.availableMarkets.find(
    (m) => m.market.toLowerCase().includes(marketName.toLowerCase()) || marketName.toLowerCase().includes(m.market.toLowerCase())
  )
  return found ?? null
}

function upgradeMarket(market: string, sport: string): string {
  if ((sport === 'football' || sport === 'soccer') && market === 'Over 2.5') return 'Over 1.5'
  return market
}

function buildRationale(
  profileLabel: string,
  isPrimary: boolean,
  probability: number
): string {
  const role = isPrimary ? 'Primary' : 'Secondary'
  return `${role} pick for ${profileLabel}. Est. ${probability.toFixed(1)}% hit rate. Market aligns with profile behavior.`
}

export function analyzeMatch(match: Match, availableMarketsMap?: Map<string, any[]>): ProfileResult {
  const { profile, profileLabel, features } = profileMatch(match)
  let config: MarketConfig

  const sportLower = match.sport.toLowerCase()
  if (sportLower === 'football' || sportLower === 'soccer') {
    config = FOOTBALL_MARKETS[profile]
  } else if (sportLower === 'basketball') {
    config = BASKETBALL_MARKETS[profile]
  } else {
    config = GENERIC_MARKETS[profile] ?? GENERIC_MARKETS.generic_balanced
  }

  const candidates = [
    ...config.primary.map((m) => ({ market: upgradeMarket(m, match.sport), isPrimary: true })),
    ...config.secondary.map((m) => ({ market: upgradeMarket(m, match.sport), isPrimary: false })),
  ]

  const recommendations: MarketRecommendation[] = []

  for (const { market, isPrimary } of candidates) {
    const foundMarket = findOdds(match, market, availableMarketsMap)
    if (!foundMarket) continue

    const { odds, marketId, outcomeId, specifier } = foundMarket;
    const probability = estimateProbability(match.sport, profile, market, match, features)
    if (!meetsMinimumProbability(probability)) continue

    const ev = calculateEV(probability, odds)
    recommendations.push({
      market: foundMarket.market,
      odds,
      probability,
      ev,
      tier: getConfidenceTier(probability),
      isPrimary,
      rationale: buildRationale(profileLabel, isPrimary, probability),
      marketId,
      outcomeId,
      specifier
    })
  }

  // Sort purely by the dynamically calculated AI Probability, then EV. No hardcoded biases.
  recommendations.sort((a, b) => {
    if (Math.abs(b.probability - a.probability) > 0.5) {
      return b.probability - a.probability
    }
    return b.ev - a.ev
  })

  return {
    profile,
    profileLabel,
    features,
    recommendations,
    avoidMarkets: config.avoid,
  }
}

export function getSafestEquivalent(
  match: Match,
  _currentMarket: string,
  availableMarketsMap?: Map<string, any[]>
): MarketRecommendation | null {
  const result = analyzeMatch(match, availableMarketsMap)
  if (result.recommendations.length === 0) return null

  // Removed hardcoded 'riskyUpgrades'. The AI has already sorted the best, 
  // most mathematically sound picks to the top based on Form, H2H, and logic.
  // We simply return the absolute best pick the engine found for this match.
  return result.recommendations[0]
}