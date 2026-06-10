/**
 * Odds Factory — Local Booking Server
 * 
 * This server opens a real Chromium browser on sportybet.com and
 * makes the booking API call from inside that page, so the request
 * looks exactly like a real browser visiting the site (correct
 * cookies, headers, origin). This bypasses CORS / bot detection.
 * 
 * Runs on http://localhost:3001
 * Vite dev server proxies /api/local → http://localhost:3001
 */

import 'dotenv/config'
import http from 'http'
import { chromium } from 'playwright'

// ── browser singleton (one shared browser for performance) ────────────────────

let _browser = null
let _page    = null   // persistent page to keep session alive

async function getPage() {
  try {
    if (!_browser || !_browser.isConnected()) {
      _browser = null
      _page = null
    }

    if (!_browser) {
      console.log('🌐 Trying to launch with locally installed Google Chrome...')
      try {
        _browser = await chromium.launch({
          channel: 'chrome',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
      } catch (e) {
        try {
          console.log('🌐 Google Chrome not found. Trying Microsoft Edge...')
          _browser = await chromium.launch({
            channel: 'msedge',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          })
        } catch (e2) {
          console.log('🌐 Falling back to default Playwright browser...')
          _browser = await chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          })
        }
      }
      _page = null
    }

    if (!_page || _page.isClosed() || !_page.context()) {
      const ctx = await _browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'Africa/Lagos',
      })
      _page = await ctx.newPage()
      console.log('🔗 Navigating to SportyBet…')
      await _page.goto('https://www.sportybet.com/ng/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await _page.waitForTimeout(2500)
      console.log('✅ SportyBet page loaded — session ready.')
    }

    // Quick test to ensure page/context is actually working
    await _page.evaluate(() => 1);

    return _page;
  } catch (err) {
    console.error('Error inside getPage(), resetting browser instance:', err.message)
    // Clean up browser instance
    if (_browser) {
      try { await _browser.close() } catch(e) {}
    }
    _browser = null
    _page = null
    
    // Retry once with a clean slate
    console.log('🔄 Retrying page initialization with a clean browser...')
    return await getCleanPage()
  }
}

async function getCleanPage() {
  console.log('🌐 Launching clean browser instance...')
  try {
    _browser = await chromium.launch({
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  } catch (e) {
    try {
      _browser = await chromium.launch({
        channel: 'msedge',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    } catch (e2) {
      _browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    }
  }
  const ctx = await _browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Africa/Lagos',
  })
  _page = await ctx.newPage()
  console.log('🔗 Navigating to SportyBet…')
  await _page.goto('https://www.sportybet.com/ng/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await _page.waitForTimeout(2500)
  console.log('✅ SportyBet page loaded — session ready.')
  return _page
}

// ── JSON body parser ──────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) }
      catch (e) { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS — allow requests from Vite dev server
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // ── GET /health ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true, ts: Date.now() }))
    return
  }

  // ── POST /load — load a booking code via real browser ─────────────────────
  if (req.method === 'POST' && req.url === '/load') {
    try {
      const { code } = await readBody(req)
      if (!code) throw new Error('No booking code provided')

      const page = await getPage()

      console.log(`📥 Navigating browser to booking code: ${code}`)
      await page.goto(`https://www.sportybet.com/ng/?shareCode=${code.toUpperCase()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })
      await page.waitForTimeout(2000)

      console.log(`📥 Loading booking code data: ${code}`)
      const requestContext = page.context().request
      const resp = await requestContext.get(`https://www.sportybet.com/api/ng/orders/share/${code.toUpperCase()}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      })

      const status = resp.status()
      const body = await resp.json()
      console.log(`Load response status: ${status}`)

      if (body) {
        res.writeHead(200)
        res.end(JSON.stringify(body))
      } else {
        res.writeHead(status || 500)
        res.end(JSON.stringify({ error: 'Failed to load booking code' }))
      }
    } catch (err) {
      console.error('Load error:', err.message)
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // ── POST /book — submit optimized selections and get new booking code ──────
  if (req.method === 'POST' && req.url === '/book') {
    try {
      const { selections } = await readBody(req)

      if (!Array.isArray(selections) || selections.length === 0) {
        throw new Error('No selections provided')
      }

      console.log(`🎯 Booking ${selections.length} selection(s) on SportyBet…`)
      console.log('Selections:', JSON.stringify(selections, null, 2))

      const page = await getPage()

      const requestContext = page.context().request
      const resp = await requestContext.post('https://www.sportybet.com/api/ng/orders/share', {
        data: { selections, device: 'web', source: 'betslip' },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      })

      const status = resp.status()
      const body = await resp.json()
      console.log(`Book response status: ${status}`, JSON.stringify(body).slice(0, 400))

      if (body?.bizCode === 10000 && body?.data?.shareCode) {
        const code = body.data.shareCode
        console.log(`✅ Booking code generated: ${code}`)
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, shareCode: code }))
      } else {
        const msg = body?.message || body?.msg || JSON.stringify(body)
        console.warn('❌ SportyBet rejected:', msg)
        res.writeHead(200)
        res.end(JSON.stringify({ success: false, message: msg, raw: body }))
      }
    } catch (err) {
      console.error('Book error:', err.message)
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // ── POST /ai-optimize — Gemini real-world form AI Optimizer ───────────────
  if (req.method === 'POST' && req.url === '/ai-optimize') {
    try {
      const { legs, goal, availableMarkets } = await readBody(req)
      if (!legs) throw new Error('No legs provided')

      console.log(`🧠 Querying Gemini AI for slip optimization (${legs.length} legs) [Goal: ${goal.mode}]…`)
      const API_KEY = process.env.GEMINI_API_KEY
      
      const prompt = `You are Odds Factory's AI Engine. A user wants to optimize their betting slip.
Goal: ${goal.mode} (Target Odds: ${goal.targetOdds}, Target Survival: ${goal.targetSurvival})

Current Slip:
${JSON.stringify(legs, null, 2)}

Available Markets per Match:
${JSON.stringify(availableMarkets, null, 2)}

Mode Definitions:
- balanced: Maximize EV * Survival probability. Avoid purely suicidal legs, keep positive EV bets with reasonable survival. Drop legs with horrible survival unless EV is astronomically high.
- target_survival: Keep adding the safest/highest-confidence legs to the slip until the combined probability of the slip hits the targetSurvival (e.g. 10%). Drop all other legs.
- best_ev: For every leg, swap to the market with the highest mathematical Expected Value. Drop any legs that have negative EV. Do not worry about slip survival.
- target_odds: Swap legs to lower-risk markets to bring the combined total odds down near targetOdds. If the slip still exceeds targetOdds, drop the riskiest legs entirely until it hits the target. No concern for safety.
- safe_mode: Score each leg by WinProbability * Confidence. Keep only highly probable markets (e.g., Double Chance, Over 0.5 Goals). Drop legs if probability is < 75%.
- dreamer: For large accumulators. Preserve high odds, just reduce absolute stupidity. Change "Over 3.5 Goals" to "Over 1.5 Goals", or "Away Win" to "X2". DO NOT drop legs unless absolutely necessary.

Instructions:
1. Analyze the real-world form and risk of these matches.
2. Strictly follow the Mode Definition for the user's selected goal (${goal.mode}).
3. Determine the best market and outcome replacement for EACH leg.
4. If the active Mode Definition dictates a leg should be dropped, mark it as dropped (dropped: true).
5. Output EXACTLY a JSON array of EditResult objects. No markdown formatting, just raw JSON.
Format of each EditResult object:
{
  "legId": "string",
  "changed": true/false,
  "dropped": true/false,
  "marketId": "string",
  "outcomeId": "string",
  "specifier": "string",
  "message": "string"
}`

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      })

      if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`)
      const resJson = await response.json()
      const jsonStr = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      const edits = JSON.parse(jsonStr)

      res.writeHead(200)
      res.end(JSON.stringify({ success: true, edits }))
    } catch (err) {
      console.error('AI Optimize error:', err.message)
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // ── POST /analyze — perform advanced Gemini AI match research & UI overview ──
  if (req.method === 'POST' && req.url === '/analyze') {
    try {
      const { legs } = await readBody(req)
      if (!Array.isArray(legs) || legs.length === 0) {
        throw new Error('No legs provided for analysis')
      }

      console.log(`🧠 Querying Gemini AI for slip analysis (${legs.length} legs)…`)
      
      const API_KEY = process.env.GEMINI_API_KEY
      
      const prompt = `You are Odds Factory's Advanced Sports Analyst. Analyze the following betting slip selections. Provide a premium, highly professional match overview, security evaluation, and recommendations for each match. Format the output in Markdown with elegant headers and structured lists. Use emojis to make it look visually stunning.

Slip details:
${legs.map((l, i) => `
${i + 1}. Match: ${l.matchLabel}
   - Chosen Market: ${l.market} (Odds: ${l.odds.toFixed(2)})
   - Confidence Tier: Tier ${l.tier || '3'}
   - Rationale: ${l.rationale}
`).join('\n')}

Please return:
1. 🛡️ **Overall Ticket Risk Assessment**: Brief summary of the ticket's safety and expected value.
2. 📊 **Leg-by-Leg Detailed Analysis**: Detailed tactical/statistical context for each matchup.
3. 💡 **Suggested Optimization/Tweaks**: Specific recommendations to further reduce risk or improve odds.`

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Gemini API returned status ${response.status}: ${errText}`)
      }

      const resJson = await response.json()
      const markdown = resJson.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.'

      res.writeHead(200)
      res.end(JSON.stringify({ success: true, analysis: markdown }))
    } catch (err) {
      console.error('Analyze error:', err.message)
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Not found' }))
})

const PORT = 3001
server.listen(PORT, () => {
  console.log('')
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Odds Factory — Booking Server      ║')
  console.log(`║   http://localhost:${PORT}              ║`)
  console.log('╚══════════════════════════════════════╝')
  console.log('')
  console.log('Waiting for requests from the React app…')
  console.log('Keep this terminal open while using the app.')
  console.log('')
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down booking server…')
  if (_browser) await _browser.close()
  process.exit(0)
})
