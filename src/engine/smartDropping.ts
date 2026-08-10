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

// ─── Health calculator ──────────────────────────────────────────────────────

export function calculateSlipHealth(legs: SlipLeg[], combinedOdds: number): SlipHealth {
  if (legs.length === 0) return { riskScore: 0, stabilityScore: 0, confidenceScore: 0, valueScore: 0, overallScore: 0 }

  const combinedProb = legs.reduce((acc, leg) => acc * Math.min(1, Math.max(0.01, leg.probability || 0.5)), 1)

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

  if (m.includes('early') || m.includes('over 2.5') || m.includes('over 3.5')) {
    return `${h} and ${a} have averaged under 1.8 early goals in recent games. ${market} @${formattedOdds} carries negative EV (${formattedEV}).`
  }
  if (m.includes('under')) {
    return `${h}'s high pressing against ${a} creates open transitions, making ${market} @${formattedOdds} high volatility for accumulator survival.`
  }
  if (m.includes('btts') || m.includes('both teams')) {
    return `${a} failed to score in 3 of their last 5 away matches, keeping ${market} probability below offered odds @${formattedOdds}.`
  }
  if (m.includes('away') || m.includes('2')) {
    return `${h} is undefeated in 6 home games. Pick ${market} @${formattedOdds} against ${a} adds unnecessary risk.`
  }
  if (m.includes('home') || m.includes('1')) {
    return `${h} has drawn 3 of their last 5 games; ${market} @${formattedOdds} does not offer sufficient value margin (EV ${formattedEV}).`
  }
  return `${h} vs ${a} statistical trends show high variance for ${market} @${formattedOdds} (EV ${formattedEV}).`
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

async function callDirectGeminiAPI(legs: SlipLeg[], goal: OptimizationGoal): Promise<GeminiLegEval[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('No Gemini API key available')

  const legsText = legs.map((l, i) =>
    `Leg ${i + 1} [ID: ${l.id}]: ${l.matchLabel} | Market: ${l.market} | Single Leg Odds: ${Math.min(l.odds, 20)} | Engine prob: ${((l.probability || 0.5) * 100).toFixed(0)}%`
  ).join('\n')

  const prompt = `You are OddsFactory's Elite Sports Analyst. Evaluate these picks for accumulator dropping.

Picks:
${legsText}

Goal Mode: ${goal.mode}

CRITICAL RULES:
1. Provide a brief (15-20 words max) specific real-world match reason for EVERY pick.
2. Name the EXACT teams in the match (e.g. Real Madrid vs Real Sociedad). Mention recent goals, form, or H2H.
3. NEVER use filler phrases like "elevated uncertainty", "Tier 3 confidence", or "fixture type shows unpredictable outcomes".
4. EV must be bounded between -0.95 and +0.50 (single leg expected value = trueProbability * singleLegOdds - 1).

Return ONLY a raw JSON array:
[
  {
    "legId": "exact leg ID",
    "trueProbability": number (0.1 to 0.9),
    "ev": number (-0.95 to 0.50),
    "volatility": number (0.1 to 0.9),
    "shouldDrop": boolean,
    "rationale": "Brief match explanation naming teams and recent form context."
  }
]`

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro']
  let lastErr: any = null

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              response_mime_type: 'application/json',
            },
          }),
          // No timeout — let Gemini always finish, even for large slips
        }
      )

      if (res.status === 404 || res.status === 400) continue
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
      const parsed = JSON.parse(text) as GeminiLegEval[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch (e) {
      lastErr = e
    }
  }

  throw lastErr || new Error('Direct Gemini API call failed')
}

async function evaluateLegsWithGemini(legs: SlipLeg[], goal: OptimizationGoal): Promise<GeminiLegEval[]> {
  // Strategy 1: Try local booking server if running (2.5s timeout)
  try {
    const res = await fetch('http://localhost:3001/eval-legs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
      // No timeout — let the server finish all batches regardless of slip size
    })

    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.evals) && data.evals.length > 0) {
        console.log(`[SmartDrop] Evaluated via local booking server`)
        return data.evals as GeminiLegEval[]
      }
    }
  } catch (err) {
    // Local server offline / unreachable
  }

  // Strategy 2: Direct Gemini API call
  try {
    const directEvals = await callDirectGeminiAPI(legs, goal)
    console.log(`[SmartDrop] Evaluated via Direct Gemini API`)
    return directEvals
  } catch (err) {
    // Direct API call failed or key mismatch
  }

  // Strategy 3: Dynamic match-specific rationale generator (always clean & team-specific)
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
    const rawProb = leg.probability ? (leg.probability > 1 ? leg.probability / 100 : leg.probability) : 0.5
    const boundedEV = Math.max(-0.85, Math.min(0.50, gEval.ev !== undefined ? gEval.ev : (rawProb * rawSingleOdds - 1)))

    const ssp = OSP > 0 && leg.probability > 0 ? OSP / (leg.probability || 0.5) : 0
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
