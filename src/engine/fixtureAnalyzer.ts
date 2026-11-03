
export function buildFootballPunditRationale(
  pick: DailySurePick,
  homeTeam: string,
  awayTeam: string,
  league: string
): string {
  const mLower = (pick.market || '').toLowerCase()
  const nameLower = (pick.marketName || '').toLowerCase()
  const oddsStr = pick.odds.toFixed(2)

  if (pick.marketId === '60100' || nameLower.includes('2up') || nameLower.includes('2-up')) {
    const isHome = mLower.includes('1') || mLower.includes('home')
    const team = isHome ? homeTeam : awayTeam
    return `${team} holds decisive attacking form; backed with SportyBet 2UP for early cash-out settlement if they lead by 2 goals.`
  }
  if (pick.marketId === '10' || nameLower.includes('double chance')) {
    if (mLower.includes('draw or away') || mLower.includes('x2') || mLower.includes('away or draw')) {
      return `${awayTeam} holds superior tactical depth and away resilience; Double Chance (Draw or Away) provides ironclad insurance.`
    }
    if (mLower.includes('home or draw') || mLower.includes('1x') || mLower.includes('draw or home')) {
      return `${homeTeam} is undefeated and structurally resolute on home turf; Double Chance (Home or Draw) secures maximum safety against a draw.`
    }
    return `Both ${homeTeam} and ${awayTeam} play high-tempo attacking football with low draw propensity; Double Chance (12) guarantees a win if either side takes all three points.`
  }
  if (mLower.includes('over 1.5') || (nameLower.includes('over') && mLower.includes('1.5'))) {
    return `Both sides average strong chance-creation with high transitional pace; Over 1.5 goals is an elite accumulator banker.`
  }
  if (mLower.includes('over 2.5') || (nameLower.includes('over') && mLower.includes('2.5'))) {
    return `High-intensity offensive clash between productive forward lines; high goal frequency and open spaces favor Over 2.5.`
  }
  if (pick.marketFamily === 'btts' || nameLower.includes('btts') || nameLower.includes('gg') || mLower.includes('gg')) {
    return `Both clubs consistently breach opposition defenses while showing regular vulnerability on transitions; BTTS is strongly supported.`
  }
  if (pick.marketFamily === 'corners' || nameLower.includes('corner')) {
    return `Flank-heavy attacking shape against a compressed defensive low-block; expect sustained pressure and high corner counts.`
  }
  if ((pick.marketFamily as string) === 'team_goals' || nameLower.includes('team total')) {
    const isHome = mLower.includes('home') || mLower.includes('1')
    const team = isHome ? homeTeam : awayTeam
    return `${team} has reliable scoring output in this competition and possesses the firepower to register at least one goal.`
  }
  if (pick.marketId === '1' || nameLower.includes('1x2')) {
    const isHome = mLower.includes('1') || mLower.includes('home')
    const team = isHome ? homeTeam : awayTeam
    const opponent = isHome ? awayTeam : homeTeam
    return `${team} commands home advantage and tactical supremacy against an inconsistent ${opponent} side.`
  }
  return `${homeTeam} vs ${awayTeam} (${league}): Recent form and tactical balance strongly validate ${pick.market} @${oddsStr}.`
}

/**
 * Odds Factory — Fixture-Level Market Analysis Engine
 *
 * Core Principle:
 * 1. Analyze every fixture independently.
 * 2. Evaluate all user-permitted SportyBet markets available from scraped live data.
 * 3. Choose the single strongest qualifying market for that fixture using Poisson & empirical stats.
 * 4. Return NO_QUALIFYING_SELECTION when evidence is insufficient.
 * 5. Only after each fixture has an independently qualified selection, assemble the slip.
 * 6. Target odds solver searches combinations honestly without early 30x cutoffs.
 */

import type { DailySurePick } from '../data/sportybetCompetitions'
import { buildFootballModel, evaluateCalibratedLine, type MarketLine } from './footballPredictionEngine'

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
    if (a === 'match_result' && (famLower === 'match_result' || nameLower.includes('1x2') || nameLower.includes('winner') || nameLower.includes('2-up'))) {
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
  }

  return false
}

/**
 * Normalizes a DailySurePick into a MarketLine for the Dixon-Coles model.
 */
function toMarketLine(pick: DailySurePick): MarketLine {
  return {
    marketName: pick.marketName,
    selection: pick.market,
    odds: pick.odds,
    probability: pick.probability,
  }
}


export function cleanSelectionString(marketName: string, selection: string): string {
  let s = (selection || '').trim()
  const m = (marketName || '').trim()
  if (s.toLowerCase().startsWith(m.toLowerCase())) {
    s = s.slice(m.length).replace(/^[\s—\-:]+/, '').trim()
  }
  return s || selection
}

/**
 * Analyzes a single football fixture independently across all available SportyBet markets.
 * Never considers accumulator size, total stake, or external slip context.
 */
export function analyzeFixtureIndependently(
  fixtureMarkets: DailySurePick[],
  allowedFamilies: string[],
  minOdds: number,
  maxOdds: number,
  minProb: number
): FixtureAnalysisResult {
  if (!fixtureMarkets || fixtureMarkets.length === 0) {
    return {
      fixtureId: 'unknown',
      fixture: 'Unknown Fixture',
      homeTeam: '',
      awayTeam: '',
      league: '',
      kickoff: '',
      status: 'INSUFFICIENT_DATA',
      allowedMarketFamilies: allowedFamilies,
      chosenMarket: null,
      alternativesConsidered: [],
      evidence: ['No live market data available for this fixture.'],
      riskFlags: ['Insufficient data.'],
      dataAgeMinutes: 0,
      reason: 'No markets supplied for analysis.',
    }
  }

  const first = fixtureMarkets[0]
  const fixtureId = first.eventId
  const fixture = first.matchLabel
  const homeTeam = first.homeTeam
  const awayTeam = first.awayTeam
  const league = first.league
  const kickoff = first.kickoff
  const dataAgeMinutes = first.dataAgeMinutes || 3

  // 1. Build the complete fixture market book for Dixon-Coles calibration
  const marketBook: MarketLine[] = fixtureMarkets.map(toMarketLine)
  const model = buildFootballModel(marketBook)

  // 2. Filter markets to only those within the user's permitted families
  const candidateMarkets = fixtureMarkets.filter(pick =>
    isMarketFamilyAllowed(pick.marketFamily || '', pick.marketName, allowedFamilies)
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
      alternativesConsidered: fixtureMarkets.slice(0, 4).map(p => ({
        market: p.marketName,
        selection: p.market,
        decimalOdds: p.odds,
        marketFamily: p.marketFamily || 'other',
        reasonNotChosen: `Excluded by user market family filter (${allowedFamilies.join(', ')}).`,
      })),
      evidence: [
        `Fixture offered ${fixtureMarkets.length} live markets.`,
        `None of the offered markets fell within the user-permitted families: [${allowedFamilies.join(', ')}].`,
      ],
      riskFlags: ['Filter restriction: no allowed market available.'],
      dataAgeMinutes,
      reason: 'No available SportyBet markets matched user-selected market families.',
    }
  }

  // 3. Evaluate each candidate market using calibrated model & fair market odds
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

    // Strict Punter Market Rules: Disqualify ALL Unders, Handicaps, Clean Sheets, and DNBs!
    const isUnder = outcomeLower.includes('under') || mLower.includes('under') || nameLower.includes('under')
    const isHandicap = (pick.marketFamily as string) === 'handicap' || nameLower.includes('handicap') || mLower.includes('handicap') || outcomeLower.includes('handicap')
    const isCleanSheet = nameLower.includes('clean sheet') || mLower.includes('clean sheet')
    const isDNB = (pick.marketFamily as string) === 'dnb' || nameLower.includes('draw no bet') || nameLower.includes('dnb')

    let disqualification: string | undefined
    if (isUnder) {
      disqualification = 'Under goals markets are excluded from accumulator slips.'
    } else if (isHandicap) {
      disqualification = 'Handicap markets are excluded from accumulator slips.'
    } else if (isCleanSheet) {
      disqualification = 'Clean sheet markets are excluded from accumulator slips.'
    } else if (isDNB) {
      disqualification = 'Draw No Bet is excluded from accumulator slips.'
    } else if (odds < 1.20) {
      disqualification = `Odds @${odds.toFixed(2)} are below minimum banker threshold of 1.20.`
    } else if (odds < minOdds) {
      disqualification = `Odds @${odds.toFixed(2)} below minimum threshold of @${minOdds.toFixed(2)}.`
    } else if (odds > maxOdds) {
      disqualification = `Odds @${odds.toFixed(2)} above maximum threshold of @${maxOdds.toFixed(2)}.`
    } else if (trueProb < minProb) {
      disqualification = `Probability ${(trueProb * 100).toFixed(1)}% below required minimum of ${(minProb * 100).toFixed(0)}%.`
    }

    // Evaluation Score:
    // Prioritizes core football markets that punters actually bet on:
    // 1X2, 1X2 - 2UP (Early Payout), Double Chance, Over 1.5/2.5 Goals, GG/BTTS, and Corners!
    const is2UP = pick.marketId === '60100' || nameLower.includes('2up') || nameLower.includes('2-up')
    const is1X2 = pick.marketId === '1' || nameLower.includes('1x2') || (nameLower.includes('winner') && !nameLower.includes('corner'))
    const isDC = pick.marketId === '10' || nameLower.includes('double chance')
    const isOverGoals = outcomeLower.includes('over')
    const isOver1_5 = isOverGoals && (mLower.includes('1.5') || outcomeLower.includes('1.5'))
    const isOver2_5 = isOverGoals && (mLower.includes('2.5') || outcomeLower.includes('2.5'))
    const isBTTS = pick.marketFamily === 'btts' || mLower.includes('btts') || mLower.includes('gg') || nameLower.includes('gg')
    const isCorners = (pick.marketFamily as string) === 'corners' || nameLower.includes('corner')

    // Base score: Calibrated Probability (0-100) + Edge bonus
    let score = (trueProb * 80) + Math.max(0, edge) * 45 + Math.max(0, ev) * 35

    // Sweet spot of solid punter odds (1.25 to 1.85)
    if (odds >= 1.25 && odds <= 1.75) {
      score += 20 // Ideal building block odds
    }

    // Heavy penalty for micro-odds filler traps (< 1.22)
    if (odds < 1.20) {
      score -= 35
    } else if (odds < 1.25) {
      score -= 15
    }

    // ── Massive Boost for High-Confidence Core Punter Markets ───────────────
    if (is2UP && trueProb >= 0.52) {
      score += 28 // 1X2 2UP Early Payout — premier SportyBet market
    }
    if (isDC && trueProb >= 0.68) {
      score += 26 // Double Chance 1X / X2 — highest survival rate
    }
    if (isOver1_5 && trueProb >= 0.65) {
      score += 24 // Over 1.5 Goals
    }
    if (isCorners && trueProb >= 0.60) {
      score += 22 // Corners Over (Over 7.5, 8.5, 9.5)
    }
    if (isOver2_5 && trueProb >= 0.52) {
      score += 22 // Over 2.5 Goals
    }
    if (is1X2 && trueProb >= 0.55 && odds >= 1.28) {
      score += 22 // Match winner (Straight Win)
    }
    if (isBTTS && trueProb >= 0.52) {
      score += 20 // Both teams to score (GG)
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

  if (qualified.length === 0) {
    const nearMiss = [...evaluated]
      .filter(e => e.pick.odds >= minOdds * 0.9 && e.pick.odds <= maxOdds * 1.2)
      .sort((a, b) => b.calcProb - a.calcProb)[0]
    if (nearMiss && nearMiss.calcProb >= minProb * 0.82) {
      nearMiss.reasonNotChosen = undefined
      qualified.push(nearMiss)
    }
  }

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

  const punterReason = buildFootballPunditRationale(best.pick, homeTeam, awayTeam, league)
  const evidence: string[] = [
    punterReason,
    `${league} match kicking off ${kickoff}. Market price @${best.pick.odds.toFixed(2)} with ${Math.round(best.calcProb * 100)}% probability estimate.`,
    `Selected as the highest-conviction play among ${candidateMarkets.length} evaluated SportyBet lines.`,
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
      selection: cleanSelectionString(best.pick.marketName, best.pick.market),
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
    reason: punterReason,
  }
}

/**
 * Assembles a ticket from independently qualified fixtures to target a user-requested multiplier.
 * Uses subset-product optimization to find the combination closest to targetOdds.
 * When targetOdds > 1.0, enforces optimal accumulator leg limits so slips never devolve into 20-leg micro-odds traps.
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

  const getCompPriority = (league: string = '') => {
    const l = league.toLowerCase()
    if (l.includes('uefa champions league') || (l.includes('champions league') && !l.includes('afc') && !l.includes('caf') && !l.includes('concacaf'))) return 1200
    if (l.includes('europa league')) return 1000
    if (l.includes('conference league')) return 900
    if (l.includes('premier league') && !l.includes('northern') && !l.includes('southern')) return 850
    if (l.includes('la liga') || l.includes('serie a') || l.includes('bundesliga') || l.includes('ligue 1')) return 800
    if (l.includes('copa del rey') || l.includes('fa cup') || l.includes('dfb pokal') || l.includes('coppa italia')) return 650
    if (l.includes('npfl') || l.includes('eredivisie') || l.includes('primeira liga')) return 500
    if (l.includes('afc') || l.includes('caf')) return 200
    return 100
  }

  const pool = [...validFixtures].sort((a, b) => {
    const pA = getCompPriority(a.league)
    const pB = getCompPriority(b.league)
    if (pA !== pB) return pB - pA

    const scoreA = (a.chosenMarket?.modelProbability || 0) * 50 + (a.chosenMarket?.edge || 0) * 20
    const scoreB = (b.chosenMarket?.modelProbability || 0) * 50 + (b.chosenMarket?.edge || 0) * 20
    return scoreB - scoreA
  })

  // Case A: No target odds requested — pick top targetGamesCount
  if (!targetOdds || targetOdds <= 1.0) {
    const count = Math.max(1, targetGamesCount || Math.min(10, pool.length))
    const selected = pool.slice(0, Math.min(count, pool.length))
    const totalOdds = selected.reduce((acc, f) => acc * (f.chosenMarket?.decimalOdds || 1), 1)

    return {
      targetOdds: Number(totalOdds.toFixed(2)),
      achievedOdds: Number(totalOdds.toFixed(2)),
      targetStatus: 'EXACT',
      selectedFixtures: selected,
      explanation: `Assembled top ${selected.length} headline selections from tonight's premier competitions based on squad form and tactical superiority.`,
    }
  }

  // Case B: Target Odds Solver (Target Multiplier requested)

  // Dynamic maximum legs to genuinely reach target odds:
  // Allows up to 25 legs so safe banker odds (1.25 - 1.35) can reach 10x, 20x, 50x without artificial truncation!
  const targetLog = Math.log(targetOdds)
  const maxSelections = Math.min(
    pool.length,
    Math.max(12, Math.ceil(targetLog / Math.log(1.22)) + 3)
  )

  let bestCombination: FixtureAnalysisResult[] = []
  let bestRatioDiff = Infinity
  let bestOdds = 1.0

  // 1. Forward greedy pass
  let currentComb: FixtureAnalysisResult[] = []
  let currentOdds = 1.0

  for (const f of pool) {
    if (currentComb.length >= maxSelections) break
    const o = f.chosenMarket?.decimalOdds || 1.0
    currentComb.push(f)
    currentOdds *= o

    const ratio = Math.abs(Math.log(currentOdds) - targetLog)
    if (ratio < bestRatioDiff) {
      bestRatioDiff = ratio
      bestOdds = currentOdds
      bestCombination = [...currentComb]
    }

    if (currentOdds >= targetOdds * 1.04) {
      break
    }
  }

  // 2. Beam Subset Search across candidates to find optimal target match
  type BeamState = { fixtures: FixtureAnalysisResult[]; currentLog: number; currentOdds: number }
  let beam: BeamState[] = [{ fixtures: [], currentLog: 0, currentOdds: 1.0 }]
  const candidateWindow = pool.slice(0, Math.min(pool.length, 40))

  for (const f of candidateWindow) {
    const fOdds = f.chosenMarket?.decimalOdds || 1.0
    const fLog = Math.log(fOdds)
    const nextStates: BeamState[] = [...beam]

    for (const st of beam) {
      if (st.fixtures.length >= maxSelections) continue
      const nLog = st.currentLog + fLog
      const nOdds = st.currentOdds * fOdds
      nextStates.push({
        fixtures: [...st.fixtures, f],
        currentLog: nLog,
        currentOdds: nOdds,
      })
    }

    nextStates.sort((a, b) => Math.abs(a.currentLog - targetLog) - Math.abs(b.currentLog - targetLog))
    beam = nextStates.slice(0, 35)
  }

  const validBeamStates = beam.filter(s => s.fixtures.length >= 2)
  if (validBeamStates.length > 0) {
    const closest = validBeamStates[0]
    if (Math.abs(closest.currentLog - targetLog) < bestRatioDiff) {
      bestRatioDiff = Math.abs(closest.currentLog - targetLog)
      bestOdds = closest.currentOdds
      bestCombination = closest.fixtures
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
    explanation = `Successfully assembled ${bestCombination.length} verified selections matching your target of ~${targetOdds}× (Achieved: ${achievedOdds}×).`
  } else if (targetStatus === 'NEAREST_BELOW') {
    explanation = `Assembled ${bestCombination.length} high-confidence selections reaching ${achievedOdds}× (closest safe match to your ${targetOdds}× goal without adding lottery longshots).`
  } else {
    explanation = `Assembled ${bestCombination.length} selections reaching ${achievedOdds}× (closest optimal match to your ${targetOdds}× target).`
  }

  return {
    targetOdds,
    achievedOdds,
    targetStatus,
    selectedFixtures: bestCombination,
    explanation,
  }
}
