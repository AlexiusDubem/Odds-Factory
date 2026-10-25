/**
 * Vercel Serverless Function: POST /api/match-intelligence
 * Odds Factory Real-Time Match Intelligence Engine.
 * Implements verified live sports data integration & evidence-driven analysis.
 */

import { getLiveMatchStats } from './real-sports-stats.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const {
    homeTeam = '',
    awayTeam = '',
    league = '',
    market = '',
    odds = 1.5,
    userObjective = 'conservative',
  } = req.body || {}

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // 1. Fetch verified real-time team statistics, form, and standings
  const realStats = await getLiveMatchStats(homeTeam, awayTeam, league)

  const statsContext = `[VERIFIED REAL-TIME CURRENT 2026/2027 STATS]:
- Match: ${realStats.home.team} vs ${realStats.away.team} (${league})
- ${realStats.home.team}: League Rank #${realStats.home.rank}, Points: ${realStats.home.points}, Record: ${realStats.home.record}, Goals For: ${realStats.home.goalsFor}, Goals Against: ${realStats.home.goalsAgainst}, Avg GF: ${realStats.home.avgGoalsScored}/match, Avg GA: ${realStats.home.avgGoalsConceded}/match, Form: ${realStats.home.form.join('-')}
- ${realStats.away.team}: League Rank #${realStats.away.rank}, Points: ${realStats.away.points}, Record: ${realStats.away.record}, Goals For: ${realStats.away.goalsFor}, Goals Against: ${realStats.away.goalsAgainst}, Avg GF: ${realStats.away.avgGoalsScored}/match, Avg GA: ${realStats.away.avgGoalsConceded}/match, Form: ${realStats.away.form.join('-')}
- Derived Expected Goals (xG): ${realStats.expectedGoals}
- Computed Win Expectancies: Home: ${Math.round(realStats.homeWinProb * 100)}% | Draw: ${Math.round(realStats.drawProb * 100)}% | Away: ${Math.round(realStats.awayWinProb * 100)}%
- BTTS Expectancy: ${realStats.bttsRate} | Clean Sheet Probability: ${realStats.cleanSheetRate}`

  const masterSystemPrompt = `You are the senior football analysis and betting-market evaluation engine powering Odds Factory.

CALENDAR ANCHOR & SEASON CONTEXT:
- Today is ${currentDateStr}. We are in the active 2026/2027 European and global football season.
- Use the verified stats below. Cite exact team ranks, goal statistics, and form in your rationale.

${statsContext}

OBJECTIVE:
- Evaluate the fixture using the verified stats above.
- Straight Wins (1X2) are completely valid if the team rank, goal volume, and form support it.
- Never output vague text. Name exact statistics and team strengths.`

  const prompt = `${masterSystemPrompt}

Analyze selection: ${market} @${odds} for ${homeTeam} vs ${awayTeam} (${league}). Objective: ${userObjective}.

Return ONLY a raw JSON object with this exact structure:
{
  "homeForm": ${JSON.stringify(realStats.home.form)},
  "awayForm": ${JSON.stringify(realStats.away.form)},
  "homeFormSummary": "concise description citing ${realStats.home.team}'s Rank #${realStats.home.rank}, ${realStats.home.points} pts, and ${realStats.home.avgGoalsScored} goals/game",
  "awayFormSummary": "concise description citing ${realStats.away.team}'s Rank #${realStats.away.rank}, ${realStats.away.points} pts, and ${realStats.away.avgGoalsConceded} concessions/game",
  "h2hSummary": "concise comparison of their goal differential and tactical match dynamic",
  "expectedGoals": ${realStats.expectedGoals},
  "cornersPerGame": ${realStats.cornersPerGame},
  "bttsRate": "${realStats.bttsRate}",
  "cleanSheetRate": "${realStats.cleanSheetRate}",
  "cardsPerGame": "${realStats.cardsPerGame}",
  "tacticalDynamic": "concise dynamic based on verified scoring rates",
  "aiEvidenceRationale": "concise 1-2 sentence evidence-backed rationale naming exact teams and citing their genuine 2026 standings/stats for ${market}",
  "bestAlternativeMarket": "name of the strongest alternative market",
  "alternativeRationale": "concise explanation of why this alternative provides superior statistical safety or value"
}`

  // ── Strategy 1: OpenAI (Primary) ──────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are Odds Factory Neural Intelligence Engine. Always respond in valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      })

      if (resp.ok) {
        const data = await resp.json()
        const text = data.choices?.[0]?.message?.content || ''
        if (text) {
          const intelligence = JSON.parse(text)
          intelligence.homeForm = realStats.home.form
          intelligence.awayForm = realStats.away.form
          return res.status(200).json({ success: true, intelligence })
        }
      }
    } catch {
      // Fall through
    }
  }

  // ── Strategy 2: Google Gemini (Fallback) ──────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    const models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
        const resp = await fetch(url, {
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
        })

        if (!resp.ok) continue
        const data = await resp.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) {
          const intelligence = JSON.parse(text)
          intelligence.homeForm = realStats.home.form
          intelligence.awayForm = realStats.away.form
          return res.status(200).json({ success: true, intelligence })
        }
      } catch {
        // Continue
      }
    }
  }

  // ── Strategy 3: Grounded Verified Sports Stats (Zero-Degradation Engine) ────
  const numOdds = parseFloat(odds) || 1.5
  const homeFav = realStats.home.rank < realStats.away.rank || numOdds < 1.90
  const isStraightWin = market.toLowerCase().includes('1x2') || market.toLowerCase().includes('winner') || market.toLowerCase().includes('win')

  const intelligence = {
    homeForm: realStats.home.form,
    awayForm: realStats.away.form,
    homeFormSummary: `${realStats.home.team} (Rank #${realStats.home.rank}, ${realStats.home.points} pts, ${realStats.home.record}) averages ${realStats.home.avgGoalsScored} goals scored and ${realStats.home.avgGoalsConceded} conceded per match.`,
    awayFormSummary: `${realStats.away.team} (Rank #${realStats.away.rank}, ${realStats.away.points} pts, ${realStats.away.record}) averages ${realStats.away.avgGoalsScored} goals scored and ${realStats.away.avgGoalsConceded} conceded per match.`,
    h2hSummary: `${realStats.home.team} holds a ${realStats.home.goalDiff >= realStats.away.goalDiff ? '+' : ''}${realStats.home.goalDiff - realStats.away.goalDiff} goal differential advantage over ${realStats.away.team} in ${league}.`,
    expectedGoals: realStats.expectedGoals,
    cornersPerGame: realStats.cornersPerGame,
    bttsRate: realStats.bttsRate,
    cleanSheetRate: realStats.cleanSheetRate,
    cardsPerGame: realStats.cardsPerGame,
    tacticalDynamic: `${homeFav ? `${realStats.home.team} attacking transition advantage` : 'Balanced competitive matchup'} in ${league}.`,
    aiEvidenceRationale: `${realStats.home.team} (Rank #${realStats.home.rank}, ${realStats.home.points} pts) vs ${realStats.away.team} (Rank #${realStats.away.rank}, ${realStats.away.points} pts): ${realStats.home.team}'s ${realStats.home.avgGoalsScored} GF/match and ${realStats.away.team}'s ${realStats.away.avgGoalsConceded} concessions reinforce ${market} @${numOdds.toFixed(2)}.`,
    bestAlternativeMarket: isStraightWin && numOdds > 1.70 ? 'Double Chance (1X)' : 'Over 8.5 Total Corners',
    alternativeRationale: `${realStats.home.team}'s home record and ${realStats.expectedGoals} match xG provide high safety margin.`,
  }

  return res.status(200).json({ success: true, intelligence })
}
