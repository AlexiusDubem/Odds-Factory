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

  const { duration = 'today' } = req.query || {}
  const durationParam = String(duration).toLowerCase()

  let timeline = '24'
  let maxHours = 24
  if (durationParam === '3days' || durationParam === '72h' || durationParam === '72' || durationParam === '3d') {
    timeline = '72'
    maxHours = 72
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
      'fa cup', 'efl cup', 'carabao cup'
    ]

    const secondaryKeywords = [
      'npfl', 'championship', 'eredivisie', 'primeira liga', 'mls', 'saudi pro league',
      'brasileiro', 'copa libertadores', 'super lig', 'pro league', 'a-league',
      'super league', 'league one', 'league two', 'segunda'
    ]

    const discoveredCompetitions = []
    const seenTournIds = new Set()

    for (const t of tournaments) {
      const tournId = t.tournamentId || `tourn-${t.name}`
      if (seenTournIds.has(tournId)) continue
      seenTournIds.add(tournId)

      const name = t.name || 'Unknown Tournament'
      const categoryName = t.categoryName || 'International'
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
      const tournId = t.tournamentId || `tourn-${tournamentName}`
      const lowerT = tournamentName.toLowerCase()

      const isMajor = majorKeywords.some((k) => lowerT.includes(k))
      const leagueScope = isMajor ? 'major' : secondaryKeywords.some((k) => lowerT.includes(k)) ? 'small' : 'other'

      for (const e of (t.events || [])) {
        const home = e.homeTeamName || ''
        const away = e.awayTeamName || ''
        const matchLabel = `${home} vs ${away}`
        const eventId = e.eventId

        const now = Date.now()
        const diffHours = e.estimateStartTime ? (e.estimateStartTime - now) / (3600 * 1000) : 0

        // Strict limit: must not be past maxHours or past 7 days (168 hours)
        if (e.estimateStartTime && (diffHours < -2 || diffHours > maxHours || diffHours > 168)) {
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
            modelRationale: `${marketName} for ${matchLabel} — model probability ${Math.round(prob * 100)}% @${odds.toFixed(2)} (${ko.text}).`,
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
            // Allow high-cushion safety lines (Under 3.5, Under 4.5, Under 5.5) with high confidence (>=75%)
            const isUnderMarket = oDesc.toLowerCase().includes('under') || mDesc.toLowerCase().includes('under')
            if (isUnderMarket) {
              const fullDesc = `${mDesc} ${oDesc} ${specifier}`.toLowerCase()
              const isRiskyTightUnder = fullDesc.includes('0.5') || fullDesc.includes('1.5') || fullDesc.includes('2.5')
              if (isRiskyTightUnder || prob < 0.75) {
                continue
              }
            }

            // ── Normalization & Tier Classification ──────────────────────────
            let riskTier = 3
            if (prob >= 0.75 && odds <= 1.30) {
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

            const formattedPickLabel = `${mDesc} — ${oDesc}`
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
      picks: extractedPicks,
    })
  } catch (error) {
    console.error('Error fetching today sure picks:', error)
    return res.status(500).json({ error: 'Failed to fetch sure picks' })
  }
}
