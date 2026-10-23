/**
 * Vercel Serverless Function: POST /api/match-intelligence
 * Live sports intelligence powered by Google Gemini.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { homeTeam, awayTeam, league, market, odds } = req.body || {}
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

  if (!apiKey) {
    return res.status(200).json({
      success: false,
      error: 'GEMINI_API_KEY not set in Vercel environment variables. Please add GEMINI_API_KEY in your Vercel Project Settings.',
    })
  }

  const models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']

  const prompt = `You are Odds Factory's Elite Football Intelligence Engine. Analyze this upcoming fixture:
Match: ${homeTeam} vs ${awayTeam}
Competition: ${league}
Current Market Selection: ${market} @${odds}

Provide REAL, genuine match intelligence using your deep sports knowledge of these clubs, recent form, head-to-head records, expected goals, corners, and tactical matchups. Do NOT invent fake data or cite old 2024 matches as current form.

Return ONLY a raw JSON object with this exact structure:
{
  "homeForm": ["W", "D", "W", "W", "L"],
  "awayForm": ["L", "D", "L", "W", "D"],
  "homeFormSummary": "string describing home team's actual recent form and home goal output",
  "awayFormSummary": "string describing away team's actual recent form and away concessions",
  "h2hSummary": "string detailing genuine head-to-head history and recent encounters",
  "expectedGoals": 2.7,
  "cornersPerGame": 9.4,
  "bttsRate": "62%",
  "cleanSheetRate": "34%",
  "cardsPerGame": "3.4",
  "tacticalDynamic": "string analyzing pace, tactical shape, wing play, or counter-attacking tendencies",
  "aiEvidenceRationale": "concise 1-2 sentence evidence-backed rationale naming the exact teams, citing real statistical proof for why ${market} is strongly supported"
}`

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
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

      if (resp.status === 404 || resp.status === 503) continue
      if (!resp.ok) continue

      const data = await resp.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) {
        return res.status(200).json({ success: true, intelligence: JSON.parse(text) })
      }
    } catch (e) {
      // Continue to next model
    }
  }

  return res.status(200).json({
    success: false,
    error: 'Gemini API call could not be completed. Check API quota.',
  })
}
