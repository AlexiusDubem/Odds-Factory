/**
 * Vercel Serverless Function: GET /api/load or POST /api/load
 * Loads SportyBet booking code data directly from the SportyBet API.
 */

export default async function handler(req, res) {
  // Allow GET with ?code=... or POST with { code: "..." }
  let code = ''
  if (req.method === 'GET') {
    code = req.query?.code || ''
  } else if (req.method === 'POST') {
    code = req.body?.code || req.query?.code || ''
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  code = String(code).trim().toUpperCase()
  if (!code) {
    return res.status(400).json({ error: 'No booking code provided' })
  }

  try {
    const response = await fetch(`https://www.sportybet.com/api/ng/orders/share/${code}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Origin': 'https://www.sportybet.com',
        'Referer': 'https://www.sportybet.com/ng/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    })

    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error('SportyBet share code load error:', error)
    return res.status(500).json({
      error: 'Failed to fetch booking code from SportyBet. Check your connection or verify the code.',
      bizCode: 19000,
    })
  }
}
