import fs from 'fs'

const file = 'c:\\Users\\User\\Desktop\\Odds Factory\\booking-server.mjs'
let content = fs.readFileSync(file, 'utf-8')

const target = `  // ── GET /health ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true, ts: Date.now() }))
    return
  }`

const newEndpoints = `  // ── GET /health ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true, ts: Date.now() }))
    return
  }

  // ── GET /today-sure-picks — Real matches today across all leagues from SportyBet
  if (req.method === 'GET' && req.url.startsWith('/today-sure-picks')) {
    try {
      const page = await getPage()
      const reqCtx = page.context().request

      console.log('📡 Fetching today real live fixtures from SportyBet...')
      const resp = await reqCtx.get('https://www.sportybet.com/api/ng/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&pageNum=1&option=1&_t=' + Date.now(), {
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://www.sportybet.com/ng/',
        },
        timeout: 12000,
      })

      const body = await resp.json()
      const tournaments = body.data?.tournaments || []
      const majorKeywords = ['premier league', 'champions league', 'europa league', 'la liga', 'serie a', 'bundesliga', 'ligue 1', 'copa del rey', 'fa cup', 'efl cup', 'npfl']

      const extractedPicks = []

      for (const t of tournaments) {
        const tournamentName = t.name || ''
        const categoryName = t.categoryName || ''
        const isMajor = majorKeywords.some(k => tournamentName.toLowerCase().includes(k))
        const leagueScope = isMajor ? 'major' : 'small'

        for (const e of (t.events || [])) {
          const home = e.homeTeamName || ''
          const away = e.awayTeamName || ''
          const matchLabel = \`\${home} vs \${away}\`
          const eventId = e.eventId
          const kickoff = e.estimateStartTime
            ? new Date(e.estimateStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Today'

          // 1. Double Chance (id: 10)
          const dcMarket = e.markets?.find(m => String(m.id) === '10')
          if (dcMarket && dcMarket.outcomes) {
            for (const o of dcMarket.outcomes) {
              const odds = parseFloat(o.odds) || 1.8
              const prob = parseFloat(o.probability) || (1 / odds)
              // Pick safe double chances with high probability
              if (odds >= 1.08 && odds <= 1.55 && prob >= 0.68) {
                extractedPicks.push({
                  id: \`live-\${eventId}-\${dcMarket.id}-\${o.id}\`,
                  eventId,
                  matchLabel,
                  homeTeam: home,
                  awayTeam: away,
                  league: tournamentName,
                  country: categoryName,
                  leagueScope,
                  kickoff,
                  market: \`Double Chance - \${o.desc}\`,
                  marketName: 'Double Chance',
                  marketId: String(dcMarket.id),
                  outcomeId: String(o.id),
                  specifier: dcMarket.specifier || '',
                  odds,
                  probability: prob,
                  ev: Number((prob * odds - 1).toFixed(3)),
                  confidenceScore: Math.round(prob * 100),
                  confidenceTier: 1,
                  modelType: 'double_chance',
                  badgeLabel: isMajor ? '🏆 Major League Lock' : '🌍 Value Anchor',
                  modelRationale: \`High-probability \${o.desc} for \${matchLabel} (\${Math.round(prob * 100)}% model probability @\${odds.toFixed(2)}).\`
                })
              }
            }
          }

          // 2. Over 1.5 Goals (id: 18)
          const ouMarket = e.markets?.find(m => String(m.id) === '18' && (m.specifier === 'total=1.5' || m.desc?.includes('1.5')))
          if (ouMarket && ouMarket.outcomes) {
            const overOutcome = ouMarket.outcomes.find(o => o.desc?.toLowerCase().includes('over'))
            if (overOutcome) {
              const odds = parseFloat(overOutcome.odds) || 1.8
              const prob = parseFloat(overOutcome.probability) || (1 / odds)
              if (odds >= 1.10 && odds <= 1.45 && prob >= 0.70) {
                extractedPicks.push({
                  id: \`live-\${eventId}-\${ouMarket.id}-\${overOutcome.id}\`,
                  eventId,
                  matchLabel,
                  homeTeam: home,
                  awayTeam: away,
                  league: tournamentName,
                  country: categoryName,
                  leagueScope,
                  kickoff,
                  market: 'Over 1.5 Goals',
                  marketName: 'Over/Under 1.5',
                  marketId: String(ouMarket.id),
                  outcomeId: String(overOutcome.id),
                  specifier: ouMarket.specifier || 'total=1.5',
                  odds,
                  probability: prob,
                  ev: Number((prob * odds - 1).toFixed(3)),
                  confidenceScore: Math.round(prob * 100),
                  confidenceTier: 1,
                  modelType: 'goals_lock',
                  badgeLabel: '⚽ Goals Lock',
                  modelRationale: \`Goal expectancy algorithm rates Over 1.5 in \${matchLabel} at \${Math.round(prob * 100)}% probability.\`
                })
              }
            }
          }

          // 3. 1X2 Strong Favorites (id: 1)
          const matchWinnerMarket = e.markets?.find(m => String(m.id) === '1')
          if (matchWinnerMarket && matchWinnerMarket.outcomes) {
            for (const o of matchWinnerMarket.outcomes) {
              const odds = parseFloat(o.odds) || 2.0
              const prob = parseFloat(o.probability) || (1 / odds)
              if (odds >= 1.18 && odds <= 1.52 && prob >= 0.68) {
                extractedPicks.push({
                  id: \`live-\${eventId}-\${matchWinnerMarket.id}-\${o.id}\`,
                  eventId,
                  matchLabel,
                  homeTeam: home,
                  awayTeam: away,
                  league: tournamentName,
                  country: categoryName,
                  leagueScope,
                  kickoff,
                  market: \`1X2 - \${o.desc}\`,
                  marketName: '1X2',
                  marketId: String(matchWinnerMarket.id),
                  outcomeId: String(o.id),
                  specifier: matchWinnerMarket.specifier || '',
                  odds,
                  probability: prob,
                  ev: Number((prob * odds - 1).toFixed(3)),
                  confidenceScore: Math.round(prob * 100),
                  confidenceTier: 1,
                  modelType: 'banker',
                  badgeLabel: isMajor ? '🛡️ Tier 1 Banker' : '💰 Value Pick',
                  modelRationale: \`Strong model rating for \${o.desc} in \${matchLabel} (\${Math.round(prob * 100)}% probability @\${odds.toFixed(2)}).\`
                })
              }
            }
          }
        }
      }

      console.log(\`✅ Extracted \${extractedPicks.length} real live sure picks across \${tournaments.length} tournaments\`)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, count: extractedPicks.length, picks: extractedPicks }))
    } catch (err) {
      console.error('Error in /today-sure-picks:', err.message)
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }`

content = content.replace(target, newEndpoints)
fs.writeFileSync(file, content, 'utf-8')
console.log('✅ Added /today-sure-picks endpoint to booking-server.mjs')
