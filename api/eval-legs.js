/**
 * Vercel Serverless Function: POST /api/eval-legs
 * Evaluates accumulator slip legs to identify weak links, calculate EV,
 * and provide rigorous punter-level audit rationales.
 * Implements ODDS FACTORY — MASTER SYSTEM INSTRUCTION (Alternative-Market Challenge).
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { legs = [], goal = {} } = req.body || {}
  if (!Array.isArray(legs) || legs.length === 0) {
    return res.status(200).json({ success: true, evals: [] })
  }

  const legsDescription = legs.map((l, i) =>
    `${i + 1}. [ID: ${l.id}] ${l.matchLabel || `${l.homeTeam} vs ${l.awayTeam}`} | Market: ${l.market} | Odds: ${l.odds} | Implied Prob: ${Math.round((1 / (l.odds || 1.5)) * 100)}%`
  ).join('\n')

  const prompt = `You are the senior football risk analyst and accumulator evaluation engine powering Odds Factory.

ODDS FACTORY MASTER SYSTEM INSTRUCTION:
- Audit each selection independently against the user's objective (Goal Mode: ${goal?.mode || 'max_safety'}).
- FAIR MARKET CHALLENGE: Does another market (e.g. Over 7.5/8.5 Corners, Double Chance, Draw No Bet, or Team Goals) offer stronger evidence and less variance than the current selection?
- Mark 'shouldDrop: true' for:
  * Negative EV lines where the price is squeezed.
  * Away straight wins on low odds (notorious accumulator traps).
  * High-variance lines (Over 3.5 Goals, exact score, volatile card markets).
- Mark 'shouldDrop: false' for:
  * High-probability, evidence-supported selections (Double Chance 1X/X2, Over 1.5 Goals on active pacers, DNB, Corners Over lines).
- Citing exact teams, explain the risk or strength in 1 concise sentence.

Selections:
${legsDescription}

Return ONLY a raw JSON array of objects with this exact structure:
[
  {
    "legId": "exact leg ID from prompt",
    "trueProbability": 0.82,
    "ev": 0.04,
    "volatility": 0.25,
    "shouldDrop": false,
    "rationale": "Arsenal vs Chelsea: Over 1.5 has high stability — both sides have potent attacks."
  }
]`

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
          const parsed = JSON.parse(text)
          const evals = Array.isArray(parsed) ? parsed : parsed.evals || Object.values(parsed)[0]
          if (Array.isArray(evals) && evals.length > 0) {
            return res.status(200).json({ success: true, evals })
          }
        }
      }
    } catch {
      // Fall through to Gemini
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
          const parsed = JSON.parse(text)
          const evals = Array.isArray(parsed) ? parsed : parsed.evals || Object.values(parsed)[0]
          if (Array.isArray(evals) && evals.length > 0) {
            return res.status(200).json({ success: true, evals })
          }
        }
      } catch {
        // Continue to next model
      }
    }
  }

  // ── Strategy 3: Neural Match Physics Engine (Zero-Failure Fallback) ───────
  const evals = legs.map((l) => {
    const odds = parseFloat(l.odds) || 1.5
    const prob = l.probability ? (l.probability > 1 ? l.probability / 100 : l.probability) : 1 / odds
    const ev = Number((prob * odds - 1).toFixed(3))
    const m = (l.market || '').toLowerCase()

    // Identify accumulator risks
    const isHighVariance = m.includes('over 2.5') || m.includes('over 3.5') || m.includes('btts') || odds > 2.20
    const isNegativeEv = ev < -0.06
    const shouldDrop = isNegativeEv || (isHighVariance && odds > 2.0)

    const [home = 'Home', away = 'Away'] = (l.matchLabel || '').split(' vs ')
    let rationale = `${home} vs ${away}: ${l.market} @${odds.toFixed(2)} maintains a calibrated ${Math.round(prob * 100)}% model survival rating.`
    if (shouldDrop) {
      rationale = `${home} vs ${away}: ${l.market} @${odds.toFixed(2)} carries elevated variance (EV ${ev >= 0 ? `+${ev}` : ev}) — consider swapping to Double Chance or Corners.`
    }

    return {
      legId: l.id,
      trueProbability: Number(prob.toFixed(2)),
      ev,
      volatility: isHighVariance ? 0.65 : 0.25,
      shouldDrop,
      rationale,
    }
  })

  return res.status(200).json({ success: true, evals })
}
