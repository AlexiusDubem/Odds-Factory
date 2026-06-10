import type { Match, OptimizationGoal, Slip, SlipLeg } from '../types'
import { analyzeMatch, getSafestEquivalent } from './markets'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditResult {
  leg: SlipLeg
  changed: boolean
  previousMarket?: string
  message: string
  dropped?: boolean
}

// ─── Single-leg helpers ───────────────────────────────────────────────────────

/**
 * Re-profile a leg from scratch using the engine's top recommendation for
 * the supplied match. Keeps rawSelection IDs so generation still works.
 */
export function reProfileLeg(match: Match, existingLeg: SlipLeg): EditResult {
  const analysis = analyzeMatch(match)
  const best = analysis.recommendations[0]

  if (!best) {
    return {
      leg: existingLeg,
      changed: true,
      dropped: true,
      message: 'No safe qualifying market found. Dropping risky leg.',
    }
  }

  const changed = existingLeg.market !== best.market

  const updatedLeg: SlipLeg = {
    ...existingLeg,
    profile: analysis.profile,
    market: best.market,
    odds: best.odds,
    probability: best.probability,
    ev: best.ev,
    tier: best.tier,
    rationale: best.rationale,
    previousMarket: changed ? existingLeg.market : undefined,
    wasSwapped: changed,
  }

  if (changed && best.marketId && best.outcomeId) {
    updatedLeg.rawSelection = {
      ...updatedLeg.rawSelection,
      eventId: match.id,
      marketId: best.marketId,
      outcomeId: best.outcomeId,
      specifier: best.specifier || ''
    }
  }

  return {
    leg: updatedLeg,
    changed,
    previousMarket: changed ? existingLeg.market : undefined,
    message: changed
      ? `Re-profiled: ${existingLeg.market} → ${best.market} (${analysis.profileLabel})`
      : `Market still optimal for ${analysis.profileLabel}`,
  }
}

/**
 * Upgrade a leg to its safest equivalent. If the leg is already strong
 * (Tier 1, ≥68% probability) it is left untouched.
 */
export function optimizeLegSafely(match: Match, existingLeg: SlipLeg): EditResult {
  if (existingLeg.tier === 1 && existingLeg.probability >= 68) {
    return {
      leg: { ...existingLeg, wasSwapped: false },
      changed: false,
      message: 'Strong Tier 1 leg kept as-is.',
    }
  }

  const safer = getSafestEquivalent(match, existingLeg.market)
  if (!safer) {
    return reProfileLeg(match, existingLeg)
  }

  if (safer.probability <= existingLeg.probability && existingLeg.tier <= safer.tier) {
    return {
      leg: { ...existingLeg, wasSwapped: false },
      changed: false,
      message: 'Original market is already the safest equivalent.',
    }
  }

  const updatedLeg: SlipLeg = {
    ...existingLeg,
    market: safer.market,
    odds: safer.odds,
    probability: safer.probability,
    ev: safer.ev,
    tier: safer.tier,
    rationale: safer.rationale,
    isOriginal: false,
    previousMarket: existingLeg.market,
    wasSwapped: true,
  }

  if (safer.marketId && safer.outcomeId) {
    updatedLeg.rawSelection = {
      ...updatedLeg.rawSelection,
      eventId: match.id,
      marketId: safer.marketId,
      outcomeId: safer.outcomeId,
      specifier: safer.specifier || ''
    }
  }

  return {
    leg: updatedLeg,
    changed: true,
    previousMarket: existingLeg.market,
    message: `Upgraded safety: ${existingLeg.market} → ${safer.market}`,
  }
}

// ─── Goal-aware optimizer ─────────────────────────────────────────────────────

function calcCombinedOdds(legs: SlipLeg[]): number {
  return legs.reduce((acc, l) => acc * l.odds, 1)
}

function calcSurvival(legs: SlipLeg[]): number {
  return legs.reduce((acc, l) => acc * (l.probability / 100), 1) * 100
}

/**
 * Best-EV: for every leg, swap to the highest-EV market the engine recommends.
 * The match itself is never changed.
 */
function applyBestEV(legs: SlipLeg[], matches: Map<string, Match>): EditResult[] {
  return legs.map((leg, index) => {
    const match = matches.get(leg.matchId)
    if (!match) {
      return { leg, changed: false, message: `Line ${index + 1}: Match data not found.` }
    }
    const analysis = analyzeMatch(match)
    // Sort by EV descending
    const sorted = [...analysis.recommendations].sort((a, b) => b.ev - a.ev)
    const best = sorted[0]
    if (!best || best.market === leg.market) {
      return { leg: { ...leg, wasSwapped: false }, changed: false, message: `Line ${index + 1}: Already best EV market.` }
    }
    const updated: SlipLeg = {
      ...leg,
      market: best.market,
      odds: best.odds,
      probability: best.probability,
      ev: best.ev,
      tier: best.tier,
      rationale: best.rationale,
      previousMarket: leg.market,
      wasSwapped: true,
    }
    if (best.marketId && best.outcomeId) {
      updated.rawSelection = {
        ...updated.rawSelection,
        eventId: match.id,
        marketId: best.marketId,
        outcomeId: best.outcomeId,
        specifier: best.specifier || ''
      }
    }
    return {
      leg: updated,
      changed: true,
      previousMarket: leg.market,
      message: `Line ${index + 1}: Best EV → ${best.market} (EV ${best.ev.toFixed(2)})`,
    }
  })
}

/**
 * Safe-mode: swap every leg to the Tier-1 market with highest probability.
 */
function applySafeMode(legs: SlipLeg[], matches: Map<string, Match>): EditResult[] {
  return legs.map((leg, index) => {
    const match = matches.get(leg.matchId)
    if (!match) {
      return { leg, changed: false, message: `Line ${index + 1}: Match data not found.` }
    }
    const result = optimizeLegSafely(match, leg)
    return {
      ...result,
      message: `Line ${index + 1}: ${result.message}`,
    }
  })
}

/**
 * Target Odds: walk legs sorted by highest individual odds and try to swap
 * each to a lower-odds (but still qualifying) market until combined odds ≤ target.
 */
function applyTargetOdds(
  legs: SlipLeg[],
  matches: Map<string, Match>,
  targetOdds: number
): EditResult[] {
  // We'll work on a mutable copy of edit results
  const edits: EditResult[] = legs.map((leg) => ({ leg, changed: false, message: '' }))
  let current = calcCombinedOdds(legs)

  if (current <= targetOdds) {
    edits.forEach((e, i) => { e.message = `Line ${i + 1}: Already within target odds.` })
    return edits
  }

  // Sort indices by individual odds descending (riskiest first)
  const order = [...legs.keys()].sort((a, b) => legs[b].odds - legs[a].odds)

  for (const i of order) {
    if (current <= targetOdds) break
    const leg = edits[i].leg
    const match = matches.get(leg.matchId)
    if (!match) {
      edits[i].message = `Line ${i + 1}: Match data not found.`
      continue
    }

    const analysis = analyzeMatch(match)
    // Find the recommendation with lowest odds that is still ≥ MIN_PROBABILITY and different from current
    const candidate = [...analysis.recommendations]
      .filter((r) => r.market !== leg.market && r.odds < leg.odds)
      .sort((a, b) => a.odds - b.odds)[0]

    if (!candidate) {
      edits[i].message = `Line ${i + 1}: No lower-odds alternative for ${leg.market}.`
      continue
    }

    // Update combined odds
    current = (current / leg.odds) * candidate.odds

    const updated: SlipLeg = {
      ...leg,
      market: candidate.market,
      odds: candidate.odds,
      probability: candidate.probability,
      ev: candidate.ev,
      tier: candidate.tier,
      rationale: candidate.rationale,
      previousMarket: leg.market,
      wasSwapped: true,
    }
    if (candidate.marketId && candidate.outcomeId) {
      updated.rawSelection = {
        ...updated.rawSelection,
        eventId: match.id,
        marketId: candidate.marketId,
        outcomeId: candidate.outcomeId,
        specifier: candidate.specifier || ''
      }
    }
    edits[i] = {
      leg: updated,
      changed: true,
      previousMarket: leg.market,
      message: `Line ${i + 1}: Odds reduced: ${leg.market} (${leg.odds.toFixed(2)}) → ${candidate.market} (${candidate.odds.toFixed(2)})`,
    }
  }

  // 2. Trim (drop) legs if still above target
  if (current > targetOdds) {
    const dropOrder = [...legs.keys()].sort((a, b) => edits[b].leg.odds - edits[a].leg.odds)
    for (const i of dropOrder) {
      if (current <= targetOdds) break
      current = current / edits[i].leg.odds
      edits[i].dropped = true
      edits[i].changed = true
      edits[i].message = `Line ${i + 1}: Trimmed (removed) to hit target odds.`
    }
  }

  return edits
}

/**
 * Target Survival: walk legs sorted by lowest probability first and swap each
 * to a higher-probability market until cumulative survival ≥ target.
 */
function applyTargetSurvival(
  legs: SlipLeg[],
  matches: Map<string, Match>,
  targetSurvival: number
): EditResult[] {
  const edits: EditResult[] = legs.map((leg) => ({ leg, changed: false, message: '' }))
  let currentSurvival = calcSurvival(edits.map((e) => e.leg))

  if (currentSurvival >= targetSurvival) {
    edits.forEach((e, i) => { e.message = `Line ${i + 1}: Already meets survival target.` })
    return edits
  }

  // Sort indices by probability ascending (weakest legs first)
  const order = [...legs.keys()].sort((a, b) => legs[a].probability - legs[b].probability)

  for (const i of order) {
    if (currentSurvival >= targetSurvival) break
    const leg = edits[i].leg
    const match = matches.get(leg.matchId)
    if (!match) {
      edits[i].message = `Line ${i + 1}: Match data not found.`
      continue
    }

    const analysis = analyzeMatch(match)
    // Find recommendation with highest probability that is different from current
    const candidate = [...analysis.recommendations]
      .filter((r) => r.market !== leg.market && r.probability > leg.probability)
      .sort((a, b) => b.probability - a.probability)[0]

    if (!candidate) {
      edits[i].message = `Line ${i + 1}: No higher-probability alternative for ${leg.market}.`
      continue
    }

    // Recalculate survival
    currentSurvival = (currentSurvival / (leg.probability / 100)) * (candidate.probability / 100)

    const updated: SlipLeg = {
      ...leg,
      market: candidate.market,
      odds: candidate.odds,
      probability: candidate.probability,
      ev: candidate.ev,
      tier: candidate.tier,
      rationale: candidate.rationale,
      previousMarket: leg.market,
      wasSwapped: true,
    }
    if (candidate.marketId && candidate.outcomeId) {
      updated.rawSelection = {
        ...updated.rawSelection,
        eventId: match.id,
        marketId: candidate.marketId,
        outcomeId: candidate.outcomeId,
        specifier: candidate.specifier || ''
      }
    }
    edits[i] = {
      leg: updated,
      changed: true,
      previousMarket: leg.market,
      message: `Line ${i + 1}: Survival improved: ${leg.market} (${leg.probability.toFixed(1)}%) → ${candidate.market} (${candidate.probability.toFixed(1)}%)`,
    }
  }

  return edits
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Optimize a slip according to the user's selected goal using Gemini AI.
 * Sends the slip and available markets to the backend for real-world form analysis.
 */
export async function optimizeSlipWithGoal(
  slip: Slip,
  matches: Map<string, Match>,
  goal: OptimizationGoal,
  availableMarkets: Map<string, any[]>
): Promise<{ slip: Slip; edits: EditResult[] }> {
  const freshLegs: SlipLeg[] = slip.legs.map((l) => ({
    ...l,
    wasSwapped: false,
    previousMarket: undefined,
  }))

  const marketsPayload: Record<string, any[]> = {}
  freshLegs.forEach(leg => {
    if (availableMarkets.has(leg.matchId)) {
      marketsPayload[leg.matchId] = availableMarkets.get(leg.matchId)!
    }
  })

  const response = await fetch('/api/local/ai-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ legs: freshLegs, goal, availableMarkets: marketsPayload })
  })

  if (!response.ok) {
    throw new Error('Failed to reach AI Optimizer backend')
  }

  const data = await response.json()
  if (!data.success) throw new Error(data.error || 'AI Optimization failed')

  const edits: EditResult[] = []
  
  data.edits.forEach((aiEdit: any) => {
    const originalLeg = freshLegs.find(l => l.id === aiEdit.legId)
    if (!originalLeg) return

    if (aiEdit.dropped) {
      edits.push({ leg: originalLeg, changed: true, dropped: true, message: aiEdit.message || 'Dropped by AI.' })
      return
    }

    if (!aiEdit.changed || !aiEdit.newMarket) {
      edits.push({ leg: originalLeg, changed: false, message: aiEdit.message || 'Kept original.' })
      return
    }

    const matchMarkets = marketsPayload[originalLeg.matchId] || []
    const newMarketData = matchMarkets.find((m: any) => m.desc === aiEdit.newMarket)

    if (newMarketData) {
      const firstOutcome = newMarketData.outcomes?.[0] || { odds: 1.5, id: '1' }
      const newOdds = Number(firstOutcome.odds) || 1.5
      const newLeg: SlipLeg = {
        ...originalLeg,
        market: aiEdit.newMarket,
        odds: newOdds,
        probability: Math.min(100, (100 / newOdds) * 0.9),
        wasSwapped: true,
        previousMarket: originalLeg.market,
        rawSelection: {
          ...originalLeg.rawSelection,
          marketId: newMarketData.id,
          outcomeId: firstOutcome.id,
          specifier: newMarketData.specifier || ''
        }
      }
      edits.push({ leg: newLeg, changed: true, previousMarket: originalLeg.market, message: aiEdit.message })
    } else {
      edits.push({ leg: originalLeg, changed: false, message: `[AI Hallucinated] Could not find market ${aiEdit.newMarket}. Kept original.` })
    }
  })

  const optimizedLegs = edits.filter((e) => !e.dropped).map((e) => e.leg)
  const combinedOdds = calcCombinedOdds(optimizedLegs)
  const survivalProbability = calcSurvival(optimizedLegs)

  return {
    slip: {
      ...slip,
      legs: optimizedLegs,
      combinedOdds,
      survivalProbability,
    },
    edits,
  }
}

/**
 * Legacy entry point.
 */
export async function optimizeSlip(
  slip: Slip,
  matches: Map<string, Match>,
  availableMarkets: Map<string, any[]>
): Promise<{ slip: Slip; edits: EditResult[] }> {
  return optimizeSlipWithGoal(slip, matches, { mode: 'safe_mode' }, availableMarkets)
}