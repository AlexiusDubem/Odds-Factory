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

        // Helper to push a pick
        const pushPick = (market, marketName, marketId, outcomeId, specifier, odds, prob, modelType, badgeLabel, riskTier) => {
          extractedPicks.push({
            id: `live-${eventId}-${marketId}-${outcomeId}`,
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
            market,
            marketName,
            marketId: String(marketId),
            outcomeId: String(outcomeId),
            specifier: specifier || '',
            odds,
            probability: prob,
            ev: Number((prob * odds - 1).toFixed(3)),
            confidenceScore: Math.round(prob * 100),
            confidenceTier: riskTier,   // 1=safe, 2=medium, 3=high risk
            modelType,
            badgeLabel,
            modelRationale: `${marketName} for ${matchLabel} — model probability ${Math.round(prob * 100)}% @${odds.toFixed(2)} odds (${ko.text}).`
          })
        }

        // ── 1. Double Chance (id: 10) ──
        const dcMarket = e.markets?.find(m => String(m.id) === '10')
        if (dcMarket && dcMarket.outcomes) {
          for (const o of dcMarket.outcomes) {
            const odds = parseFloat(o.odds) || 1.8
            const prob = parseFloat(o.probability) || (1 / odds)
            if (odds >= 1.08 && odds <= 1.30 && prob >= 0.75) {
              pushPick(`Double Chance - ${o.desc}`, 'Double Chance', dcMarket.id, o.id, dcMarket.specifier, odds, prob, 'double_chance', isMajor ? '🏆 Super Safe' : '🌍 Safe Anchor', 1)
            } else if (odds > 1.30 && odds <= 1.55 && prob >= 0.64) {
              pushPick(`Double Chance - ${o.desc}`, 'Double Chance', dcMarket.id, o.id, dcMarket.specifier, odds, prob, 'double_chance', isMajor ? '🏆 Major Lock' : '🌍 Value Anchor', 2)
            } else if (odds > 1.55 && odds <= 1.75 && prob >= 0.55) {
              pushPick(`Double Chance - ${o.desc}`, 'Double Chance', dcMarket.id, o.id, dcMarket.specifier, odds, prob, 'double_chance', '⚡ Bold Pick', 3)
            }
          }
        }

        // ── 2. Over 1.5 Goals (id: 18) ──
        const ou15Market = e.markets?.find(m => String(m.id) === '18' && (m.specifier === 'total=1.5' || m.desc?.includes('1.5')))
        if (ou15Market && ou15Market.outcomes) {
          const overO = ou15Market.outcomes.find(o => o.desc?.toLowerCase().includes('over'))
          if (overO) {
            const odds = parseFloat(overO.odds) || 1.8
            const prob = parseFloat(overO.probability) || (1 / odds)
            if (odds >= 1.08 && odds <= 1.25 && prob >= 0.78) {
              pushPick('Over 1.5 Goals', 'Over/Under 1.5', ou15Market.id, overO.id, 'total=1.5', odds, prob, 'goals_lock', '⚽ Goals Lock (Ultra-Safe)', 1)
            } else if (odds > 1.25 && odds <= 1.50 && prob >= 0.66) {
              pushPick('Over 1.5 Goals', 'Over/Under 1.5', ou15Market.id, overO.id, 'total=1.5', odds, prob, 'goals_lock', '⚽ Goals Lock', 2)
            }
          }
        }

        // ── 3. Over 2.5 Goals (id: 18) ──
        const ou25Market = e.markets?.find(m => String(m.id) === '18' && (m.specifier === 'total=2.5' || m.desc?.includes('2.5')))
        if (ou25Market && ou25Market.outcomes) {
          const overO = ou25Market.outcomes.find(o => o.desc?.toLowerCase().includes('over'))
          if (overO) {
            const odds = parseFloat(overO.odds) || 1.8
            const prob = parseFloat(overO.probability) || (1 / odds)
            if (odds >= 1.40 && odds <= 1.75 && prob >= 0.55) {
              pushPick('Over 2.5 Goals', 'Over/Under 2.5', ou25Market.id, overO.id, 'total=2.5', odds, prob, 'goals_lock', '🔥 Goals (2.5)', 2)
            } else if (odds > 1.75 && odds <= 1.95 && prob >= 0.50) {
              pushPick('Over 2.5 Goals', 'Over/Under 2.5', ou25Market.id, overO.id, 'total=2.5', odds, prob, 'goals_lock', '🔥 Bold Goals', 3)
            }
          }
        }

        // ── 4. Under 3.5 Goals (id: 18) ──
        const ou35Market = e.markets?.find(m => String(m.id) === '18' && (m.specifier === 'total=3.5' || m.desc?.includes('3.5')))
        if (ou35Market && ou35Market.outcomes) {
          const underO = ou35Market.outcomes.find(o => o.desc?.toLowerCase().includes('under'))
          if (underO) {
            const odds = parseFloat(underO.odds) || 1.8
            const prob = parseFloat(underO.probability) || (1 / odds)
            if (odds >= 1.15 && odds <= 1.40 && prob >= 0.70) {
              pushPick('Under 3.5 Goals', 'Over/Under 3.5', ou35Market.id, underO.id, 'total=3.5', odds, prob, 'goals_lock', '🛡️ Clean Sheet', 1)
            }
          }
        }

        // ── 5. 1X2 Match Winner (id: 1) ──
        const mwMarket = e.markets?.find(m => String(m.id) === '1')
        if (mwMarket && mwMarket.outcomes) {
          for (const o of mwMarket.outcomes) {
            const odds = parseFloat(o.odds) || 2.0
            const prob = parseFloat(o.probability) || (1 / odds)
            if (odds >= 1.18 && odds <= 1.40 && prob >= 0.70) {
              pushPick(`1X2 - ${o.desc}`, '1X2', mwMarket.id, o.id, mwMarket.specifier, odds, prob, 'banker', isMajor ? '🛡️ Tier 1 Banker' : '💰 Solid Fav', 1)
            } else if (odds > 1.40 && odds <= 1.65 && prob >= 0.60) {
              pushPick(`1X2 - ${o.desc}`, '1X2', mwMarket.id, o.id, mwMarket.specifier, odds, prob, 'banker', isMajor ? '🏆 Strong Fav' : '💰 Value Pick', 2)
            } else if (odds > 1.65 && odds <= 1.90 && prob >= 0.52) {
              pushPick(`1X2 - ${o.desc}`, '1X2', mwMarket.id, o.id, mwMarket.specifier, odds, prob, 'value_play', '⚡ Value Bet', 3)
            }
          }
        }

        // ── 6. BTTS Yes (id: 29) ──
        const bttsMarket = e.markets?.find(m => String(m.id) === '29')
        if (bttsMarket && bttsMarket.outcomes) {
          const yesO = bttsMarket.outcomes.find(o => o.desc?.toLowerCase().includes('yes'))
          if (yesO) {
            const odds = parseFloat(yesO.odds) || 1.8
            const prob = parseFloat(yesO.probability) || (1 / odds)
            if (odds >= 1.45 && odds <= 1.70 && prob >= 0.57) {
              pushPick('BTTS - Yes', 'Both Teams To Score', bttsMarket.id, yesO.id, '', odds, prob, 'btts', '⚽⚽ BTTS', 2)
            } else if (odds > 1.70 && odds <= 1.90 && prob >= 0.52) {
              pushPick('BTTS - Yes', 'Both Teams To Score', bttsMarket.id, yesO.id, '', odds, prob, 'btts', '⚽⚽ Bold BTTS', 3)
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
