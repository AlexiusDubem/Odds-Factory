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

    if (!aiEdit.changed || !aiEdit.marketId || !aiEdit.outcomeId) {
      edits.push({ leg: originalLeg, changed: false, message: aiEdit.message || 'Kept original.' })
      return
    }

    const matchMarkets = marketsPayload[originalLeg.matchId] || []
    const newMarketData = matchMarkets.find((m: any) => m.id === String(aiEdit.marketId) && (m.specifier || '') === (aiEdit.specifier || ''))

    if (newMarketData) {
      const outcome = newMarketData.outcomes?.find((o: any) => o.id === String(aiEdit.outcomeId)) || newMarketData.outcomes?.[0] || { odds: 1.5, id: aiEdit.outcomeId, desc: 'Unknown' }
      const newOdds = Number(outcome.odds) || 1.5
      
      // We also need a descriptive name for the market
      const marketLabel = newMarketData.specifier ? `${newMarketData.desc} (${newMarketData.specifier}) — ${outcome.desc}` : `${newMarketData.desc} — ${outcome.desc}`

      const newLeg: SlipLeg = {
        ...originalLeg,
        market: marketLabel,
        odds: newOdds,
        probability: Math.min(100, (100 / newOdds) * 0.9),
        wasSwapped: true,
        previousMarket: originalLeg.market,
        rawSelection: {
          ...originalLeg.rawSelection,
          marketId: newMarketData.id,
          outcomeId: outcome.id,
          specifier: newMarketData.specifier || ''
        }
      }
      edits.push({ leg: newLeg, changed: true, previousMarket: originalLeg.market, message: aiEdit.message })
    } else {
      edits.push({ leg: originalLeg, changed: false, message: `[AI Hallucinated] Could not find exact market ID ${aiEdit.marketId} with specifier ${aiEdit.specifier}. Kept original.` })
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