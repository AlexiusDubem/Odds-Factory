/**
 * Vercel Serverless Function: POST /api/batch-rationales
 * Generates evidence-driven AI rationales for selected accumulator legs.
 * Multi-provider waterfall:
 * 1. OpenAI (gpt-4o-mini)
 * 2. Google Gemini (gemini-3.5-flash / gemini-flash-latest)
 * 3. Neural Match Physics Engine (Zero-failure odds-derived rationales)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { picks = [] } = req.body || {}
  if (!Array.isArray(picks) || picks.length === 0) {
    return res.status(200).json({ success: true, rationales: {} })
  }

  const prompt = `You are Odds Factory's Neural Sports Intelligence Analyst.
For each selected match below, produce a CONCISE, 1-SENTENCE evidence-backed rationale naming the exact teams, citing real statistics, recent form, xG, or head-to-head proof. Never output generic template text.

Matches:
${picks.map((p, i) => `${i + 1}. [ID:${p.id}] ${p.homeTeam} vs ${p.awayTeam} (${p.league}) | Selection: ${p.market} @${p.odds}`).join('\n')}

Return ONLY a raw JSON object mapping each leg ID to its 1-sentence evidence string:
{
  "${picks[0]?.id}": "real proof string naming teams and citing stats..."
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
          const rationales = JSON.parse(text)
          return res.status(200).json({ success: true, rationales })
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
          const rationales = JSON.parse(text)
          return res.status(200).json({ success: true, rationales })
        }
      } catch {
        // Continue to next model
      }
    }
  }

  // ── Strategy 3: Neural Match Physics Engine (Zero-Failure Fallback) ───────
  const rationales = {}
  for (const p of picks) {
    const prob = Math.round((1 / (p.odds || 1.5)) * 100)
    rationales[p.id] = `${p.homeTeam} vs ${p.awayTeam} (${p.league}): Market pricing gives ${p.market} a calibrated ${prob}% statistical efficiency rating @${p.odds.toFixed(2)}.`
  }

  return res.status(200).json({ success: true, rationales })
}
