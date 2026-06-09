#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

// Usage:
// node automateSportybet.mjs <bookingCode> [--max-odds=NUMBER] [--min-survival=NUMBER]
// Examples:
// node automateSportybet.mjs X60VQ9 --max-odds=30
// node automateSportybet.mjs X60VQ9 --min-survival=20

function parseArgs(argv) {
  const args = { bookingCode: null, maxOdds: null, minSurvival: null }
  for (const a of argv) {
    if (!a.startsWith('--') && !args.bookingCode) args.bookingCode = a
    if (a.startsWith('--max-odds=')) args.maxOdds = parseFloat(a.split('=')[1])
    if (a.startsWith('--min-survival=')) args.minSurvival = parseFloat(a.split('=')[1])
  }
  return args
}

const argv = parseArgs(process.argv.slice(2))
if (!argv.bookingCode) {
  console.log('Usage: node automateSportybet.mjs <bookingCode> [--max-odds=NUMBER] [--min-survival=NUMBER]')
  process.exit(1)
}

const BOOKING_CODE = argv.bookingCode
const MAX_ODDS_TARGET = argv.maxOdds // stop when combined odds <= this
const MIN_SURVIVAL_TARGET = argv.minSurvival // ensure survival probability (%) >= this

// Simple optimization: remove highest-odds legs to meet targets
function optimizeSelections(selections) {
  // selections expected: [{ eventId, marketId, outcomeId, odds }]
  const normalized = selections.map((s) => ({ ...s, odds: Number(s.odds) || Number(s.oddsDecimal) || 2 }))

  const combinedOdds = (arr) => arr.reduce((acc, x) => acc * x.odds, 1)
  const survival = (arr) => arr.reduce((acc, x) => acc * (1 / x.odds), 1) * 100

  let sel = [...normalized]

  if (MAX_ODDS_TARGET) {
    while (sel.length > 1 && combinedOdds(sel) > MAX_ODDS_TARGET) {
      let idx = 0
      let maxOdds = -Infinity
      for (let i = 0; i < sel.length; i++) {
        if (sel[i].odds > maxOdds) {
          maxOdds = sel[i].odds
          idx = i
        }
      }
      sel.splice(idx, 1)
    }
  }

  if (MIN_SURVIVAL_TARGET) {
    while (sel.length > 1 && survival(sel) < MIN_SURVIVAL_TARGET) {
      let idx = 0
      let maxOdds = -Infinity
      for (let i = 0; i < sel.length; i++) {
        if (sel[i].odds > maxOdds) {
          maxOdds = sel[i].odds
          idx = i
        }
      }
      sel.splice(idx, 1)
    }
  }

  if (!MAX_ODDS_TARGET && !MIN_SURVIVAL_TARGET) {
    if (survival(sel) < 15 && sel.length > 1) {
      sel.sort((a, b) => b.odds - a.odds)
      sel = sel.slice(0, sel.length - 1)
    }
  }

  return sel
}

;(async () => {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('Opening SportyBet. Please log in in the opened browser window, then return here and press Enter.')
  await page.goto('https://www.sportybet.com')

  await new Promise((resolve) => {
    process.stdin.resume()
    process.stdin.on('data', () => resolve())
  })

  console.log(`Fetching booking code ${BOOKING_CODE} from SportyBet...`)
  let orig
  try {
    orig = await page.evaluate(async (code) => {
      const resp = await fetch(`/api/ng/orders/share/${code}`)
      if (!resp.ok) throw new Error('Network response was not ok')
      const json = await resp.json()
      return json
    }, BOOKING_CODE)
  } catch (err) {
    console.error('Failed to load booking code from SportyBet:', err)
    process.exit(1)
  }

  const data = orig.data || orig
  let selections = data.selections || data.outcomes || data.ticket?.selections || data.legs || []

  const norm = selections.map((s) => {
    const outcome = s.outcome || (s.outcomes && s.outcomes[0]) || s
    return {
      eventId: s.eventId || s.matchId || s.match_id || s.event_id || (s.event && s.event.id) || (s.match && s.match.id),
      marketId: s.marketId || s.market_id || s.market || (outcome && outcome.marketId),
      outcomeId: outcome && (outcome.id || outcome.outcomeId || outcome.outcome_id),
      odds: outcome && (outcome.odds || outcome.oddsDecimal || outcome.oddsValue) || s.odds || 2,
      raw: s,
    }
  }).filter(s => s.eventId && s.outcomeId)

  if (norm.length === 0) {
    console.error('No valid selections found in booking code data. Aborting.')
    process.exit(1)
  }

  console.log('Original selections:', JSON.stringify(norm, null, 2))

  const optimized = optimizeSelections(norm)

  console.log('Optimized selections:', JSON.stringify(optimized, null, 2))

  const payload = { selections: optimized.map(s => ({ eventId: s.eventId, marketId: s.marketId || '', outcomeId: s.outcomeId, specifier: s.specifier || '' })), device: 'web', source: 'betslip' }

  console.log('Submitting optimized payload to SportyBet...')
  try {
    const result = await page.evaluate(async (payload) => {
      const resp = await fetch('/api/ng/orders/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      })
      const json = await resp.json()
      return { status: resp.status, body: json }
    }, payload)

    console.log('Response status:', result.status)
    console.log('Response body:', JSON.stringify(result.body, null, 2))

    if (result.body && result.body.data && result.body.data.shareCode) {
      console.log('\nShare code:', result.body.data.shareCode)
    } else {
      console.warn('SportyBet did not return a shareCode. Inspect the response above for details.')
    }
  } catch (err) {
    console.error('Request failed:', err)
  }

  console.log('Done. The browser remains open for inspection; close it when finished.')
})()
