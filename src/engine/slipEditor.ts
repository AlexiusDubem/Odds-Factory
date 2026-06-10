import type { Match, OptimizationGoal, Slip, SlipLeg } from '../types'
import { analyzeMatch, getSafestEquivalent, findOdds } from './markets'

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
export function reProfileLeg(match: Match, existingLeg: SlipLeg, availableMarketsMap?: Map<string, any[]>): EditResult {
  const analysis = analyzeMatch(match, availableMarketsMap)
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
export function optimizeLegSafely(match: Match, existingLeg: SlipLeg, availableMarketsMap?: Map<string, any[]>): EditResult {
  if (existingLeg.tier === 1 && existingLeg.probability >= 68) {
    return {
      leg: { ...existingLeg, wasSwapped: false },
      changed: false,
      message: 'Strong Tier 1 leg kept as-is.',
    }
  }

  const safer = getSafestEquivalent(match, existingLeg.market, availableMarketsMap)
  if (!safer) {
    return reProfileLeg(match, existingLeg, availableMarketsMap)
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



function formatSwap(leg: SlipLeg, candidate: any, match: Match, message: string): EditResult {
  if (!candidate || leg.market === candidate.market) {
    return { leg: { ...leg, wasSwapped: false }, changed: false, message: 'Kept original.' }
  }

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
  return { leg: updated, changed: true, previousMarket: leg.market, message }
}

function applyTargetOddsFallback(legs: SlipLeg[], matches: Map<string, Match>, edits: EditResult[], targetOdds: number, availableMarketsMap?: Map<string, any[]>) {
  let current = calcCombinedOdds(legs)
  const draftEdits: EditResult[] = legs.map((leg) => ({ leg, changed: false, message: '' }))

  const order = [...legs.keys()].sort((a, b) => legs[b].odds - legs[a].odds)

  for (const i of order) {
    if (current <= targetOdds) break
    const leg = draftEdits[i].leg
    const match = matches.get(leg.matchId)
    if (!match) continue

    const analysis = analyzeMatch(match, availableMarketsMap)
    const candidate = [...analysis.recommendations].filter((r) => r.market !== leg.market && r.odds < leg.odds).sort((a, b) => a.odds - b.odds)[0]

    if (!candidate) continue

    current = (current / leg.odds) * candidate.odds
    draftEdits[i] = formatSwap(leg, candidate, match, `[Fallback] Reduced odds.`)
  }

  if (current > targetOdds) {
    const dropOrder = [...legs.keys()].sort((a, b) => draftEdits[b].leg.odds - draftEdits[a].leg.odds)
    for (const i of dropOrder) {
      if (current <= targetOdds) break
      current = current / draftEdits[i].leg.odds
      draftEdits[i].dropped = true
      draftEdits[i].changed = true
      draftEdits[i].message = `[Fallback] Trimmed to hit target odds.`
    }
  }
  
  draftEdits.forEach(e => edits.push(e))
}

function applyTargetSurvivalFallback(legs: SlipLeg[], matches: Map<string, Match>, edits: EditResult[], targetSurvival: number, availableMarketsMap?: Map<string, any[]>) {
  let currentSurvival = calcSurvival(legs)
  const draftEdits: EditResult[] = legs.map((leg) => ({ leg, changed: false, message: '' }))

  const order = [...legs.keys()].sort((a, b) => legs[a].probability - legs[b].probability)

  for (const i of order) {
    if (currentSurvival >= targetSurvival) break
    const leg = draftEdits[i].leg
    const match = matches.get(leg.matchId)
    if (!match) continue

    const analysis = analyzeMatch(match, availableMarketsMap)
    const candidate = [...analysis.recommendations].filter((r) => r.market !== leg.market && r.probability > leg.probability).sort((a, b) => b.probability - a.probability)[0]

    if (!candidate) continue

    currentSurvival = (currentSurvival / (leg.probability / 100)) * (candidate.probability / 100)
    draftEdits[i] = formatSwap(leg, candidate, match, `[Fallback] Improved survival.`)
  }
  
  // If still below target survival, drop the most dangerous legs
  if (currentSurvival < targetSurvival) {
    const dropOrder = [...legs.keys()].sort((a, b) => draftEdits[a].leg.probability - draftEdits[b].leg.probability)
    for (const i of dropOrder) {
      if (currentSurvival >= targetSurvival) break
      if (!draftEdits[i].dropped) {
         currentSurvival = currentSurvival / (draftEdits[i].leg.probability / 100)
         draftEdits[i].dropped = true
         draftEdits[i].changed = true
         draftEdits[i].message = `[Fallback] Dropped to boost slip survival.`
      }
    }
  }

  draftEdits.forEach(e => edits.push(e))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Optimize a slip according to the user's selected goal using Gemini AI.
 * Sends the slip and available markets to the backend for real-world form analysis.
 */
export async function optimizeSlipWithGoal(
  slip: Slip,
  _matches: Map<string, Match>,
  goal: OptimizationGoal,
  availableMarkets: Map<string, any[]>
): Promise<{ slip: Slip; edits: EditResult[] }> {
  const freshLegs: SlipLeg[] = slip.legs.map((l) => ({
    ...l,
    wasSwapped: false,
    previousMarket: undefined,
  }))

  const edits: EditResult[] = []

  try {
    const response = await fetch('/api/local/ai-optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legs: freshLegs, goal }),
    })

    if (!response.ok) {
      throw new Error(`Failed to reach AI Optimizer backend: ${response.status}`)
    }

    const data = await response.json()
    if (!data.success) throw new Error(data.error || 'AI Optimization failed')
    
    data.edits.forEach((aiEdit: any) => {
      const originalLeg = freshLegs.find(l => l.id === aiEdit.legId)
      if (!originalLeg) return

      if (aiEdit.dropped) {
        edits.push({ leg: originalLeg, changed: true, dropped: true, message: aiEdit.message || 'Dropped by AI.' })
        return
      }

      if (!aiEdit.changed || !aiEdit.market) {
        edits.push({ leg: originalLeg, changed: false, message: aiEdit.message || 'Kept original.' })
        return
      }

      const match = _matches.get(originalLeg.matchId)
      if (!match) {
        edits.push({ leg: originalLeg, changed: false, message: 'Match not found in memory.' })
        return
      }

      const foundMarket = findOdds(match, aiEdit.market, availableMarkets)
      
      if (foundMarket) {
        const newLeg: SlipLeg = {
          ...originalLeg,
          market: foundMarket.market,
          odds: foundMarket.odds,
          probability: Math.min(100, (100 / foundMarket.odds) * 0.9),
          wasSwapped: true,
          previousMarket: originalLeg.market,
          rawSelection: {
            ...originalLeg.rawSelection,
            marketId: foundMarket.marketId,
            outcomeId: foundMarket.outcomeId,
            specifier: foundMarket.specifier || ''
          }
        }
        edits.push({ leg: newLeg, changed: true, previousMarket: originalLeg.market, message: aiEdit.message })
      } else {
        edits.push({ leg: originalLeg, changed: false, message: `[AI Error] Market "${aiEdit.market}" unavailable in live odds.` })
      }
    })
  } catch (err: any) {
    console.warn('AI Optimization failed, falling back to deterministic logic:', err)
    
    if (goal.mode === 'target_odds') {
      applyTargetOddsFallback(freshLegs, _matches, edits, goal.targetOdds || 20, availableMarkets)
    } else if (goal.mode === 'target_survival') {
      applyTargetSurvivalFallback(freshLegs, _matches, edits, goal.targetSurvival || 60, availableMarkets)
    } else {
      freshLegs.forEach((leg) => {
        const match = _matches.get(leg.matchId)
        if (!match) {
          edits.push({ leg, changed: false, message: `Match data not found.` })
          return
        }

        if (goal.mode === 'safe_mode') {
          const result = optimizeLegSafely(match, leg, availableMarkets)
          edits.push({ ...result, message: `[Fallback] ${result.message}` })
        } else if (goal.mode === 'balanced') {
          const analysis = analyzeMatch(match, availableMarkets)
          const best = [...analysis.recommendations].sort((a, b) => (b.ev * b.probability) - (a.ev * a.probability))[0]
          edits.push(formatSwap(leg, best, match, '[Fallback] Balanced mode applied.'))
        } else if (goal.mode === 'best_ev') {
          const analysis = analyzeMatch(match, availableMarkets)
          const best = [...analysis.recommendations].sort((a, b) => b.ev - a.ev)[0]
          if (best && best.ev < 0) {
            edits.push({ leg, changed: true, dropped: true, message: '[Fallback] Dropped: Negative EV.' })
          } else {
            edits.push(formatSwap(leg, best, match, '[Fallback] Max EV applied.'))
          }
        } else if (goal.mode === 'dreamer') {
          // Dreamer: avoid dropping, but bump to slightly safer tier if it's crazy risky
          const analysis = analyzeMatch(match, availableMarkets)
          const safer = analysis.recommendations.find(r => r.probability >= 50) || analysis.recommendations[0]
          if (leg.probability < 50 && safer && safer.probability > leg.probability) {
             edits.push(formatSwap(leg, safer, match, '[Fallback] Dreamer: Reduced stupidity.'))
          } else {
             edits.push({ leg, changed: false, message: '[Fallback] Dreamer: Kept high odds.' })
          }
        } else {
          // Default to reprofile
          const result = reProfileLeg(match, leg, availableMarkets)
          edits.push({ ...result, message: `[Fallback] ${result.message}` })
        }
      })
    }
  }

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