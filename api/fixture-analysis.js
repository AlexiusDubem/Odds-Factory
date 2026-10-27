/**
 * Vercel Serverless Function: POST /api/fixture-analysis
 * Independent Fixture-Level Market Analyst (Production Parity)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { fixture, allowedMarketFamilies = ['ALL'], availableMarkets = [], stats = {} } = req.body || {}

    const GEMINI_FIXTURE_SYSTEM_INSTRUCTION = `You are Odds Factory’s fixture-level market analyst. Analyse each football fixture independently using only the structured data provided. Compare only currently available SportyBet markets within the user’s allowed market families. Select the single market with the strongest evidence for that fixture, or return NO_QUALIFYING_SELECTION if no market is sufficiently supported. Do not invent facts, odds, statistics, injuries, lineups, or markets. Do not favour a market because of its odds or its position in the scraped payload. Explain the chosen market using supplied evidence only. Do not discuss accumulator length, combined ticket probability, stake, or return. Output valid JSON matching the provided schema.`

    const prompt = `Analyze this fixture independently using ONLY the structured payload:
${JSON.stringify({ fixture, allowedMarketFamilies, availableMarkets, stats })}

Return JSON matching:
{
  "fixtureId": "string",
  "fixture": "Home vs Away",
  "status": "QUALIFIED | NO_QUALIFYING_SELECTION | INSUFFICIENT_DATA",
  "allowedMarketFamilies": ["..."],
  "chosenMarket": {
    "canonicalMarket": "...",
    "sportyBetMarketName": "...",
    "selection": "...",
    "decimalOdds": 0,
    "marketFamily": "...",
    "modelProbability": 0,
    "confidence": "LOW | MODERATE | HIGH"
  },
  "alternativesConsidered": [
    {
      "market": "...",
      "selection": "...",
      "reasonNotChosen": "..."
    }
  ],
  "evidence": ["..."],
  "riskFlags": ["..."],
  "dataAgeMinutes": 0,
  "reason": "..."
}`

    let result = null

    // 1. Google Gemini (Primary for fixture analysis)
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      const models = ['gemini-flash-latest', 'gemini-1.5-flash']
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': geminiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: {
                parts: [{ text: GEMINI_FIXTURE_SYSTEM_INSTRUCTION }]
              },
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
          })

          if (resp.ok) {
            const data = await resp.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              result = JSON.parse(text)
              break
            }
          }
        } catch {
          // Try next
        }
      }
    }

    // 2. OpenAI fallback if Gemini key is missing or fails
    if (!result && process.env.OPENAI_API_KEY) {
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: GEMINI_FIXTURE_SYSTEM_INSTRUCTION },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        })

        if (resp.ok) {
          const data = await resp.json()
          const text = data.choices?.[0]?.message?.content
          if (text) {
            result = JSON.parse(text)
          }
        }
      } catch {
        // Fall through
      }
    }

    return res.status(200).json({ success: true, result })
  } catch (err) {
    console.error('Fixture analysis error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
}
