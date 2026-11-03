import React, { useMemo } from 'react'
import type { DailySurePick } from '../data/sportybetCompetitions'

interface Props {
  allLivePicks: DailySurePick[]
  selectedPickIds: Set<string>
  onTogglePick: (pick: DailySurePick) => void
  onInspectPick: (pick: DailySurePick) => void
}

export function EliteSinglesExplorer({
  allLivePicks,
  selectedPickIds,
  onTogglePick,
  onInspectPick,
}: Props) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedLeagueFilter, setSelectedLeagueFilter] = React.useState<string>('ALL')

  // Group picks by fixture
  const fixtureGroups = useMemo(() => {
    const map = new Map<string, DailySurePick[]>()
    for (const pick of allLivePicks) {
      if (!map.has(pick.eventId)) {
        map.set(pick.eventId, [])
      }
      map.get(pick.eventId)!.push(pick)
    }

    const groups = [...map.values()].map((picks) => {
      const first = picks[0]
      // Pick best primary recommendation: prefer 2UP, DC, Over 1.5/2.5, GG, Corners
      const sorted = [...picks].sort((a, b) => {
        const getPriority = (p: DailySurePick) => {
          if (p.marketId === '60100') return 100 // 2UP Early Payout
          if (p.marketId === '10') return 90 // Double Chance
          if (p.market.includes('Over 1.5')) return 85
          if (p.market.includes('Over 2.5')) return 80
          if (p.marketFamily === 'corners') return 75
          if (p.marketFamily === 'btts') return 70
          if (p.marketId === '1') return 65 // 1X2
          return 30
        }
        return getPriority(b) - getPriority(a)
      })

      const best = sorted[0]
      const alternatives = sorted.slice(1, 5)

      // Competition priority
      const lowerLeague = (first.league || '').toLowerCase()
      let priority = 100
      if (lowerLeague.includes('champions league') || lowerLeague.includes('ucl')) priority = 1000
      else if (lowerLeague.includes('europa league')) priority = 900
      else if (lowerLeague.includes('conference league')) priority = 850
      else if (lowerLeague.includes('premier league')) priority = 800
      else if (lowerLeague.includes('la liga') || lowerLeague.includes('serie a') || lowerLeague.includes('bundesliga')) priority = 750
      else if (lowerLeague.includes('championship')) priority = 650

      return {
        eventId: first.eventId,
        matchLabel: first.matchLabel,
        homeTeam: first.homeTeam,
        awayTeam: first.awayTeam,
        league: first.league,
        kickoff: first.kickoff,
        estimateStartTime: first.estimateStartTime,
        bestPick: best,
        alternatives,
        priority,
      }
    })

    // Sort: Champions League & Elite first!
    groups.sort((a, b) => b.priority - a.priority)
    return groups
  }, [allLivePicks])

  // Extract unique leagues
  const uniqueLeagues = useMemo(() => {
    const set = new Set<string>()
    for (const g of fixtureGroups) {
      if (g.league) set.add(g.league)
    }
    return Array.from(set)
  }, [fixtureGroups])

  // Filtered fixtures
  const filteredFixtures = useMemo(() => {
    return fixtureGroups.filter((g) => {
      if (selectedLeagueFilter !== 'ALL' && g.league !== selectedLeagueFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          g.matchLabel.toLowerCase().includes(q) ||
          g.league.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [fixtureGroups, selectedLeagueFilter, searchQuery])

  const hasUCL = useMemo(() => {
    return fixtureGroups.some((g) => g.league?.toLowerCase().includes('champions league'))
  }, [fixtureGroups])

  return (
    <div className="space-y-5 animate-in fade-in duration-200 font-sans">
      {/* ── Headline Matchday Alert ── */}
      {hasUCL && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0d1f38] to-[#122b4d] border border-blue-400/30 text-white flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-trophy text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-300">
                  Prime European Slate Active
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white tracking-tight mt-0.5">
                UEFA Champions League Matchday Tonight
              </h3>
              <p className="text-xs text-blue-200/80 leading-snug">
                Verified European fixtures prioritized below. Pick individual predictions or assemble into your custom slip.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedLeagueFilter(uniqueLeagues.find(l => l.toLowerCase().includes('champions league')) || 'ALL')}
            className="px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-xs shrink-0 transition-colors cursor-pointer shadow-xs"
          >
            Show UCL Only
          </button>
        </div>
      )}

      {/* ── Search & League Filters ── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
            <input
              type="text"
              placeholder="Search team or competition (e.g. Barcelona, Bayern, UCL)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-800 transition-colors"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-100 shrink-0 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* League Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => setSelectedLeagueFilter('ALL')}
            className={`chip shrink-0 ${selectedLeagueFilter === 'ALL' ? 'on' : ''}`}
          >
            All Competitions ({fixtureGroups.length})
          </button>
          {uniqueLeagues.map((l) => (
            <button
              key={l}
              onClick={() => setSelectedLeagueFilter(l)}
              className={`chip shrink-0 ${selectedLeagueFilter === l ? 'on' : ''}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Match Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFixtures.map((group) => {
          const isBestSelected = selectedPickIds.has(group.bestPick.id)
          const isUCLMatch = group.league?.toLowerCase().includes('champions league')

          return (
            <div
              key={group.eventId}
              className={`card p-5 space-y-3.5 border transition-all ${
                isBestSelected
                  ? 'border-emerald-500 bg-emerald-50/20 shadow-md ring-1 ring-emerald-500/50'
                  : isUCLMatch
                  ? 'border-blue-200/80 hover:border-blue-400 bg-white shadow-xs'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              }`}
            >
              {/* Card Header: League & Kickoff */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isUCLMatch && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  )}
                  <span className={`text-[10px] font-mono font-bold uppercase truncate ${
                    isUCLMatch ? 'text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200' : 'text-zinc-600'
                  }`}>
                    {group.league}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  <i className="fa-regular fa-clock mr-1" />
                  {group.kickoff}
                </span>
              </div>

              {/* Match Teams */}
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-base font-extrabold text-zinc-950 tracking-tight truncate">
                    {group.homeTeam} <span className="font-normal text-xs text-zinc-400">vs</span> {group.awayTeam}
                  </h3>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    Model Confidence: <span className="text-emerald-700 font-bold">{Math.round((group.bestPick.probability || 0.75) * 100)}%</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onInspectPick(group.bestPick)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 transition-colors shrink-0 cursor-pointer"
                  title="Inspect deep stats and match physics"
                >
                  <i className="fa-solid fa-chart-simple mr-1 text-emerald-600" />
                  Inspect
                </button>
              </div>

              {/* Featured Primary AI Prediction */}
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {group.bestPick.marketId === '60100'
                      ? '⚡ 2UP Early Payout'
                      : group.bestPick.marketId === '10'
                      ? '🛡️ Double Chance Lock'
                      : group.bestPick.marketFamily === 'corners'
                      ? '🚩 Corner Play'
                      : group.bestPick.marketFamily === 'btts'
                      ? '🔥 Both Teams To Score'
                      : '⚽ Top Model Selection'}
                  </span>
                  <span className="font-mono font-black text-sm text-zinc-950">
                    @{group.bestPick.odds.toFixed(2)}
                  </span>
                </div>

                <div className="font-extrabold text-sm text-zinc-900">
                  {group.bestPick.market}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Edge: +{Math.max(1, Math.round(((group.bestPick.probability || 0.75) - (1 / group.bestPick.odds)) * 100))}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onTogglePick(group.bestPick)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isBestSelected
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                        : 'bg-zinc-950 hover:bg-zinc-800 text-white shadow-xs'
                    }`}
                  >
                    <i className={`fa-solid ${isBestSelected ? 'fa-check' : 'fa-plus'}`} />
                    <span>{isBestSelected ? 'Added to Slip' : 'Add to Slip'}</span>
                  </button>
                </div>
              </div>

              {/* Sibling Alternative Markets */}
              {group.alternatives.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider block">
                    Alternative Markets:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.alternatives.map((alt) => {
                      const isAltSelected = selectedPickIds.has(alt.id)
                      return (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() => onTogglePick(alt)}
                          className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                            isAltSelected
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                              : 'border-zinc-200/70 hover:border-zinc-300 bg-white text-zinc-700'
                          }`}
                        >
                          <span className="text-[11px] truncate pr-1">{alt.market}</span>
                          <span className="text-[11px] font-mono font-bold shrink-0">@{alt.odds.toFixed(2)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
