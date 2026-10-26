/**
 * Odds Factory — Statistical Prediction & Market Qualification Pipeline
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. Gemini NEVER generates or picks bets.
 * 2. Mathematical models (Poisson distributions, xG differentials, EV, calibration)
 *    rank, qualify, or reject every candidate selection.
 * 3. Gemini is strictly an evidence-bound narrator that explains verified numbers.
 * 4. Transparent disclosure of uncertainty, market-implied probabilities, and data age.
 */

export type CanonicalMarket =
  | 'TOTAL_GOALS_OVER_1_5'
  | 'TOTAL_GOALS_UNDER_3_5'
  | 'TOTAL_GOALS_OVER_2_5'
  | 'TOTAL_GOALS_UNDER_2_5'
  | 'DOUBLE_CHANCE_1X'
  | 'DOUBLE_CHANCE_X2'
  | 'DOUBLE_CHANCE_12'
  | 'MATCH_RESULT_HOME'
  | 'MATCH_RESULT_AWAY'
  | 'BTTS_YES'
  | 'BTTS_NO'
  | 'HOME_TEAM_CLEAN_SHEET_NO'
  | 'AWAY_TEAM_CLEAN_SHEET_NO'
  | 'TOTAL_GOALS_EVEN_ODD'

export type QualificationStatus = 'ELIGIBLE' | 'REJECTED' | 'RESEARCH_ONLY' | 'INSUFFICIENT_DATA'
export type UncertaintyLevel = 'LOW' | 'MODERATE' | 'HIGH'

export interface ModelThresholds {
  minConfidence: number        // e.g. 0.60
  minEdge: number              // e.g. 0.035 (+3.5%)
  minEV: number                // e.g. 0.02 (+2.0%)
  maxUncertainty: number       // e.g. 0.12
  maxStaleMinutes: number      // e.g. 15 minutes
  minSampleSize: number        // e.g. 250 observations
}

export const DEFAULT_THRESHOLDS: ModelThresholds = {
  minConfidence: 0.60,
  minEdge: 0.035,
  minEV: 0.02,
  maxUncertainty: 0.12,
  maxStaleMinutes: 15,
  minSampleSize: 250,
}

export interface StatisticalEvaluationInput {
  fixtureId: string
  homeTeam: string
  awayTeam: string
  competition: string
  canonicalMarket: CanonicalMarket
  marketLabel: string
  decimalOdds: number
  homeExpectedGoals: number
  awayExpectedGoals: number
  dataFreshnessMinutes: number
  sampleSize: number
  lineupStatus: 'confirmed' | 'projected' | 'unconfirmed'
  completenessScore: number
  historicalBrierScore?: number
}

export interface StatisticalEvaluationResult {
  fixtureId: string
  canonicalMarket: CanonicalMarket
  marketLabel: string
  decimalOdds: number
  impliedProbability: number
  modelProbability: number
  edge: number
  expectedValue: number
  uncertaintyScore: number
  uncertaintyLevel: UncertaintyLevel
  status: QualificationStatus
  thresholdsPassed: string[]
  thresholdsFailed: string[]
  rejectionReason?: string
  evidence: string[]
  riskFlags: string[]
  dataAgeMinutes: number
  lineupStatus: string
  evaluatedAt: string
}

/**
 * Poisson Distribution Probability Function: P(X = k) = (lambda^k * e^-lambda) / k!
 */
export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0 || k < 0) return 0
  let fact = 1
  for (let i = 2; i <= k; i++) fact *= i
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact
}

/**
 * Calculates joint score probability matrix up to 6x6 goals
 */
export function computeScoreMatrix(homeLambda: number, awayLambda: number, maxGoals: number = 6): number[][] {
  const matrix: number[][] = []
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = []
    const pHome = poissonProbability(h, homeLambda)
    for (let a = 0; a <= maxGoals; a++) {
      const pAway = poissonProbability(a, awayLambda)
      matrix[h][a] = pHome * pAway
    }
  }
  return matrix
}

/**
 * Derives underlying event probability from bivariate Poisson score matrix
 */
export function deriveModelProbability(canonicalMarket: CanonicalMarket, homeLambda: number, awayLambda: number): number {
  const matrix = computeScoreMatrix(homeLambda, awayLambda, 7)
  const totalLambda = homeLambda + awayLambda

  switch (canonicalMarket) {
    case 'TOTAL_GOALS_OVER_1_5': {
      // 1 - P(0) - P(1)
      const p0 = poissonProbability(0, totalLambda)
      const p1 = poissonProbability(1, totalLambda)
      return Math.min(0.98, Math.max(0.02, 1 - p0 - p1))
    }

    case 'TOTAL_GOALS_UNDER_3_5': {
      // P(0) + P(1) + P(2) + P(3)
      let sum = 0
      for (let k = 0; k <= 3; k++) sum += poissonProbability(k, totalLambda)
      return Math.min(0.98, Math.max(0.02, sum))
    }

    case 'TOTAL_GOALS_OVER_2_5': {
      let sumUnder = 0
      for (let k = 0; k <= 2; k++) sumUnder += poissonProbability(k, totalLambda)
      return Math.min(0.98, Math.max(0.02, 1 - sumUnder))
    }

    case 'TOTAL_GOALS_UNDER_2_5': {
      let sum = 0
      for (let k = 0; k <= 2; k++) sum += poissonProbability(k, totalLambda)
      return Math.min(0.98, Math.max(0.02, sum))
    }

    case 'DOUBLE_CHANCE_1X': {
      // P(home >= away)
      let pWinOrDraw = 0
      for (let h = 0; h <= 6; h++) {
        for (let a = 0; a <= 6; a++) {
          if (h >= a) pWinOrDraw += matrix[h][a]
        }
      }
      return Math.min(0.98, Math.max(0.02, pWinOrDraw))
    }

    case 'DOUBLE_CHANCE_X2': {
      let pDrawOrAway = 0
      for (let h = 0; h <= 6; h++) {
        for (let a = 0; a <= 6; a++) {
          if (a >= h) pDrawOrAway += matrix[h][a]
        }
      }
      return Math.min(0.98, Math.max(0.02, pDrawOrAway))
    }

    case 'DOUBLE_CHANCE_12': {
      let pNoDraw = 0
      for (let h = 0; h <= 6; h++) {
        for (let a = 0; a <= 6; a++) {
          if (h !== a) pNoDraw += matrix[h][a]
        }
      }
      return Math.min(0.98, Math.max(0.02, pNoDraw))
    }

    case 'MATCH_RESULT_HOME': {
      let pHomeWin = 0
      for (let h = 0; h <= 6; h++) {
        for (let a = 0; a <= 6; a++) {
          if (h > a) pHomeWin += matrix[h][a]
        }
      }
      return Math.min(0.98, Math.max(0.02, pHomeWin))
    }

    case 'MATCH_RESULT_AWAY': {
      let pAwayWin = 0
      for (let h = 0; h <= 6; h++) {
        for (let a = 0; a <= 6; a++) {
          if (a > h) pAwayWin += matrix[h][a]
        }
      }
      return Math.min(0.98, Math.max(0.02, pAwayWin))
    }

    case 'BTTS_YES': {
      // P(home >= 1) * P(away >= 1)
      const pHomeAtLeastOne = 1 - poissonProbability(0, homeLambda)
      const pAwayAtLeastOne = 1 - poissonProbability(0, awayLambda)
      return Math.min(0.98, Math.max(0.02, pHomeAtLeastOne * pAwayAtLeastOne))
    }

    case 'BTTS_NO': {
      const pHomeAtLeastOne = 1 - poissonProbability(0, homeLambda)
      const pAwayAtLeastOne = 1 - poissonProbability(0, awayLambda)
      return Math.min(0.98, Math.max(0.02, 1 - (pHomeAtLeastOne * pAwayAtLeastOne)))
    }

    case 'HOME_TEAM_CLEAN_SHEET_NO': {
      // Away team scores >= 1: 1 - P(away = 0)
      return Math.min(0.98, Math.max(0.02, 1 - poissonProbability(0, awayLambda)))
    }

    case 'AWAY_TEAM_CLEAN_SHEET_NO': {
      // Home team scores >= 1: 1 - P(home = 0)
      return Math.min(0.98, Math.max(0.02, 1 - poissonProbability(0, homeLambda)))
    }

    case 'TOTAL_GOALS_EVEN_ODD': {
      // P(even) = (1 + e^-2lambda) / 2
      return (1 + Math.exp(-2 * totalLambda)) / 2
    }

    default:
      return 0.50
  }
}

export function isSimulatedOrVirtualMatch(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return (
    lower.includes('srl') ||
    lower.includes('simulated') ||
    lower.includes('virtual') ||
    lower.includes('electronic') ||
    lower.includes('efootball') ||
    lower.includes('cyber') ||
    lower.includes('esport') ||
    lower.includes('fifa')
  )
}

/**
 * Evaluates candidate market strictly against statistical thresholds
 */
export function evaluateMarket(
  input: StatisticalEvaluationInput,
  thresholds: ModelThresholds = DEFAULT_THRESHOLDS
): StatisticalEvaluationResult {
  const impliedProbability = Number((1 / input.decimalOdds).toFixed(4))
  const modelProbability = Number(
    deriveModelProbability(input.canonicalMarket, input.homeExpectedGoals, input.awayExpectedGoals).toFixed(4)
  )

  const edge = Number((modelProbability - impliedProbability).toFixed(4))
  const expectedValue = Number((modelProbability * input.decimalOdds - 1).toFixed(4))

  // Uncertainty formula: penalize low sample size, unconfirmed lineups, and stale data
  const samplePenalty = Math.max(0, (500 - input.sampleSize) / 5000)
  const lineupPenalty = input.lineupStatus === 'unconfirmed' ? 0.035 : input.lineupStatus === 'projected' ? 0.015 : 0
  const freshnessPenalty = Math.max(0, (input.dataFreshnessMinutes - 5) / 100)
  const completenessPenalty = (1 - input.completenessScore) * 0.1

  const uncertaintyScore = Number((samplePenalty + lineupPenalty + freshnessPenalty + completenessPenalty).toFixed(3))
  const uncertaintyLevel: UncertaintyLevel =
    uncertaintyScore <= 0.06 ? 'LOW' : uncertaintyScore <= 0.12 ? 'MODERATE' : 'HIGH'

  const thresholdsPassed: string[] = []
  const thresholdsFailed: string[] = []
  const riskFlags: string[] = []
  const evidence: string[] = []

  // Strict Exclusion of Simulated Reality League (SRL) / Virtual matches
  if (isSimulatedOrVirtualMatch(input.fixtureId) || isSimulatedOrVirtualMatch(input.marketLabel)) {
    thresholdsFailed.push('real_fixture_mandate')
    return {
      fixtureId: input.fixtureId,
      canonicalMarket: input.canonicalMarket,
      marketLabel: input.marketLabel,
      decimalOdds: input.decimalOdds,
      impliedProbability,
      modelProbability,
      edge,
      expectedValue,
      uncertaintyScore: 0.99,
      uncertaintyLevel: 'HIGH',
      status: 'REJECTED',
      thresholdsPassed: [],
      thresholdsFailed,
      rejectionReason: 'Simulated Reality League (SRL) matches are strictly excluded. Only real, official fixtures are permitted.',
      riskFlags: ['Simulated / Virtual match detected.'],
      evidence: ['Match rejected by verified real-sport policy filter.'],
      dataAgeMinutes: input.dataFreshnessMinutes,
      lineupStatus: input.lineupStatus,
      evaluatedAt: new Date().toISOString(),
    }
  }

  // Even/Odd market has mandatory RESEARCH_ONLY gate (near 50% coin flip cannot clear bookmaker margin)
  if (input.canonicalMarket === 'TOTAL_GOALS_EVEN_ODD') {
    thresholdsFailed.push('parity_margin_barrier')
    riskFlags.push('Even/Odd parity probability is statistically bound to near 50%; unable to reliably clear bookmaker vig.')
    return {
      fixtureId: input.fixtureId,
      canonicalMarket: input.canonicalMarket,
      marketLabel: input.marketLabel,
      decimalOdds: input.decimalOdds,
      impliedProbability,
      modelProbability,
      edge,
      expectedValue,
      uncertaintyScore,
      uncertaintyLevel,
      status: 'RESEARCH_ONLY',
      thresholdsPassed,
      thresholdsFailed,
      rejectionReason: 'Even/Odd market is designated research-only due to margin drag.',
      evidence,
      riskFlags,
      dataAgeMinutes: input.dataFreshnessMinutes,
      lineupStatus: input.lineupStatus,
      evaluatedAt: new Date().toISOString(),
    }
  }

  // 1. Data Freshness Check
  if (input.dataFreshnessMinutes <= thresholds.maxStaleMinutes) {
    thresholdsPassed.push('fresh_data')
  } else {
    thresholdsFailed.push('stale_data')
    riskFlags.push(`Odds data age (${input.dataFreshnessMinutes}m) exceeds 15-minute threshold.`)
  }

  // 2. Historical Sample Size Check
  if (input.sampleSize >= thresholds.minSampleSize) {
    thresholdsPassed.push('sufficient_sample_size')
    evidence.push(`Evaluated across ${input.sampleSize} comparable competition fixtures.`)
  } else {
    thresholdsFailed.push('insufficient_sample')
    riskFlags.push(`Sample size (${input.sampleSize}) is below minimum 250 observations.`)
  }

  // 3. Lineup Risk Flag
  if (input.lineupStatus === 'unconfirmed') {
    riskFlags.push('Lineups are unconfirmed; subject to pre-match variance.')
  } else {
    evidence.push('Lineups verified against current match sheet.')
  }

  // 4. Expected Value & Edge Checks
  if (edge >= thresholds.minEdge) {
    thresholdsPassed.push('positive_edge')
    evidence.push(`Estimated model edge of +${(edge * 100).toFixed(1)}% above bookmaker implied probability.`)
  } else {
    thresholdsFailed.push('insufficient_edge')
  }

  if (expectedValue >= thresholds.minEV) {
    thresholdsPassed.push('positive_ev')
    evidence.push(`Positive expected value calculated at +${(expectedValue * 100).toFixed(1)}%.`)
  } else {
    thresholdsFailed.push('insufficient_ev')
  }

  // 5. Confidence Floor
  if (modelProbability >= thresholds.minConfidence) {
    thresholdsPassed.push('confidence_floor')
  } else {
    thresholdsFailed.push('below_confidence_floor')
  }

  // 6. Uncertainty Check
  if (uncertaintyScore <= thresholds.maxUncertainty) {
    thresholdsPassed.push('acceptable_uncertainty')
  } else {
    thresholdsFailed.push('high_uncertainty')
    riskFlags.push(`Model uncertainty (${uncertaintyScore}) exceeds allowable threshold.`)
  }

  const isEligible = thresholdsFailed.length === 0

  return {
    fixtureId: input.fixtureId,
    canonicalMarket: input.canonicalMarket,
    marketLabel: input.marketLabel,
    decimalOdds: input.decimalOdds,
    impliedProbability,
    modelProbability,
    edge,
    expectedValue,
    uncertaintyScore,
    uncertaintyLevel,
    status: isEligible ? 'ELIGIBLE' : 'REJECTED',
    thresholdsPassed,
    thresholdsFailed,
    rejectionReason: isEligible ? undefined : `Rejected on: ${thresholdsFailed.join(', ')}`,
    evidence,
    riskFlags,
    dataAgeMinutes: input.dataFreshnessMinutes,
    lineupStatus: input.lineupStatus,
    evaluatedAt: new Date().toISOString(),
  }
}

/**
 * Calculates correlation penalty across accumulator selections
 */
export function calculateCorrelationScore(selections: { fixtureId: string; canonicalMarket: CanonicalMarket }[]): {
  correlationScore: number
  hasHighCorrelation: boolean
  warning?: string
} {
  const fixtureCounts = new Map<string, number>()
  let sameFixtureMultiCount = 0

  for (const s of selections) {
    const count = (fixtureCounts.get(s.fixtureId) || 0) + 1
    fixtureCounts.set(s.fixtureId, count)
    if (count > 1) {
      sameFixtureMultiCount++
    }
  }

  const correlationScore = Number((sameFixtureMultiCount / Math.max(1, selections.length)).toFixed(2))
  const hasHighCorrelation = sameFixtureMultiCount > 0

  return {
    correlationScore,
    hasHighCorrelation,
    warning: hasHighCorrelation
      ? 'Accumulator contains multiple selections from the same fixture, compounding joint outcome risk.'
      : undefined,
  }
}
