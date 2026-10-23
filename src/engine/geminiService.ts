/**
 * Odds Factory — Gemini AI Intelligence Service
 * 
 * Provides real-time, evidence-based sports intelligence via Google Gemini:
 * 1. Deep Match Intelligence & Real Stats Analysis
 * 2. Real Evidence-Backed Rationales for every selected game
 */

import type { DailySurePick } from '../data/sportybetCompetitions'

const GEMINI_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.GEMINI_API_KEY) ||
  ''

const MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
]

export interface LiveMatchIntelligence {
  homeForm: string[]
  awayForm: string[]
  homeFormSummary: string
  awayFormSummary: string
  h2hSummary: string
  expectedGoals: number
  cornersPerGame: number
  bttsRate: string
  cleanSheetRate: string
  cardsPerGame: string
  tacticalDynamic: string
  aiEvidenceRationale: string
}

async function callGeminiDirect(prompt: string, jsonMode = true): Promise<string> {
  let lastError: Error | null = null

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            ...(jsonMode ? { response_mime_type: 'application/json' } : {}),
          },
        }),
      })

      if (resp.status === 404 || resp.status === 503) continue
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Gemini ${resp.status}: ${text.slice(0, 150)}`)
      }

      const data = await resp.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) return text
    } catch (err: any) {
      lastError = err
    }
  }

  throw lastError || new Error('All Gemini model endpoints failed')
}

/**
 * Fetch deep match intelligence and real stats for a fixture
 */
export async function fetchLiveMatchIntelligence(
  pick: DailySurePick
): Promise<LiveMatchIntelligence | null> {
  // 1. Try local server endpoint first
  try {
    const res = await fetch('/api/local/match-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeTeam: pick.homeTeam,
        awayTeam: pick.awayTeam,
        league: pick.league,
        market: pick.market,
        odds: pick.odds,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.intelligence) {
        return data.intelligence
      }
    }
  } catch {
    // Proceed to direct Gemini call
  }

  // 2. Direct Gemini Call
  try {
    const prompt = `You are Odds Factory's Elite Football Intelligence Engine. Analyze the upcoming match:
Match: ${pick.homeTeam} vs ${pick.awayTeam}
Competition: ${pick.league}
Current Pick: ${pick.market} @${pick.odds.toFixed(2)}

Provide REAL, genuine match intelligence using your deep sports knowledge of these clubs, recent results, head-to-head records, expected goals, corners, and tactical matchups. Do NOT invent fake data.

Return ONLY a raw JSON object with this exact structure:
{
  "homeForm": ["W", "D", "W", "W", "L"],
  "awayForm": ["L", "D", "L", "W", "D"],
  "homeFormSummary": "string describing home team's actual form and home goal output",
  "awayFormSummary": "string describing away team's actual form and away concessions",
  "h2hSummary": "string detailing genuine head-to-head history and recent encounters",
  "expectedGoals": 2.7,
  "cornersPerGame": 9.4,
  "bttsRate": "62%",
  "cleanSheetRate": "34%",
  "cardsPerGame": "3.4",
  "tacticalDynamic": "string analyzing pace, tactical shape, wing play, or counter-attacking tendencies",
  "aiEvidenceRationale": "concise 1-2 sentence evidence-backed rationale naming the exact teams, citing real statistical proof for why ${pick.market} is strongly supported"
}`

    const jsonStr = await callGeminiDirect(prompt, true)
    return JSON.parse(jsonStr)
  } catch (err) {
    console.warn('Direct Gemini call failed:', err)
    return null
  }
}

/**
 * Generate evidence-driven AI rationales for a batch of ticket legs
 */
export async function batchGenerateEvidenceRationales(
  picks: DailySurePick[]
): Promise<Record<string, string>> {
  if (picks.length === 0) return {}

  // 1. Try local server endpoint
  try {
    const res = await fetch('/api/local/batch-rationales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        picks: picks.map((p) => ({
          id: p.id,
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
          league: p.league,
          market: p.market,
          odds: p.odds,
        })),
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.rationales && Object.keys(data.rationales).length > 0) {
        return data.rationales
      }
    }
  } catch {
    // Proceed to direct call
  }

  // 2. Direct Gemini Call
  try {
    const prompt = `You are Odds Factory's Elite Betting Analyst.
For each selected match below, produce a CONCISE, 1-SENTENCE evidence-backed rationale naming the exact teams and citing real statistics, recent form, xG, or head-to-head proof. Never output generic template text.

Matches:
${picks.map((p, i) => `${i + 1}. [ID:${p.id}] ${p.homeTeam} vs ${p.awayTeam} (${p.league}) | Selection: ${p.market} @${p.odds.toFixed(2)}`).join('\n')}

Return ONLY a raw JSON object mapping each leg ID to its 1-sentence evidence string:
{
  "${picks[0]?.id}": "real proof string naming teams and citing stats..."
}`

    const jsonStr = await callGeminiDirect(prompt, true)
    return JSON.parse(jsonStr)
  } catch (err) {
    console.warn('Batch rationales direct call failed:', err)
    return {}
  }
}
