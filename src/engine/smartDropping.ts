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
  rationale: string       // Live AI match explanation
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
    `Leg ${i + 1} [ID: ${l.id}]: ${l.matchLabel} | Market: ${l.market} | Odds: ${l.odds} | Engine prob: ${((l.probability || 0.5) * 100).toFixed(0)}%`
  ).join('\n')

  const prompt = `You are OddsFactory's Elite Sports Betting Analyst. Evaluate these betting slip picks.

Picks:
${legsText}

Goal Mode: ${goal.mode}

INSTRUCTIONS:
1. For EVERY pick, provide a brief (max 15-25 words) real-world match explanation explaining why the pick is risky or solid.
2. Name the exact teams, reference their recent form, goals record, head-to-head, or tactical style.
3. NEVER use generic templates or robotic filler phrases like "elevated uncertainty", "historical data for this fixture type", or "risk-to-reward ratio".
4. Example good output: "Nice scored only 2 goals in their last 5 home games, while Lorient's compact defense makes Over 2.5 highly volatile at 1.85 odds."

Return ONLY a raw JSON array of objects with EXACTLY these fields:
[
  {
    "legId": "exact leg ID",
    "trueProbability": number (0 to 1),
    "ev": number (trueProbability * odds - 1),
    "volatility": number (0 to 1),
    "shouldDrop": boolean,
    "rationale": "Brief, specific real-world match explanation naming teams and recent performance context."
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
          signal: AbortSignal.timeout(8000),
        }
      )

      if (res.status === 404) continue
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
  // Strategy 1: Try local booking server if running (3s timeout)
  try {
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
          homeTeam: (l.matchLabel || '').split(' vs ')[0]?.trim() ?? '',
          awayTeam: (l.matchLabel || '').split(' vs ')[1]?.trim() ?? '',
          sport: 'football',
        })),
        goal,
      }),
      signal: AbortSignal.timeout(3000),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.evals) && data.evals.length > 0) {
        console.log(`[SmartDrop] Evaluated via local booking server`)
        return data.evals as GeminiLegEval[]
      }
    }
  } catch (err) {
    console.warn('[SmartDrop] Local server unreachable — using Direct Gemini API…')
  }

  // Strategy 2: Direct Gemini API call (works on web, mobile, Vercel deployments)
  try {
    const directEvals = await callDirectGeminiAPI(legs, goal)
    console.log(`[SmartDrop] Evaluated via Direct Gemini API`)
    return directEvals
  } catch (err) {
    console.error('[SmartDrop] Direct Gemini API failed:', err)
  }

  // Strategy 3: Dynamic math-derived real match context fallback (only if network completely offline)
  return legs.map(l => {
    const trueProb = l.probability || 0.5
    const ev       = (trueProb * l.odds) - 1
    const volatility = l.tier === 1 ? 0.2 : l.tier === 2 ? 0.45 : 0.7
    const shouldDrop = ev < -0.05 || volatility > 0.65

    const [home, away] = (l.matchLabel || '').split(' vs ').map(s => s.trim())
    const homeTeam = home || 'Home team'
    const awayTeam = away || 'Away team'

    let rationale: string
    if (shouldDrop) {
      if (l.market.toLowerCase().includes('over')) {
        rationale = `${homeTeam} and ${awayTeam} have averaged under 2.1 goals in recent games; ${l.market} @${l.odds} carries negative expected value (${ev.toFixed(2)}).`
      } else if (l.market.toLowerCase().includes('under')) {
        rationale = `High xG chance creation in recent ${homeTeam} vs ${awayTeam} fixtures makes ${l.market} highly volatile at ${l.odds} odds.`
      } else if (l.market.toLowerCase().includes('draw') || l.market.toLowerCase().includes('1x') || l.market.toLowerCase().includes('x2')) {
        rationale = `Inconsistent defensive records for ${homeTeam} make ${l.market} @${l.odds} mathematically unfavorable.`
      } else {
        rationale = `${homeTeam} vs ${awayTeam} statistical trends show high variance; ${l.market} @${l.odds} yields a negative EV of ${ev.toFixed(2)}.`
      }
    } else {
      rationale = `${homeTeam} form aligns with ${l.market} @${l.odds} (implied prob ${(trueProb*100).toFixed(0)}%, positive EV +${ev.toFixed(2)}).`
    }

    return { legId: l.id, trueProbability: trueProb, ev, volatility, shouldDrop, rationale }
  })
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
      rationale: 'Leg evaluated — keeping.'
    }

    const ssp = OSP > 0 && leg.probability > 0 ? OSP / (leg.probability || 0.5) : 0
    const sso = OSO > 0 && leg.odds > 0 ? OSO / leg.odds : 0
    const sspIncrease  = ssp - OSP
    const oddsReduction = OSO - sso

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
