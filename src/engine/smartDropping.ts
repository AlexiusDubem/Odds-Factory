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
  rationale: string       // Match-specific AI explanation
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

export function normalizeProbability(prob: number | undefined | null, fallback = 0.5): number {
  if (prob === undefined || prob === null || isNaN(prob)) return fallback
  const normalized = prob > 1 ? prob / 100 : prob
  return Math.min(0.99, Math.max(0.01, normalized))
}

// ─── Health calculator ──────────────────────────────────────────────────────

export function calculateSlipHealth(legs: SlipLeg[], combinedOdds: number): SlipHealth {
  if (legs.length === 0) return { riskScore: 0, stabilityScore: 0, confidenceScore: 0, valueScore: 0, overallScore: 0 }

  const combinedProb = legs.reduce((acc, leg) => acc * normalizeProbability(leg.probability, 0.65), 1)

  let risk = (1 - combinedProb) * 100
  if (combinedOdds > 50) risk = Math.min(99, risk + 5)

  const avgTier    = legs.reduce((acc, leg) => acc + (leg.tier || 2), 0) / legs.length
  const confidence = (avgTier / 3) * 100

  const avgEv = legs.reduce((acc, leg) => {
    const prob = leg.probability || 0.5
    const singleLegOdds = Math.min(leg.odds || 2.0, 15.0)
    return acc + ((prob * singleLegOdds) - 1)
  }, 0) / legs.length

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

// ─── Match-aware Rationale Generator ──────────────────────────────────────────
// FALLBACK ONLY — used when Gemini is unavailable. Never fabricates stats.
// Rationale is derived purely from odds, EV, market type, and volatility.

function generateMatchSpecificRationale(
  matchLabel: string,
  market: string,
  odds: number,
  ev: number
): string {
  const [home, away] = (matchLabel || '').split(' vs ').map(s => s.trim())
  const h = home || 'Home'
  const a = away || 'Away'
  const m = market.toLowerCase()
  const formattedOdds = (odds || 1.85).toFixed(2)
  const formattedEV = ev >= 0 ? `+${ev.toFixed(2)}` : ev.toFixed(2)

  // Odds-based reasoning (verifiable from the slip itself)
  if (ev < -0.15) {
    return `${h} vs ${a}: ${market} @${formattedOdds} has negative expected value (EV ${formattedEV}) — implied probability exceeds likely true probability.`
  }
  if (odds > 4.0) {
    return `${h} vs ${a}: ${market} @${formattedOdds} is a high-odds selection — risky in accumulators as one upset kills the slip.`
  }

  // Market-type reasoning (general football logic, no fabricated stats)
  if (m.includes('over 2.5') || m.includes('over 3.5') || m.includes('early goal')) {
    return `${h} vs ${a}: Goal-heavy markets like ${market} @${formattedOdds} add volatility to accumulators (EV ${formattedEV}).`
  }
  if (m.includes('btts') || m.includes('both teams')) {
    return `${h} vs ${a}: BTTS depends on both attacks firing — one defensive setup breaks this leg @${formattedOdds} (EV ${formattedEV}).`
  }
  if (m.includes('under')) {
    return `${h} vs ${a}: Under markets can be undone by a single goal — volatile for accumulators @${formattedOdds} (EV ${formattedEV}).`
  }
  if (m.includes('draw') || m.includes(' x ')) {
    return `${h} vs ${a}: Draw selections are inherently low-probability — risky for accumulator survival @${formattedOdds} (EV ${formattedEV}).`
  }

  // Generic honest fallback
  if (ev >= 0.05) {
    return `${h} vs ${a}: ${market} @${formattedOdds} offers positive EV (${formattedEV}) — worth keeping based on odds value.`
  }
  return `${h} vs ${a}: ${market} @${formattedOdds} has marginal value (EV ${formattedEV}) — borderline for accumulator inclusion.`
}

// ─── Gemini Direct API Evaluator ─────────────────────────────────────────────

interface GeminiLegEval {
  legId: string
  trueProbability: number   // 0–1
  ev: number                // expected value
  volatility: number        // 0–1
  shouldDrop: boolean
  rationale: string         // Brief, real-world match explanation
}

async function evaluateLegsWithGemini(legs: SlipLeg[], goal: OptimizationGoal): Promise<GeminiLegEval[]> {
  const payload = {
    legs: legs.map(l => ({
      id: l.id,
      matchLabel: l.matchLabel,
      market: l.market,
      odds: Math.min(l.odds, 20),
      probability: l.probability,
      tier: l.tier,
      homeTeam: (l.matchLabel || '').split(' vs ')[0]?.trim() ?? '',
      awayTeam: (l.matchLabel || '').split(' vs ')[1]?.trim() ?? '',
      sport: 'football',
    })),
    goal,
  };

  // Strategy 1: Serverless & local endpoints
  const endpoints = ['/api/eval-legs', '/api/local/eval-legs', 'http://localhost:3001/eval-legs'];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.evals) && data.evals.length > 0) {
          console.log('[SmartDrop] Evaluated via ' + ep);
          return data.evals;
        }
      }
    } catch {
      // Try next endpoint
    }
  }

  // Strategy 2: Dynamic match-specific rationale generator (always clean & team-specific)
  return legs.map(l => {
    const trueProb = l.probability ? (l.probability > 1 ? l.probability / 100 : l.probability) : 0.5
    const singleLegOdds = Math.min(l.odds || 2.0, 15.0)
    const rawEv = (trueProb * singleLegOdds) - 1
    const ev = Math.max(-0.85, Math.min(0.50, rawEv))
    const volatility = l.tier === 1 ? 0.25 : l.tier === 2 ? 0.50 : 0.75
    const shouldDrop = ev < -0.05 || volatility > 0.65

    const rationale = generateMatchSpecificRationale(l.matchLabel, l.market, singleLegOdds, ev)

    return { legId: l.id, trueProbability: trueProb, ev, volatility, shouldDrop, rationale }
  })
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export async function analyzeSmartDrops(slip: Slip, goal: OptimizationGoal): Promise<SmartDropResult> {
  const originalHealth = calculateSlipHealth(slip.legs, slip.combinedOdds)
  const OSP = slip.survivalProbability
  const OSO = slip.combinedOdds

  // ── Get Gemini / Match-aware evaluations for every leg ───────────────────────
  const geminiEvals = await evaluateLegsWithGemini(slip.legs, goal)

  // ── Build dropping metrics ─────────────────────────────────────────────────
  const droppingMetrics: DroppingMetrics[] = slip.legs.map(leg => {
    const gEval = geminiEvals.find(e => e.legId === leg.id) ?? {
      legId: leg.id,
      trueProbability: leg.probability || 0.5,
      ev: -0.15,
      volatility: 0.5,
      shouldDrop: true,
      rationale: generateMatchSpecificRationale(leg.matchLabel, leg.market, leg.odds, -0.15)
    }

    // Ensure EV is properly bounded for individual leg display
    const rawSingleOdds = Math.min(leg.odds || 2.0, 15.0)
    const rawProb = normalizeProbability(leg.probability, 0.65)
    const boundedEV = Math.max(-0.85, Math.min(0.50, gEval.ev !== undefined ? gEval.ev : (rawProb * rawSingleOdds - 1)))
    const ospNorm = OSP > 1 ? OSP / 100 : OSP;
    const ssp = OSP > 0 && rawProb > 0 ? (ospNorm / rawProb) * 100 : 0
    const sso = OSO > 0 && leg.odds > 0 ? OSO / leg.odds : 0
    const sspIncrease  = ssp - OSP
    const oddsReduction = OSO - sso

    const impactScore = (sspIncrease * 50) - (boundedEV * 10) + (gEval.volatility * 5)

    return {
      legId:          leg.id,
      trueProbability: gEval.trueProbability,
      ev:             boundedEV,
      confidenceScore: ((leg.tier || 2) / 3) * 100,
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
    dropCount = droppingMetrics.filter(m => m.ev < -0.3 || m.volatility > 0.85).length
  } else {
    // balanced mode
    const geminiDrops = geminiEvals.filter(e => e.shouldDrop).map(e => e.legId)
    const toxicByMath = droppingMetrics.filter(m =>
      m.ev < -0.05 || m.volatility > 0.65 || m.impactScore > 8
    ).map(m => m.legId)
    const toDrop = new Set([...geminiDrops, ...toxicByMath])
    const maxDrops = Math.max(1, Math.ceil(slip.legs.length * 0.4))
    dropCount = Math.min(toDrop.size, maxDrops)
    if (dropCount === 0 && droppingMetrics.length > 2) dropCount = 1
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
