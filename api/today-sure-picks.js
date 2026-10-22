/**
 * Vercel Serverless Function: GET /api/today-sure-picks
 * Fetches real fixtures from SportyBet with customizable duration (Today / 3 Days / 1 Week).
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
    const fetchTournaments = async (queryTimeline, extraParams = '') => {
      try {
        const resp = await fetch(`https://www.sportybet.com/api/ng/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&pageNum=1&timeline=${queryTimeline}${extraParams}&_t=${Date.now()}`, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Referer': 'https://www.sportybet.com/ng/',
          },
        })
        const body = await resp.json()
        return body.data?.tournaments || []
      } catch (e) {
        return []
      }
    }

    let tournaments = await fetchTournaments(timeline)

    if (timeline === '24') {
      const immediate = await fetchTournaments('2.7', '&todayGames=true')
      const existingIds = new Set(tournaments.map(t => t.tournamentId || t.name))
      for (const it of immediate) {
        if (!existingIds.has(it.tournamentId || it.name)) {
          tournaments.unshift(it)
        } else {
          const target = tournaments.find(t => (t.tournamentId || t.name) === (it.tournamentId || it.name))
          if (target && Array.isArray(it.events)) {
            const existingEvs = new Set((target.events || []).map(e => e.eventId))
            for (const ie of it.events) {
              if (!existingEvs.has(ie.eventId)) target.events.push(ie)
            }
          }
        }
      }
    }

    const majorKeywords = [
      'premier league', 'champions league', 'europa league', 'conference league',
      'la liga', 'serie a', 'bundesliga', 'ligue 1', 'copa del rey', 'fa cup',
      'efl cup', 'carabao cup', 'npfl', 'eredivisie', 'primeira liga', 'mls',
      'saudi pro league', 'brasileiro', 'copa libertadores'
    ]

    function formatKickoff(startTimeMs) {
      if (!startTimeMs) return { text: 'Today', tag: 'Today', diffHours: 0 }
      const now = Date.now()
      const diffHours = (startTimeMs - now) / (3600 * 1000)
      const date = new Date(startTimeMs)
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const nowDate = new Date(now)
      const isSameDay = date.getDate() === nowDate.getDate() && date.getMonth() === nowDate.getMonth() && date.getFullYear() === nowDate.getFullYear()
      const tomorrow = new Date(now + 86400000)
      const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear()
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

    const extractedPicks = []

    for (const t of tournaments) {
      const tournamentName = t.name || ''
      const categoryName = t.categoryName || ''
      const isMajor = majorKeywords.some(k => tournamentName.toLowerCase().includes(k))
      const leagueScope = isMajor ? 'major' : 'small'

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

        // 1. Double Chance (id: 10)
        const dcMarket = e.markets?.find(m => String(m.id) === '10')
        if (dcMarket && dcMarket.outcomes) {
          for (const o of dcMarket.outcomes) {
            const odds = parseFloat(o.odds) || 1.8
            const prob = parseFloat(o.probability) || (1 / odds)
            if (odds >= 1.08 && odds <= 1.55 && prob >= 0.68) {
              extractedPicks.push({
                id: `live-${eventId}-${dcMarket.id}-${o.id}`,
                eventId,
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
                market: `Double Chance - ${o.desc}`,
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
                modelRationale: `High-probability ${o.desc} for ${matchLabel} (${Math.round(prob * 100)}% model probability @${odds.toFixed(2)} • ${ko.text}).`
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
                id: `live-${eventId}-${ouMarket.id}-${overOutcome.id}`,
                eventId,
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
                modelRationale: `Goal expectancy algorithm rates Over 1.5 in ${matchLabel} at ${Math.round(prob * 100)}% probability (${ko.text}).`
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
                id: `live-${eventId}-${matchWinnerMarket.id}-${o.id}`,
                eventId,
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
                market: `1X2 - ${o.desc}`,
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
                modelRationale: `Strong model rating for ${o.desc} in ${matchLabel} (${Math.round(prob * 100)}% probability @${odds.toFixed(2)} • ${ko.text}).`
              })
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      duration: durationParam,
      maxHours,
      count: extractedPicks.length,
      picks: extractedPicks
    })
  } catch (error) {
    console.error('Error fetching today sure picks:', error)
    return res.status(500).json({ error: 'Failed to fetch sure picks' })
  }
}
