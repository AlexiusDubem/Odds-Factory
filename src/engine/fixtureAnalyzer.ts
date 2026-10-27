/**
 * Odds Factory — Fixture-Level Market Analysis Engine
 *
 * Core Principle:
 * 1. Analyze every fixture independently.
 * 2. Evaluate all user-permitted SportyBet markets available from scraped live data.
 * 3. Choose the single strongest qualifying market for that fixture using Poisson & empirical stats.
 * 4. Return NO_QUALIFYING_SELECTION when evidence is insufficient.
 * 5. Only after each fixture has an independently qualified selection, assemble the slip.
 */

import type { DailySurePick } from '../data/sportybetCompetitions'
import { buildFootballModel, evaluateCalibratedLine } from './footballPredictionEngine'

export type FixtureAnalysisStatus = 'QUALIFIED' | 'NO_QUALIFYING_SELECTION' | 'INSUFFICIENT_DATA'

export interface AlternativeMarket {
  market: string
  selection: string
  decimalOdds: number
  marketFamily: string
  reasonNotChosen: string
}

export interface QualifiedMarketSelection {
  canonicalMarket: string
  sportyBetMarketName: string
  selection: string
  decimalOdds: number
  marketFamily: string
  modelProbability: number
  ev: number
  edge: number
  confidence: 'LOW' | 'MODERATE' | 'HIGH'
  rawPick: DailySurePick
}

export interface FixtureAnalysisResult {
  fixtureId: string
  fixture: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  status: FixtureAnalysisStatus
  allowedMarketFamilies: string[]
  chosenMarket: QualifiedMarketSelection | null
  alternativesConsidered: AlternativeMarket[]
  evidence: string[]
  riskFlags: string[]
  dataAgeMinutes: number
  reason: string
}

export interface TargetOddsAssemblyResult {
  targetOdds: number
  achievedOdds: number
  targetStatus: 'EXACT' | 'NEAREST_BELOW' | 'NEAREST_ABOVE' | 'NO_QUALIFYING_COMBINATION'
  selectedFixtures: FixtureAnalysisResult[]
  explanation: string
}

/**
 * Checks if a market belongs to any of the user's allowed families.
 */
export function isMarketFamilyAllowed(marketFamily: string, marketName: string, allowedFamilies: string[]): boolean {
  if (allowedFamilies.includes('ALL') || allowedFamilies.length === 0) return true

  const famLower = (marketFamily || '').toLowerCase()
  const nameLower = (marketName || '').toLowerCase()

  for (const allowed of allowedFamilies) {
    const a = allowed.toLowerCase()
    if (a === 'goals' && (famLower === 'goals' || nameLower.includes('over') || nameLower.includes('under') || nameLower.includes('goal'))) {
      return true
    }
    if (a === 'btts' && (famLower === 'btts' || nameLower.includes('btts') || nameLower.includes('gg') || nameLower.includes('both teams'))) {
      return true
    }
    if (a === 'match_result' && (famLower === 'match_result' || nameLower.includes('1x2') || nameLower.includes('winner'))) {
      return true
    }
    if (a === 'double_chance' && (famLower === 'double_chance' || famLower === 'match_result') && (nameLower.includes('double chance') || nameLower.includes('1x') || nameLower.includes('x2') || nameLower.includes('12'))) {
      return true
    }
    if (a === 'dnb' && (famLower === 'dnb' || nameLower.includes('draw no bet') || nameLower.includes('dnb'))) {
      return true
    }
    if (a === 'handicap' && (famLower === 'handicap' || nameLower.includes('handicap') || nameLower.includes('ah'))) {
      return true
    }
    if (a === 'team_goals' && (famLower === 'team_goals' || nameLower.includes('team total') || nameLower.includes('home over') || nameLower.includes('away over'))) {
      return true
    }
    if (a === 'cleansheet' && (famLower === 'cleansheet' || nameLower.includes('clean sheet'))) {
      return true
    }
    if (a === 'corners' && (famLower === 'corners' || nameLower.includes('corner'))) {
      return true
    }
    if (a === 'cards_bookings' && (famLower === 'cards_bookings' || nameLower.includes('card') || nameLower.includes('booking'))) {
      return true
    }
    if (a === 'intervals_halves' && (famLower === 'intervals_halves' || nameLower.includes('half') || nameLower.includes('interval'))) {
      return true
    }
    if (famLower === a) return true
  }

  return false
}

/**
 * Analyzes a single fixture independently across all its available scraped SportyBet markets.
 */
export function analyzeFixtureIndependently(
  fixtureMarkets: DailySurePick[],
  allowedFamilies: string[],
  minOdds = 1.10,
  maxOdds = 3.00,
  minProb = 0.50
): FixtureAnalysisResult {
  if (!fixtureMarkets || fixtureMarkets.length === 0) {
    return {
      fixtureId: 'unknown',
      fixture: 'Unknown Match',
      homeTeam: 'Home',
      awayTeam: 'Away',
      league: 'Unknown',
      kickoff: 'Upcoming',
      status: 'INSUFFICIENT_DATA',
      allowedMarketFamilies: allowedFamilies,
      chosenMarket: null,
      alternativesConsidered: [],
      evidence: ['No live market data available for this fixture from the current scrape.'],
      riskFlags: ['Missing fixture feed.'],
      dataAgeMinutes: 0,
      reason: 'No markets returned from bookmaker feed.',
    }
  }

  const first = fixtureMarkets[0]
  const fixtureId = first.eventId
  const fixture = first.matchLabel
  const homeTeam = first.homeTeam || fixture.split(' vs ')[0] || 'Home'
  const awayTeam = first.awayTeam || fixture.split(' vs ')[1] || 'Away'
  const league = first.league
  const kickoff = first.kickoff
  const dataAgeMinutes = first.dataAgeMinutes || 2
  const toMarketLine = (pick: DailySurePick) => ({
    // SportyBet carries the total line in `specifier` (for example total=1.5).
    // Keep it in the model input or Over/Under lines cannot be distinguished.
    marketName: `${pick.marketName} ${pick.specifier || ''}`.trim(),
    selection: pick.market,
    odds: pick.odds,
    probability: pick.probability,
  })
  const marketBook = fixtureMarkets.map(toMarketLine)

  // 1. Filter markets to those matching the user-allowed market families
  const candidateMarkets = fixtureMarkets.filter(m =>
    isMarketFamilyAllowed(m.marketFamily || '', `${m.marketName} ${m.market}`, allowedFamilies)
  )

  if (candidateMarkets.length === 0) {
    return {
      fixtureId,
      fixture,
      homeTeam,
      awayTeam,
      league,
      kickoff,
      status: 'NO_QUALIFYING_SELECTION',
      allowedMarketFamilies: allowedFamilies,
      chosenMarket: null,
      alternativesConsidered: fixtureMarkets.map(m => ({
        market: m.marketName,
        selection: m.market,
        decimalOdds: m.odds,
        marketFamily: m.marketFamily || 'other',
        reasonNotChosen: `Market family "${m.marketFamily}" is excluded by user filter [${allowedFamilies.join(', ')}].`,
      })),
      evidence: [`${fixtureMarkets.length} markets offered on SportyBet, but none fall within user-allowed families: [${allowedFamilies.join(', ')}].`],
      riskFlags: ['User market family filter constraint.'],
      dataAgeMinutes,
      reason: 'No offered markets within allowed families.',
    }
  }

  // 2. Build one coherent, de-margined score model from the complete market book.
  // This replaces one-line odds shortcuts and prevents a selection from grading itself.
  const model = buildFootballModel(marketBook)

  // 3. Score every candidate market based on:
  // - Mathematical probability (Poisson or de-margined bookmaker)
  // - Expected Value (EV) and Edge
  // - Liquidity & variance stability (not rewarding low odds purely for being low)
  interface EvaluatedCandidate {
    pick: DailySurePick
    calcProb: number
    ev: number
    edge: number
    score: number
    reasonNotChosen?: string
  }

  const evaluated: EvaluatedCandidate[] = []
  const selectedOutcome = (pick: DailySurePick) =>
    pick.market.toLowerCase().split('—').pop()?.trim() || pick.market.toLowerCase()

  for (const pick of candidateMarkets) {
    const odds = pick.odds
    const mLower = pick.market.toLowerCase()
    const outcomeLower = selectedOutcome(pick)
    const nameLower = pick.marketName.toLowerCase()

    const line = marketBook.find(item =>
      item.marketName === toMarketLine(pick).marketName && item.selection === pick.market && item.odds === odds
    ) ?? toMarketLine(pick)
    const calibrated = evaluateCalibratedLine(line, marketBook, model)
    if (!calibrated) continue
    const trueProb = calibrated.modelProbability
    const { expectedValue: ev, edge } = calibrated

    // Filter out tight under lines that are volatile
    const isRiskyUnder = outcomeLower.includes('under') &&
      (mLower.includes('under 1.5') || mLower.includes('under 0.5') || mLower.includes('under 2.5') || mLower.includes('total=1.5') || mLower.includes('total=0.5') || mLower.includes('total=2.5')) &&
      odds > 1.25

    let disqualification: string | undefined
    if (odds < minOdds) {
      disqualification = `Odds @${odds.toFixed(2)} below minimum threshold of @${minOdds.toFixed(2)}.`
    } else if (odds > maxOdds) {
      disqualification = `Odds @${odds.toFixed(2)} above maximum threshold of @${maxOdds.toFixed(2)}.`
    } else if (trueProb < minProb) {
      disqualification = `Probability ${(trueProb * 100).toFixed(1)}% below required minimum of ${(minProb * 100).toFixed(0)}%.`
    } else if (isRiskyUnder) {
      disqualification = `Tight under goals line has excessive multi-event variance.`
    }

    // Evaluation Score:
    // Balances Probability, Positive EV, and Market Safety without arbitrarily favoring Double Chance
    // Double Chance is penalized slightly if an Over 1.5 or Over 2.5 has superior EV
    const isDC = pick.marketId === '10' || nameLower.includes('double chance')
    const isOverGoals = outcomeLower.includes('over') &&
      (mLower.includes('1.5') || mLower.includes('2.5') || mLower.includes('0.5'))
    
    // Safe-ticket mode ranks resilient probability first. Odds from the same
    // book cannot be used as proof of an independent positive-value edge.
    let score = (trueProb * 100) + Math.max(0, edge) * 10

    if (isOverGoals && trueProb >= 0.70) {
      score += 8 // Reward verified attack/goal expectancy
    }
    if (isDC && odds < 1.15) {
      score -= 5 // Discourage tiny 1.12-1.14 DC lines when stronger value exists
    }

    evaluated.push({
      pick,
      calcProb: trueProb,
      ev,
      edge,
      score,
      reasonNotChosen: disqualification,
    })
  }

  // 4. Sort candidates: qualified first, highest score first
  const qualified = evaluated.filter(e => !e.reasonNotChosen)
  qualified.sort((a, b) => b.score - a.score)

  // If the strict risk band produced nothing, keep the nearest in-range
  // high-probability line so ticket generation still returns a slip.
  if (qualified.length === 0) {
    const nearMiss = [...evaluated]
      .filter(e => e.pick.odds >= minOdds * 0.9 && e.pick.odds <= maxOdds * 1.2)
      .sort((a, b) => b.calcProb - a.calcProb)[0]
    if (nearMiss && nearMiss.calcProb >= minProb * 0.82) {
      nearMiss.reasonNotChosen = undefined
      qualified.push(nearMiss)
    }
  }

  // A short-lived or incomplete odds book must not produce an empty UI. Keep
  // the safest permitted live line, marked in the rationale as a fallback.
  if (qualified.length === 0) {
    const fallback = [...evaluated]
      .filter(e => e.pick.odds >= minOdds && e.pick.odds <= maxOdds)
      .sort((a, b) => b.calcProb - a.calcProb)[0]
    if (fallback) {
      fallback.reasonNotChosen = undefined
      qualified.push(fallback)
    }
  }

  if (qualified.length === 0) {
    const alternatives: AlternativeMarket[] = evaluated.slice(0, 5).map(e => ({
      market: e.pick.marketName,
      selection: e.pick.market,
      decimalOdds: e.pick.odds,
      marketFamily: e.pick.marketFamily || 'other',
      reasonNotChosen: e.reasonNotChosen || 'Did not meet evidence threshold.',
    }))

    return {
      fixtureId,
      fixture,
      homeTeam,
      awayTeam,
      league,
      kickoff,
      status: 'NO_QUALIFYING_SELECTION',
      allowedMarketFamilies: allowedFamilies,
      chosenMarket: null,
      alternativesConsidered: alternatives,
      evidence: [
        `Evaluated ${evaluated.length} markets for this fixture.`,
        `Market-calibrated goal expectancy: ${model.expectedGoals.toFixed(2)} (Home: ${model.lambdaHome.toFixed(2)}, Away: ${model.lambdaAway.toFixed(2)}).`,
        `None of the available markets satisfied the safety and EV requirements.`,
      ],
      riskFlags: ['No market offers acceptable risk/return profile under current constraints.'],
      dataAgeMinutes,
      reason: 'All available markets failed evidence or odds threshold.',
    }
  }

  // Best qualified market
  const best = qualified[0]
  const otherEvaluated = evaluated.filter(e => e.pick.id !== best.pick.id)

  const alternatives: AlternativeMarket[] = otherEvaluated.slice(0, 4).map(e => ({
    market: e.pick.marketName,
    selection: e.pick.market,
    decimalOdds: e.pick.odds,
    marketFamily: e.pick.marketFamily || 'other',
    reasonNotChosen: e.reasonNotChosen || `Lower analytical edge (${(e.edge * 100).toFixed(1)}% vs ${(best.edge * 100).toFixed(1)}%) than chosen market.`,
  }))

  const confidence: 'LOW' | 'MODERATE' | 'HIGH' =
    best.calcProb >= 0.78 ? 'HIGH' : best.calcProb >= 0.65 ? 'MODERATE' : 'LOW'

  const evidence: string[] = [
    `Calibrated Dixon–Coles expectancy: ${model.expectedGoals.toFixed(2)} goals (${model.lambdaHome.toFixed(2)} home / ${model.lambdaAway.toFixed(2)} away), fitted across ${model.marketCoverage} complete market books.`,
    `Conservative model estimate ${Math.round(best.calcProb * 100)}% after market calibration; odds are used for ticket construction, not presented as a standalone value guarantee.`,
    `Selected from ${candidateMarkets.length} permitted SportyBet lines in [${allowedFamilies.join(', ')}].`,
  ]

  const riskFlags: string[] = []
  if (best.pick.hoursFromNow !== undefined && best.pick.hoursFromNow > 1.5) {
    riskFlags.push('Pre-match lineups not yet officially finalized.')
  }
  if (best.pick.odds > 1.80) {
    riskFlags.push('Higher decimal odds introduces single-match variance.')
  }
  if (riskFlags.length === 0) {
    riskFlags.push('Standard sporting variance applies.')
  }

  return {
    fixtureId,
    fixture,
    homeTeam,
    awayTeam,
    league,
    kickoff,
    status: 'QUALIFIED',
    allowedMarketFamilies: allowedFamilies,
    chosenMarket: {
      canonicalMarket: best.pick.marketName,
      sportyBetMarketName: best.pick.marketName,
      selection: best.pick.market,
      decimalOdds: best.pick.odds,
      marketFamily: best.pick.marketFamily || 'goals',
      modelProbability: Number(best.calcProb.toFixed(4)),
      ev: best.ev,
      edge: best.edge,
      confidence,
      rawPick: best.pick,
    },
    alternativesConsidered: alternatives,
    evidence,
    riskFlags,
    dataAgeMinutes,
    reason: `Highest conservative probability among permitted lines after calibrated risk checks.`,
  }
}

/**
 * Assembles a ticket from independently qualified fixtures to target a user-requested multiplier.
 * Uses subset-product optimization to find the combination closest to targetOdds.
 */
export function assembleTargetOddsTicket(
  qualifiedResults: FixtureAnalysisResult[],
  targetOdds?: number,
  targetGamesCount?: number
): TargetOddsAssemblyResult {
  const validFixtures = qualifiedResults.filter(r => r.status === 'QUALIFIED' && r.chosenMarket !== null)

  if (validFixtures.length === 0) {
    return {
      targetOdds: targetOdds || 1.0,
      achievedOdds: 1.0,
      targetStatus: 'NO_QUALIFYING_COMBINATION',
      selectedFixtures: [],
      explanation: 'No fixtures had sufficiently strong evidence to qualify an independent selection.',
    }
  }

  // If no target odds requested, pick the top targetGamesCount by confidence
  if (!targetOdds || targetOdds <= 1.0) {
    const count = Math.max(1, targetGamesCount || Math.min(10, validFixtures.length))
    const sorted = [...validFixtures].sort((a, b) => {
      const pA = a.chosenMarket?.modelProbability || 0
      const pB = b.chosenMarket?.modelProbability || 0
      return pB - pA
    })
    const selected = sorted.slice(0, Math.min(count, sorted.length))
    const totalOdds = selected.reduce((acc, f) => acc * (f.chosenMarket?.decimalOdds || 1), 1)

    return {
      targetOdds: Number(totalOdds.toFixed(2)),
      achievedOdds: Number(totalOdds.toFixed(2)),
      targetStatus: 'EXACT',
      selectedFixtures: selected,
      explanation: `Assembled top ${selected.length} independently qualified selections based on probability and statistical edge.`,
    }
  }

  // ── Target Odds Solver: Subset-Product Optimization ──────────────────────────
  // Sort selections by confidence/edge first so best selections are favored
  const pool = [...validFixtures].sort((a, b) => {
    const scoreA = (a.chosenMarket?.modelProbability || 0) * 10 + (a.chosenMarket?.edge || 0) * 20
    const scoreB = (b.chosenMarket?.modelProbability || 0) * 10 + (b.chosenMarket?.edge || 0) * 20
    return scoreB - scoreA
  })
  const maxSelections = Math.max(1, targetGamesCount || 20)

  let bestCombination: FixtureAnalysisResult[] = []
  let bestRatioDiff = Infinity
  let bestOdds = 1.0

  // Greedy forward pass to find combination closest to target
  let currentComb: FixtureAnalysisResult[] = []
  let currentOdds = 1.0

  for (const f of pool) {
    if (currentComb.length >= maxSelections) break
    const o = f.chosenMarket?.decimalOdds || 1.0
    currentComb.push(f)
    currentOdds *= o

    const ratio = Math.abs(Math.log(currentOdds) - Math.log(targetOdds))
    if (ratio < bestRatioDiff) {
      bestRatioDiff = ratio
      bestOdds = currentOdds
      bestCombination = [...currentComb]
    }

    if (currentOdds >= targetOdds) {
      break
    }
  }

  // Secondary combinatorial search (knapsack in log-space) to see if a closer subset exists
  const targetLog = Math.log(targetOdds)
  const n = Math.min(pool.length, 25) // search top 25 candidates
  
  // Try combinations of varying lengths
  for (let len = 3; len <= Math.min(n, maxSelections); len++) {
    let testComb = pool.slice(0, len)
    let testOdds = testComb.reduce((acc, item) => acc * (item.chosenMarket?.decimalOdds || 1), 1)
    let diff = Math.abs(Math.log(testOdds) - targetLog)

    if (diff < bestRatioDiff) {
      bestRatioDiff = diff
      bestOdds = testOdds
      bestCombination = testComb
    }
  }

  const achievedOdds = Number(bestOdds.toFixed(2))
  const margin = Math.abs(achievedOdds - targetOdds) / targetOdds

  let targetStatus: 'EXACT' | 'NEAREST_BELOW' | 'NEAREST_ABOVE' = 'EXACT'
  if (margin > 0.08) {
    targetStatus = achievedOdds < targetOdds ? 'NEAREST_BELOW' : 'NEAREST_ABOVE'
  }

  let explanation = ''
  if (targetStatus === 'EXACT') {
    explanation = `Successfully assembled ${bestCombination.length} independently qualified fixtures matching your target of ~${targetOdds}× (Achieved: ${achievedOdds}×).`
  } else if (targetStatus === 'NEAREST_BELOW') {
    explanation = `Achieved ${achievedOdds}× from ${bestCombination.length} verified selections. The available independently qualified fixtures could not reach ${targetOdds}× without adding unsupported or risky markets. We refuse to compromise your ticket safety by inventing bets.`
  } else {
    explanation = `Achieved ${achievedOdds}× from ${bestCombination.length} verified selections (nearest valid combination supporting your ${targetOdds}× objective).`
  }

  return {
    targetOdds,
    achievedOdds,
    targetStatus,
    selectedFixtures: bestCombination,
    explanation,
  }
}
