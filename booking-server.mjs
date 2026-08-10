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

// ── AI Orchestrator (ESM dynamic import on first use) ─────────────────────────
const BZZOIRO_API_KEY = '44f7f68bac9c7ed68631979a69ba1d855448b7fb'
const BZZOIRO_BASE    = 'https://sports.bzzoiro.com'

async function bzzoiroFetch(sport, endpoint, searchQuery) {
  const qs = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''
  const url = `${BZZOIRO_BASE}/${sport.toLowerCase()}${endpoint}${qs}`
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Token ${BZZOIRO_API_KEY}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(2000), // Fast 2s timeout
    })
    if (r.status === 402) return { error: 'subscription_required' }
    if (!r.ok)           return null
    return await r.json()
  } catch { return null }
}

async function fetchLiveDataForLegs(legs) {
  const results = {}
  // Limit live lookups to first 5 legs for ultra-fast response
  const targetLegs = (legs || []).slice(0, 5)
  await Promise.all(targetLegs.map(async leg => {
    const sport = (leg.sport || 'football').toLowerCase()
    const query = `${leg.homeTeam || ''} ${leg.awayTeam || ''}`.trim()
    if (!query) return
    const [detail, pred] = await Promise.all([
      bzzoiroFetch(sport, '/api/v2/matches/', query),
      bzzoiroFetch(sport, '/api/v2/predictions/', query),
    ])
    results[leg.id] = { detail, pred }
  }))
  return results
}

async function callGemini(prompt, geminiKey, jsonMode = false) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      ...(jsonMode ? { response_mime_type: 'application/json' } : {})
    }
  }
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro']
  let lastErr = null

  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        }
      )
      if (r.status === 404) continue
      if (!r.ok) {
        const t = await r.text()
        throw new Error(`Gemini ${r.status}: ${t.slice(0, 200)}`)
      }
      const j = await r.json()
      const text = j.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) return text
    } catch (e) {
      lastErr = e
    }
  }

  throw lastErr || new Error('All Gemini model endpoints failed')
}

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
      await _page.goto('https://www.sportybet.com/ng/', { waitUntil: 'domcontentloaded', timeout: 15000 })
      console.log('✅ SportyBet page loaded — session ready.')
    }

    // Quick test to ensure page/context is actually working
    await _page.evaluate(() => 1);

    return _page;
  } catch (err) {
    console.error('Error inside getPage(), resetting browser instance:', err.message)
    if (_browser) {
      try { await _browser.close() } catch(e) {}
    }
    _browser = null
    _page = null
    
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
  await _page.goto('https://www.sportybet.com/ng/', { waitUntil: 'domcontentloaded', timeout: 15000 })
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

  // ── POST /load — load a booking code via real browser session (ultra-fast) ──
  if (req.method === 'POST' && req.url === '/load') {
    try {
      const { code } = await readBody(req)
      if (!code) throw new Error('No booking code provided')

      const page = await getPage()
      const formattedCode = code.trim().toUpperCase()

      console.log(`📥 Loading booking code data: ${formattedCode}`)
      const requestContext = page.context().request
      
      // Step 1: Direct API request via active session (instant sub-second)
      let resp = await requestContext.get(`https://www.sportybet.com/api/ng/orders/share/${formattedCode}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Referer': 'https://www.sportybet.com/ng/',
        },
        timeout: 5000,
      })

      let body = null
      if (resp.ok()) {
        try { body = await resp.json() } catch {}
      }

      // Step 2: Fallback to full page load ONLY if direct API fetch failed
      if (!body || body.bizCode === 19000) {
        console.log(`🔄 Direct API fetch returned empty/invalid, trying fallback page navigation…`)
        await page.goto(`https://www.sportybet.com/ng/?shareCode=${formattedCode}`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        })
        resp = await requestContext.get(`https://www.sportybet.com/api/ng/orders/share/${formattedCode}`, {
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          timeout: 5000,
        })
        body = await resp.json()
      }

      const status = resp.status()
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

  // ── POST /ai-optimize — AI Orchestrator Slip Optimizer ──────────────────────
  if (req.method === 'POST' && req.url === '/ai-optimize') {
    try {
      const { legs, goal } = await readBody(req)
      if (!Array.isArray(legs) || legs.length === 0) throw new Error('No legs provided')
      const API_KEY = process.env.GEMINI_API_KEY

      console.log(`🧠 [Orchestrator] Optimize ${legs.length} legs [${goal?.mode}]…`)

      // Step 1: Fetch live data from Bzzoiro for all legs in parallel
      console.log('📡 Fetching live sports data from Bzzoiro API…')
      const liveData = await fetchLiveDataForLegs(legs)
      const hasData = Object.values(liveData).some(d => d && (d.detail || d.pred))
      if (hasData) {
        console.log('✅ Live data fetched successfully')
      } else {
        console.log('⚠️  No live data returned — Gemini will use its own research')
      }

      // Step 2: Build optimization prompt (data-driven or research mode)
      const modeInstructions = {
        balanced:        'Maximize EV × Survival. Drop suicidal legs. Keep positive-EV bets.',
        target_survival: `Keep only the safest legs until combined probability hits ${goal?.targetSurvival ?? 10}%. Drop all others.`,
        best_ev:         'Swap every leg to the highest-EV market. Drop negative-EV legs.',
        target_odds:     `Swap markets until combined odds are near ${goal?.targetOdds ?? 20}. Drop legs if still too high.`,
        safe_mode:       'Keep only markets with ≥75% true probability (Double Chance, Over 0.5). Drop everything else.',
        dreamer:         'Preserve big odds. Just fix the obvious traps (e.g. Away Win → Home or Draw). Drop only if truly suicidal.',
      }

      const dataSection = hasData
        ? `[LIVE MATCH DATA]\n${JSON.stringify(liveData, null, 2)}`
        : `[RESEARCH MODE] No live API data retrieved. Use your knowledge of each fixture's recent form, head-to-head records, team news, injuries, and statistical models to evaluate every leg.`

      const optimizePrompt = `You are OddsFactory's Elite Betting Optimizer.

Goal: ${goal?.mode ?? 'balanced'}
Instruction: ${modeInstructions[goal?.mode] ?? modeInstructions.balanced}

${dataSection}

Slip legs:
${legs.map((l, i) => `${i+1}. [ID:${l.id}] ${l.matchLabel} | ${l.market} @${l.odds} | Sport: ${l.sport || 'football'}`).join('\n')}

Valid safe market strings (use EXACTLY):
Football: "Over 0.5", "Over 1.5", "Under 2.5", "Under 3.5", "Under 4.5", "Home or Draw", "Away or Draw", "Draw No Bet", "BTTS Yes", "Both Halves Under 1.5 Yes"
Basketball: "Over Total Points", "Under Total Points", "Spread on Favorite", "Moneyline"

Return ONLY a raw JSON array. No markdown. Each element:
{ "legId": "string", "changed": true/false, "dropped": true/false, "market": "string", "message": "string" }`

      const jsonStr = await callGemini(optimizePrompt, API_KEY, true)
      const edits = JSON.parse(jsonStr || '[]')

      res.writeHead(200)
      res.end(JSON.stringify({ success: true, edits, dataSource: hasData ? 'live_api' : 'gemini_research' }))
    } catch (err) {
      console.error('AI Optimize error:', err.message)
      res.writeHead(200)
      res.end(JSON.stringify({ success: false, error: err.message, edits: [] }))
    }
    return
  }

  // ── POST /analyze — AI Orchestrator Full Slip Analysis ───────────────────────
  if (req.method === 'POST' && req.url === '/analyze') {
    try {
      const { legs } = await readBody(req)
      if (!Array.isArray(legs) || legs.length === 0) throw new Error('No legs provided for analysis')
      const API_KEY = process.env.GEMINI_API_KEY

      console.log(`🧠 [Orchestrator] Analyzing slip (${legs.length} legs)…`)

      // Fetch live data for all legs in parallel
      console.log('📡 Fetching live sports data from Bzzoiro API…')
      const liveData = await fetchLiveDataForLegs(legs)
      const hasData = Object.values(liveData).some(d => d && (d.detail || d.pred))

      const dataSection = hasData
        ? `[LIVE MATCH DATA]\n${JSON.stringify(liveData, null, 2)}`
        : `[RESEARCH MODE] Live API data was unavailable. Conduct your own research on each match using your knowledge of recent results, form, injuries, head-to-head history, and team news.`

      const analyzePrompt = `You are OddsFactory's Elite Sports Analyst. Analyze this betting slip and produce a premium, professional Markdown report.

${dataSection}

Slip:
${legs.map((l, i) => `${i+1}. ${l.matchLabel} | ${l.market} @${l.odds.toFixed(2)} | Tier ${l.tier || 3} | ${l.rationale || ''}`).join('\n')}

Return a Markdown report with:
1. 🛡️ **Overall Ticket Risk Assessment** — health score /100, combined survival estimate, key risks.
2. 📊 **Leg-by-Leg Analysis** — for EACH leg: confidence %, EV assessment, volatility flag (derby/cup/rivalry), verdict (✅ KEEP / ⚠️ RISKY / ❌ CUT).
3. 🚨 **Judas Legs** — the most dangerous picks and exactly why.
4. 💡 **Recommended Swaps** — specific market alternatives with reasoning.

Be brutally honest. Use emojis. Format beautifully with headers and bullet points.`

      const markdown = await callGemini(analyzePrompt, API_KEY, false)

      res.writeHead(200)
      res.end(JSON.stringify({ success: true, analysis: markdown || 'No response from AI.', dataSource: hasData ? 'live_api' : 'gemini_research' }))
    } catch (err) {
      console.error('Analyze error:', err.message)
      res.writeHead(200)
      res.end(JSON.stringify({ success: false, error: err.message, analysis: '### 🛡️ AI Analysis Unavailable\nStandard mathematical engine optimization completed successfully.' }))
    }
    return
  }


  // ── POST /eval-legs — Gemini per-leg evaluator for SmartDrop ─────────────────
  // Frontend can't call Gemini directly (API key type mismatch), so it proxies here.
  if (req.method === 'POST' && req.url === '/eval-legs') {
    try {
      const { legs, goal } = await readBody(req)
      if (!Array.isArray(legs) || legs.length === 0) throw new Error('No legs provided')

      const API_KEY = process.env.GEMINI_API_KEY

      // Fetch live match data for all legs before asking Gemini
      console.log(`🧠 [SmartDrop] Evaluating ${legs.length} legs with live data + Gemini…`)
      const liveData = await fetchLiveDataForLegs(legs)
      const hasData  = Object.values(liveData).some(d => d && (d.detail || d.pred))

      const dataSection = hasData
        ? `[LIVE MATCH DATA]\n${JSON.stringify(liveData, null, 2)}`
        : `[RESEARCH MODE] No live API data. Use your knowledge of current team form, H2H history, injuries, and match context (derby/cup/rivalry) for each fixture below.`

      const goalText = {
        balanced:        'Balanced: drop legs with negative EV, high volatility, or poor real-world form.',
        target_survival: `Target Survival ${goal?.targetSurvival ?? 10}%: drop every leg killing the slip's survival probability.`,
        target_odds:     `Target Odds ${goal?.targetOdds ?? 20}: drop legs until combined odds near the target.`,
        best_ev:         'Best EV: drop every leg where trueProbability × odds < 1.',
        safe_mode:       'Safe Mode: drop every leg where your estimated true probability is below 75%.',
        dreamer:         'Dreamer: only drop truly suicidal legs (EV < -0.3 or volatility > 0.85).',
      }[goal?.mode ?? 'balanced'] ?? 'Balanced: drop legs with negative EV or high volatility.'

      const legsText = legs.map((l, i) =>
        `Leg ${i + 1} [ID: ${l.id}]:\n  Match: ${l.matchLabel}\n  Market: ${l.market}\n  Odds: ${l.odds}\n  Engine probability: ${((l.probability || 0.5) * 100).toFixed(1)}%\n  Tier: ${l.tier ?? 2}`
      ).join('\n\n')

      const prompt = `You are OddsFactory's Elite Betting Risk Analyst. Evaluate each leg of this slip individually and precisely.

${dataSection}

GOAL: ${goalText}

SLIP LEGS:
${legsText}

Combined odds: ${legs.reduce((a, l) => a * l.odds, 1).toFixed(2)}
Combined survival: ${(legs.reduce((a, l) => a * (l.probability || 0.5), 1) * 100).toFixed(1)}%

For each leg, use your knowledge of:
- Current form (last 5 matches for both teams)
- Head-to-head record
- Recent injuries / suspensions
- Match type volatility (derby / cup / rivalry / dead rubber)
- Whether the market odds genuinely reflect reality
- For Over/Under: average goals, defensive records, pace of play

Return ONLY a raw JSON array. No markdown. Each object must have EXACTLY these fields:
{
  "legId": "exact ID string from above",
  "trueProbability": number (0 to 1),
  "ev": number (trueProbability times odds minus 1),
  "volatility": number (0 to 1),
  "shouldDrop": boolean,
  "rationale": "Specific reason — name the teams, cite form/stats, explain the exact risk of THIS market for THIS match. Never generic text."
}`

      const jsonStr = await callGemini(prompt, API_KEY, true)
      const evals   = JSON.parse(jsonStr || '[]')

      res.writeHead(200)
      res.end(JSON.stringify({ success: true, evals, dataSource: hasData ? 'live_api' : 'gemini_research' }))
    } catch (err) {
      console.error('Eval-legs error:', err.message)
      res.writeHead(200)
      res.end(JSON.stringify({ success: false, error: err.message, evals: [] }))
    }
    return
  }

  // ── POST /book — submit selections via real browser session ──────────────────
  if (req.method === 'POST' && req.url === '/book') {
    try {
      const { selections } = await readBody(req)
      if (!Array.isArray(selections) || selections.length === 0) {
        throw new Error('No selections provided')
      }

      // Validate required fields on every selection
      const invalid = selections.filter(s => !s.eventId || !s.marketId || !s.outcomeId)
      if (invalid.length > 0) {
        throw new Error(`${invalid.length} selection(s) missing eventId / marketId / outcomeId`)
      }

      console.log(`🎯 Booking ${selections.length} selections via Playwright browser…`)
      const page = await getPage()

      // POST to SportyBet booking API from inside the real browser context
      const requestContext = page.context().request
      const resp = await requestContext.post('https://www.sportybet.com/api/ng/orders/share', {
        headers: {
          'Accept':       'application/json',
          'Content-Type': 'application/json',
          'Referer':      'https://www.sportybet.com/ng/',
          'Origin':       'https://www.sportybet.com',
        },
        data: JSON.stringify({ selections, device: 'web', source: 'betslip' }),
      })

      const status = resp.status()
      const body   = await resp.json()
      console.log(`📤 Book response status: ${status}`, body?.bizCode)

      if (body?.bizCode === 10000 && body?.data?.shareCode) {
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, shareCode: body.data.shareCode, bizCode: body.bizCode }))
      } else {
        // Pass back SportyBet's own error so the UI can show it
        res.writeHead(200)
        res.end(JSON.stringify({ success: false, bizCode: body?.bizCode, message: body?.message || 'SportyBet rejected the booking request' }))
      }
    } catch (err) {
      console.error('Book error:', err.message)
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
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
