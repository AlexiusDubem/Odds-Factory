/**
 * Vercel Serverless Function: GET /api/today-sure-picks
 * 
 * Dynamic Competition Engine & Full Market Discovery Engine
 * - Automatically discovers live SportyBet tournaments, IDs, categories, and counts.
 * - Extracts and normalizes the full range of markets (Match Result, Goals, BTTS, Corners,
 *   Bookings, Handicaps, Halves, Clean Sheets, Intervals, 1X2 - 2UP).
 * - Preserves authentic SportyBet booking parameters: eventId, marketId, outcomeId, specifier.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { duration = 'today', competitions = '' } = req.query || {}
  const durationParam = String(duration).toLowerCase()

  let timeline = '24'
  let maxHours = 24
  if (durationParam === 'tomorrow') {
    timeline = '48'
    maxHours = 48
  } else if (durationParam === 'today_tomorrow' || durationParam === '2days' || durationParam === '48h') {
    timeline = '48'
    maxHours = 48
  } else if (durationParam === '3days' || durationParam === '72h' || durationParam === '72' || durationParam === '3d') {
    timeline = '72'
    maxHours = 72
  } else if (durationParam === 'weekend') {
    timeline = '120'
    maxHours = 120
  } else if (durationParam === '1week' || durationParam === '168h' || durationParam === '168' || durationParam === 'week' || durationParam === '7d') {
    timeline = '168'
    maxHours = 168
  }

  try {
    // Validated active market IDs from SportyBet's football feed
    const ACTIVE_MARKET_IDS = [
      1, 10, 11, 14, 15, 16, 18, 20, 21, 26, 28, 29, 30, 31, 36,
      60, 63, 100, 101, 150, 160, 165, 166, 169, 170, 171, 172, 175, 180, 60100
    ].join('%2C')

    const fetchTournaments = async (queryTimeline, extraParams = '') => {
      try {
        const resp = await fetch(
          `https://www.sportybet.com/api/ng/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=${ACTIVE_MARKET_IDS}&pageSize=100&pageNum=1&timeline=${queryTimeline}${extraParams}&_t=${Date.now()}`,
          {
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              'Referer': 'https://www.sportybet.com/ng/',
            },
          }
        )
        const body = await resp.json()
        return body.data?.tournaments || []
      } catch (e) {
        return []
      }
    }

    let tournaments = await fetchTournaments(timeline)

    if (timeline === '24') {
      const immediate = await fetchTournaments('2.7', '&todayGames=true')
      const existingIds = new Set(tournaments.map((t) => t.tournamentId || t.name))
      for (const it of immediate) {
        if (!existingIds.has(it.tournamentId || it.name)) {
          tournaments.unshift(it)
        } else {
          const target = tournaments.find((t) => (t.tournamentId || t.name) === (it.tournamentId || it.name))
          if (target && Array.isArray(it.events)) {
            const existingEvs = new Set((target.events || []).map((e) => e.eventId))
            for (const ie of it.events) {
              if (!existingEvs.has(ie.eventId)) target.events.push(ie)
            }
          }
        }
      }
    }

    // ── 1. Dynamic Competition Discovery & Classification ───────────────────
    const majorKeywords = [
      'premier league', 'champions league', 'europa league', 'conference league',
      'la liga', 'laliga', 'serie a', 'bundesliga', 'ligue 1', 'copa del rey',
      'fa cup', 'efl cup', 'carabao cup', 'dfb pokal', 'coppa italia', 'coupe de france',
      'supercopa', 'super cup', 'world cup', 'euro', 'nations league'
    ]

    const secondaryKeywords = [
      'championship', 'segunda', 'serie b', '2. bundesliga', 'ligue 2',
      'eredivisie', 'primeira liga', 'pro league', 'super lig', 'premiership',
      'super league', 'league one', 'league two', 'mls', 'saudi pro league',
      'brasileiro', 'copa libertadores', 'copa sudamericana', 'npfl', 'a-league',
      'ekstraklasa', 'veikkausliiga', 'allsvenskan', 'eliteserien', 'superliga',
      'liga 1', 'primera a', 'liga profesional', 'j1 league', 'k league 1'
    ]

    const isAmateurOrRubbishLeague = (text) => {
      if (!text) return false
      const lower = String(text).toLowerCase()
      return (
        // English non-league / youth reserves
        lower.includes('northern premier') ||
        lower.includes('southern league') ||
        lower.includes('southern premier') ||
        lower.includes('isthmian') ||
        lower.includes('challenge cup') ||
        lower.includes('efl trophy') ||
        lower.includes('premier league 2') ||
        lower.includes('development league') ||
        lower.includes('u21') ||
        lower.includes('u23') ||
        lower.includes('u19') ||
        lower.includes('u20') ||
        lower.includes('youth') ||
        lower.includes('reserves') ||
        lower.includes('b team') ||
        // Low European tiers & amateur
        lower.includes('alef') ||
        lower.includes('liga bet') ||
        lower.includes('liga gimel') ||
        lower.includes('tercera') ||
        lower.includes('preferente') ||
        lower.includes('autonomica') ||
        lower.includes('division de honor') ||
        (lower.includes('rfef') && (lower.includes('segunda') || lower.includes('tercera'))) ||
        lower.includes('oberliga') ||
        lower.includes('regionalliga') ||
        lower.includes('landesliga') ||
        lower.includes('verbandsliga') ||
        lower.includes('serie d') ||
        lower.includes('eccellenza') ||
        lower.includes('promozione') ||
        lower.includes('national 2') ||
        lower.includes('national 3') ||
        lower.includes('regional 1') ||
        lower.includes('ligue 3') ||
        lower.includes('derde divisie') ||
        lower.includes('vierde divisie') ||
        // Simulated / Virtual / Esports
        lower.includes('srl') ||
        lower.includes('simulated') ||
        lower.includes('virtual') ||
        lower.includes('electronic') ||
        lower.includes('efootball') ||
        lower.includes('cyber') ||
        lower.includes('esport') ||
        lower.includes('fifa') ||
        lower.includes('pes ') ||
        lower.includes('amateur') ||
        lower.includes('regional cup')
      )
    }

    // ── Competition Priority Scoring (Elite Champions League & Major First) ───
    const getTournamentPriority = (name = '', cat = '') => {
      const lower = `${name} ${cat}`.toLowerCase()
      if (lower.includes('champions league') || lower.includes('ucl')) return 1000
      if (lower.includes('europa league')) return 920
      if (lower.includes('conference league')) return 880
      if (lower.includes('premier league') && !lower.includes('northern') && !lower.includes('southern')) return 850
      if (lower.includes('la liga') || lower.includes('laliga')) return 820
      if (lower.includes('serie a')) return 800
      if (lower.includes('bundesliga') && !lower.includes('2.')) return 800
      if (lower.includes('ligue 1')) return 780
      if (lower.includes('championship')) return 720
      if (lower.includes('copa del rey') || lower.includes('fa cup') || lower.includes('dfb pokal') || lower.includes('coppa italia')) return 680
      if (lower.includes('eredivisie') || lower.includes('primeira liga')) return 650
      if (lower.includes('copa libertadores') || lower.includes('copa sudamericana')) return 620
      if (lower.includes('saudi pro') || lower.includes('mls') || lower.includes('brasileiro')) return 550
      return 100
    }

    // Sort tournaments strictly by Elite Tier Priority so UCL/EPL are ALWAYS first!
    tournaments.sort((a, b) => {
      const pA = getTournamentPriority(a.name, a.categoryName)
      const pB = getTournamentPriority(b.name, b.categoryName)
      return pB - pA
    })

    const discoveredCompetitions = []
    const seenTournIds = new Set()

    for (const t of tournaments) {
      const name = t.name || 'Unknown Tournament'
      const categoryName = t.categoryName || 'International'
      if (isAmateurOrRubbishLeague(name) || isAmateurOrRubbishLeague(categoryName)) continue

      const tournId = t.tournamentId || `tourn-${t.name}`
      if (seenTournIds.has(tournId)) continue
      seenTournIds.add(tournId)

      const lowerName = name.toLowerCase()

      let tier = 'other'
      if (majorKeywords.some((k) => lowerName.includes(k))) {
        tier = 'major'
      } else if (secondaryKeywords.some((k) => lowerName.includes(k))) {
        tier = 'secondary'
      }

      discoveredCompetitions.push({
        id: tournId,
        name,
        categoryName,
        eventCount: (t.events || []).length,
        tier,
      })
    }

    // ── Helper: Format Kickoff ───────────────────────────────────────────────
    function formatKickoff(startTimeMs) {
      if (!startTimeMs) return { text: 'Today', tag: 'Today', diffHours: 0 }
      const now = Date.now()
      const diffHours = (startTimeMs - now) / (3600 * 1000)
      const date = new Date(startTimeMs)
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const nowDate = new Date(now)
      const isSameDay =
        date.getDate() === nowDate.getDate() &&
        date.getMonth() === nowDate.getMonth() &&
        date.getFullYear() === nowDate.getFullYear()
      const tomorrow = new Date(now + 86400000)
      const isTomorrow =
        date.getDate() === tomorrow.getDate() &&
        date.getMonth() === tomorrow.getMonth() &&
        date.getFullYear() === tomorrow.getFullYear()
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
      const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      let text = ''
      let tag = ''
      if (isSameDay || diffHours <= 12) {
        text = `Today, ${timeStr}`
        tag = 'Today'
      } else if (isTomorrow || (diffHours > 12 && diffHours <= 36)) {
        text = `Tomorrow (${weekday}), ${timeStr}`
        tag = 'Tomorrow'
      } else {
        text = `${weekday}, ${monthDay} • ${timeStr}`
        tag = weekday
      }
      return { text, tag, diffHours: Math.round(diffHours * 10) / 10 }
    }


    // ── Helper: Human Football Pundit Rationale Generator ────────────────────
    function buildPunterRationale(marketName, outcomeDesc, home, away, league, odds) {
      const mLower = marketName.toLowerCase()
      const oLower = outcomeDesc.toLowerCase()

      if (mLower.includes('2-up') || mLower.includes('2up') || mLower.includes('60100')) {
        const favored = oLower.includes('1') || oLower.includes('home') ? home : away
        return `${favored} carries superior attacking momentum; backed with SportyBet 2UP early payout for an instant auto-win if they go 2 goals ahead.`
      }
      if (mLower.includes('double chance') || oLower.includes('1x') || oLower.includes('x2')) {
        const team = oLower.includes('1x') ? home : oLower.includes('x2') ? away : home
        return `${team} holds structural tactical dominance and solid defensive organization; Double Chance guarantees supreme insurance against a stalemate.`
      }
      if (oLower.includes('over 1.5') || (mLower.includes('over/under') && oLower.includes('over') && oLower.includes('1.5'))) {
        return `Both ${home} and ${away} display positive transitional play with regular goal creation; Over 1.5 is an elite accumulator foundation.`
      }
      if (oLower.includes('over 2.5') || (mLower.includes('over/under') && oLower.includes('over') && oLower.includes('2.5'))) {
        return `High-octane attacking profiles: clinical frontlines meeting vulnerable transition defenses point toward a high-scoring encounter.`
      }
      if (mLower.includes('both teams to score') || mLower.includes('gg') || mLower.includes('btts')) {
        return `Both sides feature productive goal-scorers alongside consistent lapses on set-piece defense; BTTS carries high probability.`
      }
      if (mLower.includes('corner')) {
        return `Flank-dominated tactical attack against a deep defensive block; heavy final-third delivery favors sustained corner volume.`
      }
      if (mLower.includes('1x2') || mLower.includes('match result')) {
        const favored = oLower.includes('1') || oLower.includes('home') ? home : oLower.includes('2') || oLower.includes('away') ? away : home
        return `${favored} boasts decisive squad quality, key tactical matchups, and current form to secure maximum points.`
      }
      return `${home} vs ${away} in ${league}: Recent form and tactical balance strongly validate ${outcomeDesc} @${odds.toFixed(2)}.`
    }
    // ── Helper: Map SportyBet Market IDs to Market Family ────────────────────
    function getMarketFamily(marketId, desc = '') {
      const idNum = parseInt(marketId, 10)
      const d = desc.toLowerCase()

      if (idNum === 1 || idNum === 60100 || idNum === 10 || idNum === 11 || idNum === 2 || idNum === 15) {
        return 'match_result'
      }
      if (idNum === 29) {
        return 'btts'
      }
      if (idNum === 14 || idNum === 16 || idNum === 65) {
        return 'handicap'
      }
      if (idNum === 166 || idNum === 165 || idNum === 169 || idNum === 170 || idNum === 171 || idNum === 172 || idNum === 175 || idNum === 180 || d.includes('corner')) {
        return 'corners'
      }
      if (idNum === 150 || idNum === 160 || d.includes('booking') || d.includes('card') || d.includes('sending off')) {
        return 'cards_bookings'
      }
      if (idNum === 31 || d.includes('clean sheet')) {
        return 'cleansheet'
      }
      if (idNum === 60 || idNum === 63 || idNum === 100 || idNum === 101 || d.includes('1st half') || d.includes('interval')) {
        return 'intervals_halves'
      }
      if (idNum === 18 || idNum === 36 || idNum === 20 || idNum === 21 || idNum === 26 || idNum === 28 || idNum === 30 || d.includes('over') || d.includes('under') || d.includes('goal')) {
        return 'goals'
      }
      return 'match_result'
    }

    const extractedPicks = []

    for (const t of tournaments) {
      const tournamentName = t.name || ''
      const categoryName = t.categoryName || ''
      if (isAmateurOrRubbishLeague(tournamentName) || isAmateurOrRubbishLeague(categoryName)) continue

      const tournId = t.tournamentId || `tourn-${tournamentName}`
      const lowerT = tournamentName.toLowerCase()

      const isMajor = majorKeywords.some((k) => lowerT.includes(k))
      const leagueScope = isMajor ? 'major' : secondaryKeywords.some((k) => lowerT.includes(k)) ? 'small' : 'other'

      // Only allow professional competitions (major or secondary)
      if (leagueScope === 'other' && !secondaryKeywords.some((k) => lowerT.includes(k)) && !majorKeywords.some((k) => lowerT.includes(k))) {
        const lowerCat = categoryName.toLowerCase()
        if (!lowerCat.includes('international') && !lowerCat.includes('world') && !lowerCat.includes('europe') && !lowerT.includes('cup')) {
          continue
        }
      }

      for (const e of (t.events || [])) {
        const home = e.homeTeamName || ''
        const away = e.awayTeamName || ''
        const matchLabel = `${home} vs ${away}`
        if (isAmateurOrRubbishLeague(home) || isAmateurOrRubbishLeague(away) || isAmateurOrRubbishLeague(matchLabel)) continue
        const eventId = e.eventId

        const now = Date.now()
        // Strict limit: match must be upcoming (at least 5 mins ahead), within maxHours, and not in the past
        if (e.estimateStartTime) {
          if (e.estimateStartTime <= now + (5 * 60 * 1000)) continue
          const diffHours = (e.estimateStartTime - now) / (3600 * 1000)
          if (diffHours < 0.08 || diffHours > maxHours) continue

          if (durationParam === 'tomorrow') {
            const matchDate = new Date(e.estimateStartTime)
            const tomorrowDate = new Date(now + 86400000)
            const isTomorrow =
              matchDate.getDate() === tomorrowDate.getDate() &&
              matchDate.getMonth() === tomorrowDate.getMonth() &&
              matchDate.getFullYear() === tomorrowDate.getFullYear()
            if (!isTomorrow && diffHours < 12) continue
          }
        }

        // Skip in-play or ended events
        if (e.status === 'Live' || e.status === 'Ended' || e.matchStatus === 'Live' || e.matchStatus === 'Ended') {
          continue
        }

        const ko = formatKickoff(e.estimateStartTime)

        // Helper to push a normalized pick
        const pushPick = (
          market,
          marketName,
          marketFamily,
          marketId,
          outcomeId,
          specifier,
          odds,
          prob,
          modelType,
          badgeLabel,
          riskTier
        ) => {
          extractedPicks.push({
            id: `live-${eventId}-${marketId}-${outcomeId}-${specifier || '0'}`,
            eventId,
            tournamentId: tournId,
            matchLabel,
            homeTeam: home,
            awayTeam: away,
            league: tournamentName,
            country: categoryName,
            leagueScope,
            kickoff: ko.text,
            kickoffTag: ko.tag,
            estimateStartTime: e.estimateStartTime || null,
            hoursFromNow: ko.diffHours,
            market,
            marketName,
            marketFamily,
            marketId: String(marketId),
            outcomeId: String(outcomeId),
            specifier: specifier || '',
            odds: Number(odds.toFixed(2)),
            probability: Number(prob.toFixed(2)),
            ev: Number((prob * odds - 1).toFixed(3)),
            confidenceScore: Math.round(prob * 100),
            confidenceTier: riskTier, // 1=banker, 2=value, 3=audacious
            modelType,
            badgeLabel,
            modelRationale: buildPunterRationale(marketName, market, home, away, tournamentName, odds),
          })
        }

        // Dynamically parse all markets returned for this match
        for (const m of (e.markets || [])) {
          const mId = String(m.id)
          const mDesc = m.desc || ''
          const specifier = m.specifier || ''
          const family = getMarketFamily(mId, mDesc)

          for (const o of (m.outcomes || [])) {
            const odds = parseFloat(o.odds)
            if (!odds || isNaN(odds) || odds < 1.05 || odds > 2.50) continue

            const prob = parseFloat(o.probability) || 1 / odds
            const oDesc = o.desc || ''

            // Filter out stressful/excessive Under markets (Under 0.5, 1.5, 2.5) that bust accumulators
            // Also drop micro-odds Unders below 1.22 that act as accumulator filler traps
            const isUnderMarket = oDesc.toLowerCase().includes('under') || mDesc.toLowerCase().includes('under')
            if (isUnderMarket) {
              const fullDesc = `${mDesc} ${oDesc} ${specifier}`.toLowerCase()
              const isRiskyTightUnder = fullDesc.includes('0.5') || fullDesc.includes('1.5') || fullDesc.includes('2.5')
              if (isRiskyTightUnder || prob < 0.70 || odds < 1.22) {
                continue
              }
            }

            // Strictly exclude obscure handicaps, cleansheets, and booking traps
            if (family === 'handicap' || family === 'cleansheet' || family === 'cards_bookings' || family === 'intervals_halves') {
              continue
            }

            // ── Normalization & Tier Classification ──────────────────────────
            let riskTier = 3
            if (mId === '1' && String(o.id) === '3' && odds < 1.70) {
              riskTier = 3;
            }
            if (prob >= 0.75 && odds <= 1.30 && !(mId === '1' && String(o.id) === '3')) {
              riskTier = 1 // Ultra Safe / Banker
            } else if (prob >= 0.60 && odds <= 1.65) {
              riskTier = 2 // Safe / Value
            } else if (prob >= 0.48 && odds <= 2.10) {
              riskTier = 3 // Daring / High Return
            } else {
              continue // Filter out lottery longshots to maintain sure-pick quality
            }

            // Assign model type and badge label based on family
            let modelType = 'banker'
            let badgeLabel = 'Tier 1 Banker'

            switch (family) {
              case 'match_result':
                if (mId === '10') {
                  modelType = 'double_chance'
                  badgeLabel = riskTier === 1 ? 'Double Chance Lock' : 'Value DC'
                } else if (mId === '11') {
                  modelType = 'banker'
                  badgeLabel = 'Draw No Bet'
                } else if (mId === '60100') {
                  modelType = 'banker'
                  badgeLabel = '1X2 (2-Up Payout)'
                } else {
                  modelType = riskTier === 1 ? 'banker' : 'value_play'
                  badgeLabel = riskTier === 1 ? 'Strong Favorite' : 'Match Winner'
                }
                break

              case 'goals':
                modelType = 'goals_lock'
                badgeLabel = riskTier === 1 ? 'Goals Lock' : 'Over/Under'
                break

              case 'btts':
                modelType = 'btts'
                badgeLabel = 'BTTS Signal'
                break

              case 'corners':
                modelType = 'corner_lock'
                badgeLabel = 'Corners Line'
                break

              case 'cards_bookings':
                modelType = 'booking_lock'
                badgeLabel = 'Card / Booking'
                break

              case 'handicap':
                modelType = 'handicap_play'
                badgeLabel = 'Handicap Line'
                break

              case 'intervals_halves':
                modelType = 'interval_lock'
                badgeLabel = 'Half / Interval'
                break

              case 'cleansheet':
                modelType = 'banker'
                badgeLabel = 'Clean Sheet'
                break

              default:
                modelType = 'value_play'
                badgeLabel = 'Market Play'
            }

            let cleanOutcome = (oDesc || '').trim()
            if (cleanOutcome.toLowerCase().startsWith(mDesc.toLowerCase())) {
              cleanOutcome = cleanOutcome.slice(mDesc.length).replace(/^[\s—\-:]+/, '').trim()
            }
            const formattedPickLabel = cleanOutcome ? `${mDesc} — ${cleanOutcome}` : mDesc
            pushPick(
              formattedPickLabel,
              mDesc,
              family,
              mId,
              o.id,
              specifier,
              odds,
              prob,
              modelType,
              badgeLabel,
              riskTier
            )
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      duration: durationParam,
      maxHours,
      count: extractedPicks.length,
      competitionsCount: discoveredCompetitions.length,
      competitions: discoveredCompetitions,
      fetchedAt: new Date().toISOString(),
      picks: extractedPicks,
    })
  } catch (error) {
    console.error('Error fetching today sure picks:', error)
    return res.status(500).json({ error: 'Failed to fetch sure picks' })
  }
}
