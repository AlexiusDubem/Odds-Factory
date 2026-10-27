/**
 * Poisson Distribution & Goal Expectancy Engine
 *
 * Implements standard bivariate Poisson & Dixon-Coles goal modeling for football.
 * Computes exact probabilities for Over/Under goals, BTTS, 1X2, and Double Chance.
 */

// Factorial cache for speed
const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320]

function factorial(n: number): number {
  if (n < 0) return 1
  if (n < FACTORIALS.length) return FACTORIALS[n]
  let res = FACTORIALS[FACTORIALS.length - 1]
  for (let i = FACTORIALS.length; i <= n; i++) res *= i
  return res
}

/**
 * Single-variable Poisson PMF: P(X = k) = (lambda^k * e^-lambda) / k!
 */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

export interface PoissonMarketProbabilities {
  lambdaHome: number
  muAway: number
  expectedTotalGoals: number

  // Goals
  over0_5: number
  over1_5: number
  over2_5: number
  over3_5: number
  under1_5: number
  under2_5: number
  under3_5: number

  // BTTS
  bttsYes: number
  bttsNo: number

  // 1X2
  homeWin: number
  draw: number
  awayWin: number

  // Double Chance & DNB
  homeOrDraw: number    // 1X
  awayOrDraw: number    // X2
  homeOrAway: number    // 12
  dnbHome: number       // Draw No Bet 1
  dnbAway: number       // Draw No Bet 2
}

/**
 * Calculates full bivariate Poisson probabilities for a match up to 7x7 scorelines.
 * Includes Dixon-Coles low-score rho correlation adjustment for 0-0, 1-0, 0-1, 1-1.
 */
export function calculatePoissonProbabilities(
  lambdaHome: number,
  muAway: number,
  rho = -0.08 // Dixon-Coles empirical low-scoring interdependence
): PoissonMarketProbabilities {
  // Guardrails
  const lambda = Math.max(0.3, Math.min(4.5, lambdaHome))
  const mu = Math.max(0.2, Math.min(4.0, muAway))
  const maxGoals = 7

  // Calculate score matrix
  let homeWin = 0
  let draw = 0
  let awayWin = 0

  let over0_5 = 0
  let over1_5 = 0
  let over2_5 = 0
  let over3_5 = 0

  let bttsYes = 0

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      let prob = poissonPmf(h, lambda) * poissonPmf(a, mu)

      // Dixon-Coles adjustment for low scores
      if (h === 0 && a === 0) {
        prob *= 1 - lambda * mu * rho
      } else if (h === 0 && a === 1) {
        prob *= 1 + lambda * rho
      } else if (h === 1 && a === 0) {
        prob *= 1 + mu * rho
      } else if (h === 1 && a === 1) {
        prob *= 1 - rho
      }

      // 1X2
      if (h > a) homeWin += prob
      else if (h === a) draw += prob
      else awayWin += prob

      // Goals
      const total = h + a
      if (total > 0.5) over0_5 += prob
      if (total > 1.5) over1_5 += prob
      if (total > 2.5) over2_5 += prob
      if (total > 3.5) over3_5 += prob

      // BTTS
      if (h > 0 && a > 0) bttsYes += prob
    }
  }

  // Normalize 1X2 sum to exactly 1.0
  const sum1x2 = homeWin + draw + awayWin
  if (sum1x2 > 0) {
    homeWin /= sum1x2
    draw /= sum1x2
    awayWin /= sum1x2
  }

  const under1_5 = Math.max(0, 1 - over1_5)
  const under2_5 = Math.max(0, 1 - over2_5)
  const under3_5 = Math.max(0, 1 - over3_5)
  const bttsNo = Math.max(0, 1 - bttsYes)

  const homeOrDraw = Math.min(0.98, homeWin + draw)
  const awayOrDraw = Math.min(0.98, awayWin + draw)
  const homeOrAway = Math.min(0.98, homeWin + awayWin)

  const nonDrawSum = homeWin + awayWin
  const dnbHome = nonDrawSum > 0 ? homeWin / nonDrawSum : 0.5
  const dnbAway = nonDrawSum > 0 ? awayWin / nonDrawSum : 0.5

  return {
    lambdaHome: Number(lambda.toFixed(2)),
    muAway: Number(mu.toFixed(2)),
    expectedTotalGoals: Number((lambda + mu).toFixed(2)),

    over0_5: Number(over0_5.toFixed(4)),
    over1_5: Number(over1_5.toFixed(4)),
    over2_5: Number(over2_5.toFixed(4)),
    over3_5: Number(over3_5.toFixed(4)),
    under1_5: Number(under1_5.toFixed(4)),
    under2_5: Number(under2_5.toFixed(4)),
    under3_5: Number(under3_5.toFixed(4)),

    bttsYes: Number(bttsYes.toFixed(4)),
    bttsNo: Number(bttsNo.toFixed(4)),

    homeWin: Number(homeWin.toFixed(4)),
    draw: Number(draw.toFixed(4)),
    awayWin: Number(awayWin.toFixed(4)),

    homeOrDraw: Number(homeOrDraw.toFixed(4)),
    awayOrDraw: Number(awayOrDraw.toFixed(4)),
    homeOrAway: Number(homeOrAway.toFixed(4)),
    dnbHome: Number(dnbHome.toFixed(4)),
    dnbAway: Number(dnbAway.toFixed(4)),
  }
}

/**
 * Estimates lambda (home expected goals) and mu (away expected goals)
 * from team statistics or de-margined bookmaker odds.
 */
export function estimateLambdaMu(params: {
  homeGoalsAvg?: number
  awayGoalsAvg?: number
  homeConcededAvg?: number
  awayConcededAvg?: number
  over2_5Odds?: number
  homeWinOdds?: number
  awayWinOdds?: number
}): { lambdaHome: number; muAway: number } {
  // Approach 1: Team goal statistics
  if (params.homeGoalsAvg !== undefined && params.awayConcededAvg !== undefined) {
    const leagueGoalAvg = 1.35 // typical team goals per match in top leagues
    const homeAttack = params.homeGoalsAvg / leagueGoalAvg
    const awayDefense = params.awayConcededAvg / leagueGoalAvg
    const homeAdvantage = 1.15 // 15% home turf uplift

    const awayAttack = (params.awayGoalsAvg || 1.1) / leagueGoalAvg
    const homeDefense = (params.homeConcededAvg || 1.1) / leagueGoalAvg

    const lambda = homeAttack * awayDefense * leagueGoalAvg * homeAdvantage
    const mu = awayAttack * homeDefense * leagueGoalAvg

    return {
      lambdaHome: Math.max(0.5, Math.min(3.8, lambda)),
      muAway: Math.max(0.4, Math.min(3.2, mu))
    }
  }

  // Approach 2: Reverse-engineer from Over 2.5 and 1X2 odds
  let expectedTotal = 2.65
  if (params.over2_5Odds && params.over2_5Odds > 1.05) {
    const impliedOver = (1 / params.over2_5Odds) / 1.06
    // Approx relationship: over2.5 prob -> total goal expectancy
    expectedTotal = 1.6 + (impliedOver * 2.1)
  }

  let homeRatio = 0.58 // typical home share
  if (params.homeWinOdds && params.awayWinOdds) {
    const rawHome = 1 / params.homeWinOdds
    const rawAway = 1 / params.awayWinOdds
    const total = rawHome + rawAway
    if (total > 0) homeRatio = rawHome / total
  }

  const lambdaHome = expectedTotal * homeRatio
  const muAway = expectedTotal * (1 - homeRatio)

  return {
    lambdaHome: Math.max(0.5, Math.min(3.8, lambdaHome)),
    muAway: Math.max(0.4, Math.min(3.2, muAway))
  }
}

/**
 * Calculates genuine Expected Value (EV) and Edge
 * EV = (True Probability * Decimal Odds) - 1
 * Edge = True Probability - Implied Probability
 */
export function evaluateMarketValue(
  trueProb: number,
  decimalOdds: number
): { ev: number; edge: number; isPositiveEv: boolean; impliedProb: number } {
  const impliedProb = decimalOdds > 1 ? 1 / decimalOdds : 0.5
  const ev = (trueProb * decimalOdds) - 1
  const edge = trueProb - impliedProb

  return {
    ev: Number(ev.toFixed(4)),
    edge: Number(edge.toFixed(4)),
    isPositiveEv: ev > 0.02, // 2% minimum edge threshold
    impliedProb: Number(impliedProb.toFixed(4))
  }
}
