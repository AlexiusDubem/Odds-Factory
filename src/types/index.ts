export type Sport = 'football' | 'basketball' | 'tennis' | 'ice_hockey' | 'table_tennis' | 'volleyball' | 'baseball' | 'cricket' | 'badminton' | 'darts' | 'futsal' | string

/** How the user wants the optimizer to approach this slip */
export type OptimizationMode =
  | 'target_odds'      // Reduce combined odds toward a user-specified ceiling
  | 'target_survival'  // Raise cumulative survival probability to a user-specified floor
  | 'best_ev'          // Maximise expected value per leg, no hard target
  | 'safe_mode'        // Replace every leg with the single safest qualifying market
  | 'balanced'         // Maximize EV * Survival probability per leg
  | 'dreamer'          // Preserve high odds, just reduce absolute stupidity

export interface OptimizationGoal {
  mode: OptimizationMode
  targetOdds?: number      // used when mode === 'target_odds'
  targetSurvival?: number  // used when mode === 'target_survival' (0-100)
}

export type FootballProfile =
  | 'high_goal'
  | 'low_goal'
  | 'controlled'
  | 'chaos'
  | 'balanced'

export type BasketballProfile =
  | 'high_scoring'
  | 'low_scoring'
  | 'controlled_favorite'
  | 'volatile'
  | 'even_matchup'

export type GenericProfile = 'generic_favorite' | 'generic_underdog' | 'generic_balanced' | 'generic_volatile'

export type MatchProfile = FootballProfile | BasketballProfile | GenericProfile | string

export type ConfidenceTier = 1 | 2 | 3

export type SlipMode = 'single_acca' | 'bank_pool' | 'night_midnight'

export type MatchContext =
  | 'regular'
  | 'friendly'
  | 'reserves'
  | 'youth'
  | 'playoffs'
  | 'back_to_back'
  | 'fixture_congestion'

export interface FootballStats {
  goalsFor: number
  goalsAgainst: number
  xG: number
  xGA: number
  cleanSheetRate: number
  bttsRate: number
  cornersPerGame: number
  tempo: number
  homeGoalsFor: number
  homeGoalsAgainst: number
  awayGoalsFor: number
  awayGoalsAgainst: number
}

export interface BasketballStats {
  pace: number
  offensiveRating: number
  defensiveRating: number
  pointsPerGame: number
  reboundsPerGame: number
  assistsPerGame: number
  avgTotalPoints: number
  overUnderHitRate: number
  starPlayerImpact: number
  backToBackGames: number
  homePPG: number
  awayPPG: number
  league: 'nba' | 'euro' | 'other'
}

export interface MarketOdds {
  market: string
  odds: number
  marketId?: string
  outcomeId?: string
  specifier?: string
}

export interface Match {
  id: string
  sport: Sport
  homeTeam: string
  awayTeam: string
  kickoff: string
  isHome: boolean
  context: MatchContext[]
  football?: FootballStats
  basketball?: BasketballStats
  motivation: number
  fatigue: number
  injuries: string[]
  availableMarkets: MarketOdds[]
  h2hWinRate?: number // Last 5-6 head-to-head win rate
  formScore?: number // Current league form
  learningWeight?: number;
  clvErrorRate?: number;
}

export interface ComputedFeatures {
  attackIndex?: number
  defenseIndex?: number
  goalEnvironment?: number
  volatility?: number
  fatigueIndex?: number
  motivationScore?: number
  paceScore?: number
  offensiveEfficiency?: number
  defensiveEfficiency?: number
  totalPointsEnvironment?: number
  starPlayerImpact?: number
  backToBackFatigue?: number
  h2hAdvantage?: number
  formMomentum?: number
  under25Signal?: number
  bttsSignal?: number;
  dynamicMarketProb?: number;
}

export interface MarketRecommendation {
  market: string
  odds: number
  probability: number
  ev: number
  tier: ConfidenceTier
  isPrimary: boolean
  rationale: string;
  isDynamic?: boolean;
  marketId?: string;
  outcomeId?: string;
  specifier?: string;
}

export interface ProfileResult {
  profile: MatchProfile
  profileLabel: string
  features: ComputedFeatures
  recommendations: MarketRecommendation[]
  avoidMarkets: string[]
}

export interface SlipLeg {
  id: string
  matchId: string
  matchLabel: string
  sport: Sport
  profile: MatchProfile
  market: string
  odds: number
  probability: number
  ev: number
  tier: ConfidenceTier
  rationale: string
  isOriginal?: boolean
  isDynamic?: boolean
  /** Set after optimization — the market before the swap */
  previousMarket?: string
  /** True if this leg's market was changed by the optimizer */
  wasSwapped?: boolean
  rawSelection?: {
    eventId?: string
    marketId?: string
    outcomeId?: string
    specifier?: string
  }
}

export interface Slip {
  id: string
  name: string
  mode: SlipMode
  legs: SlipLeg[]
  combinedOdds: number
  survivalProbability: number
  createdAt: string
  stakePercent: number
}

export interface BacktestRecord {
  id: string
  slipId: string
  slipName: string
  outcome: 'won' | 'lost' | 'pending'
  legsWon: number
  legsTotal: number
  recordedAt: string
  notes: string
}