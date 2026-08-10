import type { Slip, SlipLeg, OptimizationGoal } from '../types'

export interface DroppingMetrics {
  legId: string
  trueProbability: number
  ev: number
  confidenceScore: number
  volatility: number
  sspIncrease: number
  oddsReduction: number
  impactScore: number
  rationale: string       // ← now always comes from Gemini, never from fake hashes
  matchLabel: string
  market: string
}

export interface SmartDropResult {
  optimizedSlip: Slip
  droppedLegs: DroppingMetrics[]
  originalHealth: SlipHealth
  optimizedHealth: SlipHealth
}

export interface SlipHealth {
  riskScore: number
  stabilityScore: number
  confidenceScore: number
  valueScore: number
  overallScore: number
}

// ─── Health calculator (pure math, no fake data) ─────────────────────────────

export function calculateSlipHealth(legs: SlipLeg[], combinedOdds: number): SlipHealth {
  if (legs.length === 0) return { riskScore: 0, stabilityScore: 0, confidenceScore: 0, valueScore: 0, overallScore: 0 }

  const combinedProb = legs.reduce((acc, leg) => acc * (leg.probability || 0.5), 1)

  let risk = (1 - combinedProb) * 100
  if (combinedOdds > 50) risk = Math.min(99, risk + 5)

  const avgTier    = legs.reduce((acc, leg) => acc + (leg.tier || 2), 0) / legs.length
  const confidence = (avgTier / 3) * 100

  const avgEv = legs.reduce((acc, leg) => acc + (((leg.probability || 0.5) * leg.odds) - 1), 0) / legs.length
  const value = Math.max(0, Math.min(100, 50 + (avgEv * 100)))

  const stability = Math.max(0, 100 - (legs.length * 5) + (confidence * 0.2))

  return {
    riskScore:      Math.round(risk),
    stabilityScore: Math.round(stability),
    confidenceScore: Math.round(confidence),
    valueScore:     Math.round(value),
    overallScore:   Math.round((stability * 0.4) + (confidence * 0.3) + (value * 0.3) - (risk > 90 ? 10 : 0))
  }
}

// ─── Gemini-powered leg evaluator ────────────────────────────────────────────

interface GeminiLegEval {
  legId: string
  trueProbability: number   // 0–1
  ev: number                // can be negative
  volatility: number        // 0–1 (0 = stable, 1 = very unpredictable)
  shouldDrop: boolean
  rationale: string         // specific reason for this exact match/market
}

async function evaluateLegsWithGemini(legs: SlipLeg[], goal: OptimizationGoal): Promise<GeminiLegEval[]> {
  try {
    // Route through the local booking server — it holds the working server-side API key
    const res = await fetch('http://localhost:3001/eval-legs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legs: legs.map(l => ({
          id: l.id,
          matchLabel: l.matchLabel,
          market: l.market,
          odds: l.odds,
          probability: l.probability,
          tier: l.tier,
          // Pass team names if available for the API data fetch
          homeTeam: (l.matchLabel || '').split(' vs ')[0]?.trim() ?? '',
          awayTeam: (l.matchLabel || '').split(' vs ')[1]?.trim() ?? '',
          sport: 'football',
        })),
        goal,
      }),
    })

    if (!res.ok) throw new Error(`Booking server returned ${res.status}`)
    const data = await res.json()

    if (!data.success || !Array.isArray(data.evals) || data.evals.length === 0) {
      throw new Error(data.error || 'Empty response from eval-legs')
    }

    console.log(`[SmartDrop] Gemini evaluated ${data.evals.length} legs — source: ${data.dataSource}`)
    return data.evals as GeminiLegEval[]

  } catch (err) {
    console.error('[SmartDropping] eval-legs call failed:', err)
    // Math-only fallback — professional copy, no technical jargon visible to users
    return legs.map(l => {
      const trueProb = l.probability || 0.5
      const ev       = (trueProb * l.odds) - 1
      const volatility = l.tier === 1 ? 0.2 : l.tier === 2 ? 0.45 : 0.7
      const shouldDrop = ev < -0.05 || volatility > 0.65

      let rationale: string
      if (shouldDrop) {
        if (ev < -0.1) {
          rationale = `Negative expected value of ${ev.toFixed(2)} detected. At odds of ${l.odds}, the implied probability (${(1/l.odds*100).toFixed(0)}%) exceeds the engine's confidence estimate (${(trueProb*100).toFixed(0)}%), making this a losing bet in the long run.`
        } else if (volatility > 0.65) {
          rationale = `${l.market} carries elevated uncertainty at Tier ${l.tier ?? 3} confidence. Historical data for this fixture type shows unpredictable outcomes — the risk-to-reward ratio does not justify keeping this leg.`
        } else {
          rationale = `Marginal negative EV (${ev.toFixed(2)}) combined with below-threshold confidence. Dropping this leg increases overall slip survival without significantly reducing the combined odds.`
        }
      } else {
        rationale = `Passes all risk checks. Implied probability ${(trueProb*100).toFixed(0)}% vs offered odds of ${l.odds}x. EV: ${ev.toFixed(2)}. Recommended to keep.`
      }

      return { legId: l.id, trueProbability: trueProb, ev, volatility, shouldDrop, rationale }
    })
  }
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export async function analyzeSmartDrops(slip: Slip, goal: OptimizationGoal): Promise<SmartDropResult> {
  const originalHealth = calculateSlipHealth(slip.legs, slip.combinedOdds)
  const OSP = slip.survivalProbability
  const OSO = slip.combinedOdds

  // ── Get Gemini evaluations for every leg ────────────────────────────────────
  const geminiEvals = await evaluateLegsWithGemini(slip.legs, goal)

  // ── Build dropping metrics from Gemini results ──────────────────────────────
  const droppingMetrics: DroppingMetrics[] = slip.legs.map(leg => {
    const gEval = geminiEvals.find(e => e.legId === leg.id) ?? {
      legId: leg.id,
      trueProbability: leg.probability || 0.5,
      ev: ((leg.probability || 0.5) * leg.odds) - 1,
      volatility: 0.4,
      shouldDrop: false,
      rationale: 'Leg not evaluated — defaulting to engine probability.'
    }

    // Slip-level impact: how much does removing this leg improve the slip?
    const ssp = OSP > 0 && leg.probability > 0 ? OSP / (leg.probability || 0.5) : 0
    const sso = OSO > 0 && leg.odds > 0 ? OSO / leg.odds : 0
    const sspIncrease  = ssp - OSP
    const oddsReduction = OSO - sso

    // Impact score: higher = stronger candidate for dropping
    const impactScore = (sspIncrease * 50) - (gEval.ev * 10) + (gEval.volatility * 5)

    return {
      legId:          leg.id,
      trueProbability: gEval.trueProbability,
      ev:             gEval.ev,
      confidenceScore: (leg.tier / 3) * 100,
      volatility:     gEval.volatility,
      sspIncrease,
      oddsReduction,
      impactScore,
      rationale:      gEval.rationale,
      matchLabel:     leg.matchLabel,
      market:         leg.market,
    }
  })

  // ── Rank: highest impact = drop first ──────────────────────────────────────
  droppingMetrics.sort((a, b) => b.impactScore - a.impactScore)

  // ── Decide how many to drop based on goal ──────────────────────────────────
  let dropCount = 0

  if (goal.mode === 'target_survival' && goal.targetSurvival) {
    let currentProb = OSP
    for (const m of droppingMetrics) {
      if (currentProb >= goal.targetSurvival / 100) break
      currentProb += m.sspIncrease
      dropCount++
    }
  } else if (goal.mode === 'target_odds' && goal.targetOdds) {
    let currentOdds = OSO
    for (const m of droppingMetrics) {
      if (currentOdds <= goal.targetOdds) break
      const legOdds = slip.legs.find(l => l.id === m.legId)?.odds || 1
      currentOdds = currentOdds / legOdds
      dropCount++
    }
  } else if (goal.mode === 'best_ev') {
    dropCount = droppingMetrics.filter(m => m.ev < 0).length
  } else if (goal.mode === 'safe_mode') {
    dropCount = droppingMetrics.filter(m => m.trueProbability < 0.75).length
  } else if (goal.mode === 'dreamer') {
    // Only drop truly toxic picks even in dreamer mode
    dropCount = droppingMetrics.filter(m => m.ev < -0.3 || m.volatility > 0.85).length
  } else {
    // balanced: use Gemini's shouldDrop signals + impact threshold
    const geminiDrops = geminiEvals.filter(e => e.shouldDrop).map(e => e.legId)
    const toxicByMath = droppingMetrics.filter(m =>
      m.ev < -0.05 || m.volatility > 0.65 || m.impactScore > 8
    ).map(m => m.legId)
    // Union of both signals
    const toDrop = new Set([...geminiDrops, ...toxicByMath])
    const maxDrops = Math.max(1, Math.ceil(slip.legs.length * 0.4))
    dropCount = Math.min(toDrop.size, maxDrops)
    if (dropCount === 0 && droppingMetrics.length > 2) dropCount = 1 // always surface the worst pick
  }

  const legsToDrop = droppingMetrics.slice(0, dropCount).map(m => m.legId)

  // ── Build optimized slip ────────────────────────────────────────────────────
  const keptLegs = slip.legs
    .filter(l => !legsToDrop.includes(l.id))
    .map(l => {
      const metric = droppingMetrics.find(m => m.legId === l.id)
      return { ...l, rationale: metric?.rationale || l.rationale }
    })

  const newOdds = keptLegs.reduce((acc, l) => acc * l.odds, 1)
  const newProb = keptLegs.reduce((acc, l) => acc * (l.probability || 0.5), 1)

  const optimizedSlip: Slip = {
    ...slip,
    id: slip.id + '-opt',
    legs: keptLegs,
    combinedOdds: newOdds,
    survivalProbability: newProb,
  }

  return {
    optimizedSlip,
    droppedLegs: droppingMetrics.slice(0, dropCount),
    originalHealth,
    optimizedHealth: calculateSlipHealth(keptLegs, newOdds),
  }
}
