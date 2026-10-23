/**
 * Odds Factory — Gemini AI Intelligence Service
 * 
 * Secure Serverless Architecture:
 * All Gemini API calls are processed securely on the backend (/api/match-intelligence
 * and /api/batch-rationales). The private API key (GEMINI_API_KEY) is NEVER exposed
 * to the browser or bundled with client-side code.
 */

import type { DailySurePick } from '../data/sportybetCompetitions'

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

/**
 * Fetch deep match intelligence and real stats for a fixture via serverless backend
 */
export async function fetchLiveMatchIntelligence(
  pick: DailySurePick
): Promise<LiveMatchIntelligence | null> {
  const endpoints = ['/api/match-intelligence', '/api/local/match-intelligence']

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
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
      // Continue to next endpoint fallback
    }
  }

  return null
}

/**
 * Generate evidence-driven AI rationales for a batch of ticket legs via serverless backend
 */
export async function batchGenerateEvidenceRationales(
  picks: DailySurePick[]
): Promise<Record<string, string>> {
  if (picks.length === 0) return {}

  const endpoints = ['/api/batch-rationales', '/api/local/batch-rationales']

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
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
      // Continue to next endpoint fallback
    }
  }

  return {}
}
