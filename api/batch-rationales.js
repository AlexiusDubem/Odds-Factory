/**
 * Vercel Serverless Function: POST /api/batch-rationales
 * Generates evidence-driven AI rationales for selected accumulator legs.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { picks } = req.body || {}
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

  if (!apiKey || !Array.isArray(picks) || picks.length === 0) {
    return res.status(200).json({ success: false, rationales: {} })
  }

  const models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']

  const prompt = `You are Odds Factory's Elite Sports Intelligence Analyst.
For each selected match below, produce a CONCISE, 1-SENTENCE evidence-backed rationale naming the exact teams, citing real statistics, recent form, xG, or head-to-head proof. Never output generic template text.

Matches:
${picks.map((p, i) => `${i + 1}. [ID:${p.id}] ${p.homeTeam} vs ${p.awayTeam} (${p.league}) | Selection: ${p.market} @${p.odds}`).join('\n')}

Return ONLY a raw JSON object mapping each leg ID to its 1-sentence evidence string:
{
  "${picks[0]?.id}": "real proof string naming teams and citing stats..."
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
        return res.status(200).json({ success: true, rationales: JSON.parse(text) })
      }
    } catch (e) {
      // Continue to next model
    }
  }

  return res.status(200).json({ success: false, rationales: {} })
}
