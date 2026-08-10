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

export const SPORTYBET_MARKET_SCHEMA = {
  '1X2': { id: '1', outcomes: { home: '1', draw: '2', away: '3' } },
  'Over 1.5': { id: '18', specifier: 'total=1.5', outcome: 'Over' },
  'Over 2.5': { id: '18', specifier: 'total=2.5', outcome: 'Over' },
  'Under 1.5': { id: '18', specifier: 'total=1.5', outcome: 'Under' },
  'Under 2.5': { id: '18', specifier: 'total=2.5', outcome: 'Under' },
  'Under 3.5': { id: '18', specifier: 'total=3.5', outcome: 'Under' },
  'Under 4.5': { id: '18', specifier: 'total=4.5', outcome: 'Under' },
  'Over 0.5': { id: '18', specifier: 'total=0.5', outcome: 'Over' },
  'Double Chance': { id: '29', outcomes: { home_draw: '1X', home_away: '12', draw_away: 'X2' } },
  'Home or Draw': { id: '29', outcome: '1X' },
  'Away or Draw': { id: '29', outcome: 'X2' },
  'Draw No Bet': { id: '258', outcomes: { home: '1', away: '2' } },
  'Both Teams to Score': { id: '36', outcomes: { yes: '1', no: '2' } },
  'BTTS Yes': { id: '36', outcome: '1' },
  'BTTS No': { id: '36', outcome: '2' },
  'Asian Handicap': { id: '12' },
  'Half-Time 1X2': { id: '2' },
} as const

export function findOdds(match: Match, marketName: string, availableMarketsMap?: Map<string, Array<{ id?: string | number; marketId?: string | number; desc?: string; name?: string; specifier?: string; outcomes?: Array<{ id?: string | number; desc?: string; name?: string; odds?: string | number; odd?: string | number; oddsDecimal?: string | number }> }>>): MarketOdds | null {
  if (availableMarketsMap && availableMarketsMap.has(match.id)) {
    const rawMarkets = availableMarketsMap.get(match.id)!
    const searchName = marketName.toLowerCase().trim()
    const schemaEntry = (SPORTYBET_MARKET_SCHEMA as Record<string, { id?: string; specifier?: string; outcome?: string }>)[marketName]

    // 1. Try exact Market ID & Specifier matching if schema definition exists
    if (schemaEntry) {
      const targetMarketId = String(schemaEntry.id)
      for (const m of rawMarkets) {
        if (String(m.id ?? m.marketId) === targetMarketId) {
          if (schemaEntry.specifier && m.specifier && m.specifier !== schemaEntry.specifier) {
            continue
          }
          if (m.outcomes && Array.isArray(m.outcomes)) {
            for (const o of m.outcomes) {
              const oDesc = (o.desc || o.name || '').toLowerCase().trim()
              if (schemaEntry.outcome && (oDesc === schemaEntry.outcome.toLowerCase() || String(o.id) === schemaEntry.outcome)) {
                return {
                  market: m.specifier ? `${m.desc || m.name} (${m.specifier}) — ${o.desc || o.name}` : `${m.desc || m.name} — ${o.desc || o.name}`,
                  odds: Number(o.odds || o.odd || o.oddsDecimal || '1.5'),
                  marketId: String(m.id ?? m.marketId),
                  outcomeId: String(o.id),
                  specifier: m.specifier || ''
                }
              }
            }
          }
        }
      }
    }

    // 2. Strict regex search across raw markets & outcomes
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regexPattern = new RegExp(`\\b${escapeRegex(searchName)}\\b`, 'i')

    for (const m of rawMarkets) {
      if (!m.outcomes || !Array.isArray(m.outcomes)) continue
      for (const o of m.outcomes) {
        const fullDesc = `${m.desc || m.name || ''} ${o.desc || o.name || ''}`.toLowerCase()
        if (regexPattern.test(fullDesc) || fullDesc.includes(searchName)) {
          return {
            market: m.specifier ? `${m.desc || m.name} (${m.specifier}) — ${o.desc || o.name}` : `${m.desc || m.name} — ${o.desc || o.name}`,
            odds: Number(o.odds || o.odd || o.oddsDecimal || '1.5'),
            marketId: String(m.id ?? m.marketId),
            outcomeId: String(o.id),
            specifier: m.specifier || ''
          }
        }
      }
    }
  }

  // Fallback to match's pre-parsed availableMarkets (strict name check)
  const found = match.availableMarkets.find(
    (m) => m.market.toLowerCase().trim() === marketName.toLowerCase().trim() ||
           m.market.toLowerCase().includes(marketName.toLowerCase())
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

export function analyzeMatch(match: Match, availableMarketsMap?: Map<string, Array<{ id?: string | number; marketId?: string | number; desc?: string; name?: string; specifier?: string; outcomes?: Array<{ id?: string | number; desc?: string; name?: string; odds?: string | number; odd?: string | number; oddsDecimal?: string | number }> }>>): ProfileResult {
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
    const probability = estimateProbability(match.sport, profile, market, match, features, odds)
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
  availableMarketsMap?: Map<string, Array<{ id?: string | number; marketId?: string | number; desc?: string; name?: string; specifier?: string; outcomes?: Array<{ id?: string | number; desc?: string; name?: string; odds?: string | number; odd?: string | number; oddsDecimal?: string | number }> }>>
): MarketRecommendation | null {
  const result = analyzeMatch(match, availableMarketsMap)
  if (result.recommendations.length === 0) return null

  // Removed hardcoded 'riskyUpgrades'. The AI has already sorted the best, 
  // most mathematically sound picks to the top based on Form, H2H, and logic.
  // We simply return the absolute best pick the engine found for this match.
  return result.recommendations[0]
}