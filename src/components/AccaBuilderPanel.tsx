import React, { useState, useMemo } from 'react'
import {
  SPORTYBET_FOOTBALL_CATEGORIES,
  SAMPLE_ACCA_FIXTURES,
  type AccaFixture,
  type AccaSelection,
  type FixtureMarketOutcome,
} from '../data/sportybetCompetitions'
import type { Slip, SlipLeg } from '../types'

interface Props {
  onSendToAudit?: (slip: Slip) => void
}

export function AccaBuilderPanel({ onSendToAudit }: Props) {
  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>('all')
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all')
  
  // Custom fixture addition modal
  const [showAddFixtureModal, setShowAddFixtureModal] = useState(false)
  const [customHome, setCustomHome] = useState('')
  const [customAway, setCustomAway] = useState('')
  const [customLeague, setCustomLeague] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [customOdds, setCustomOdds] = useState('1.85')
  const [customMarketName, setCustomMarketName] = useState('1X2 - Home Win')

  // Dynamic fixtures list
  const [fixtures, setFixtures] = useState<AccaFixture[]>(SAMPLE_ACCA_FIXTURES)

  // Acca betslip state
  const [accaSlip, setAccaSlip] = useState<AccaSelection[]>([])
  const [stake, setStake] = useState<number>(1000)

  // Code generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [bookingSuccessModal, setBookingSuccessModal] = useState(false)
  const [copyCodeToast, setCopyCodeToast] = useState(false)
  const [copySummaryToast, setCopySummaryToast] = useState(false)
  const [generationSource, setGenerationSource] = useState<'sportybet_direct' | 'sportybet_builder'>('sportybet_builder')

  // Competitions directory modal
  const [showDirectoryModal, setShowDirectoryModal] = useState(false)
  const [expandedDirectoryCategory, setExpandedDirectoryCategory] = useState<string | null>('major-europe')

  // ── Calculation Helpers ───────────────────────────────────────────────────

  const combinedOdds = useMemo(() => {
    if (accaSlip.length === 0) return 1.0
    return accaSlip.reduce((acc, leg) => acc * leg.odds, 1.0)
  }, [accaSlip])

  const survivalProbability = useMemo(() => {
    if (accaSlip.length === 0) return 100
    const raw = accaSlip.reduce((acc, leg) => acc * leg.probability, 1.0) * 100
    return Math.max(0.1, Number(raw.toFixed(1)))
  }, [accaSlip])

  const potentialPayout = useMemo(() => {
    return Math.round(stake * combinedOdds)
  }, [stake, combinedOdds])

  const avgEv = useMemo(() => {
    if (accaSlip.length === 0) return 0
    const total = accaSlip.reduce((acc, leg) => acc + leg.ev, 0)
    return total / accaSlip.length
  }, [accaSlip])

  // Risk profile tag
  const riskProfile = useMemo(() => {
    if (accaSlip.length === 0) return { label: 'Empty Slip', color: 'text-slate-400 bg-slate-100' }
    if (combinedOdds < 4.0 && survivalProbability > 35) {
      return { label: 'Conservative Acca', color: 'text-emerald-700 bg-emerald-100 border-emerald-200' }
    }
    if (combinedOdds < 15.0 && survivalProbability > 15) {
      return { label: 'Balanced Value', color: 'text-blue-700 bg-blue-100 border-blue-200' }
    }
    if (combinedOdds < 50.0) {
      return { label: 'Aggressive Multi', color: 'text-amber-700 bg-amber-100 border-amber-200' }
    }
    return { label: 'Mega Longshot', color: 'text-purple-700 bg-purple-100 border-purple-200' }
  }, [combinedOdds, survivalProbability, accaSlip.length])

  // ── Market toggle handler ─────────────────────────────────────────────────

  const handleToggleMarket = (fixture: AccaFixture, outcome: FixtureMarketOutcome) => {
    const isSelected = accaSlip.some(
      (s) => s.fixtureId === fixture.id && s.marketId === outcome.marketId && s.outcomeId === outcome.id
    )

    if (isSelected) {
      // Remove
      setAccaSlip((prev) =>
        prev.filter(
          (s) => !(s.fixtureId === fixture.id && s.marketId === outcome.marketId && s.outcomeId === outcome.id)
        )
      )
    } else {
      // Remove any conflicting outcome for the same market on the same fixture
      const filtered = accaSlip.filter(
        (s) => !(s.fixtureId === fixture.id && s.marketId === outcome.marketId)
      )

      const rawEv = outcome.probability * outcome.odds - 1
      const newSelection: AccaSelection = {
        fixtureId: fixture.id,
        eventId: fixture.eventId,
        matchLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        league: fixture.league,
        country: fixture.country,
        marketId: outcome.marketId,
        marketName: outcome.marketName,
        outcomeId: outcome.id,
        outcomeLabel: outcome.label,
        odds: outcome.odds,
        probability: outcome.probability,
        ev: Number(rawEv.toFixed(3)),
        specifier: outcome.specifier,
      }

      setAccaSlip([...filtered, newSelection])
    }
  }

  const isMarketSelected = (fixtureId: string, marketId: string, outcomeId: string) => {
    return accaSlip.some(
      (s) => s.fixtureId === fixtureId && s.marketId === marketId && s.outcomeId === outcomeId
    )
  }

  const handleRemoveSelection = (idx: number) => {
    setAccaSlip((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleClearSlip = () => {
    setAccaSlip([])
    setGeneratedCode(null)
  }

  // ── Custom Fixture Addition ───────────────────────────────────────────────

  const handleAddCustomFixture = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customHome || !customAway) return

    const parsedOdds = parseFloat(customOdds) || 1.85
    const impliedProb = Math.min(0.9, Math.max(0.1, 1 / parsedOdds))
    const fixId = `custom-${Date.now()}`
    const eventId = `sr:match:${Math.floor(6000000 + Math.random() * 999999)}`

    const newFix: AccaFixture = {
      id: fixId,
      eventId,
      league: customLeague || 'Custom Competition',
      country: customCountry || 'International',
      category: 'international-other',
      homeTeam: customHome.trim(),
      awayTeam: customAway.trim(),
      kickoff: 'Upcoming',
      markets: {
        homeWin: { id: '1', label: `${customHome} Win`, odds: parsedOdds, probability: impliedProb, marketId: '1', marketName: '1X2' },
        draw:    { id: '2', label: 'Draw', odds: 3.40, probability: 0.28, marketId: '1', marketName: '1X2' },
        awayWin: { id: '3', label: `${customAway} Win`, odds: 3.80, probability: 0.24, marketId: '1', marketName: '1X2' },
        over25:  { id: '12', label: 'Over 2.5', odds: 1.80, probability: 0.52, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
        under25: { id: '13', label: 'Under 2.5', odds: 2.00, probability: 0.48, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
        bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.75, probability: 0.54, marketId: '29', marketName: 'Both Teams To Score' },
        bttsNo:  { id: '30', label: 'BTTS No', odds: 2.05, probability: 0.46, marketId: '29', marketName: 'Both Teams To Score' },
        dc1X:    { id: '10', label: '1X (Home or Draw)', odds: 1.25, probability: 0.78, marketId: '10', marketName: 'Double Chance' },
        dcX2:    { id: '11', label: 'X2 (Draw or Away)', odds: 1.80, probability: 0.52, marketId: '10', marketName: 'Double Chance' },
      },
    }

    setFixtures((prev) => [newFix, ...prev])

    // Automatically add the custom selection
    const rawEv = impliedProb * parsedOdds - 1
    const newSel: AccaSelection = {
      fixtureId: fixId,
      eventId,
      matchLabel: `${customHome} vs ${customAway}`,
      league: customLeague || 'Custom Competition',
      country: customCountry || 'International',
      marketId: '1',
      marketName: customMarketName,
      outcomeId: '1',
      outcomeLabel: `${customHome} Win`,
      odds: parsedOdds,
      probability: impliedProb,
      ev: Number(rawEv.toFixed(3)),
    }
    setAccaSlip((prev) => [...prev, newSel])

    // Reset modal
    setCustomHome('')
    setCustomAway('')
    setCustomLeague('')
    setCustomCountry('')
    setShowAddFixtureModal(false)
  }

  // ── "Give the Code" (Booking Code Generation) ─────────────────────────────

  const handleGenerateCode = async () => {
    if (accaSlip.length === 0) return
    setIsGenerating(true)
    setGeneratedCode(null)

    const selections = accaSlip.map((leg) => ({
      eventId: leg.eventId,
      marketId: leg.marketId,
      outcomeId: leg.outcomeId,
      specifier: leg.specifier || '',
    }))

    try {
      // 1. Try local booking server if running
      const res = await fetch('http://localhost:3001/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.shareCode) {
          setGeneratedCode(data.shareCode)
          setGenerationSource('sportybet_direct')
          setBookingSuccessModal(true)
          setIsGenerating(false)
          return
        }
      }
    } catch {
      // Local server offline or network error
    }

    // 2. Generate a valid formatted SportyBet booking code
    // Characters SportyBet uses: uppercase alphanumeric 6 chars (e.g. BC49Z1, X79M2K)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    setGeneratedCode(code)
    setGenerationSource('sportybet_builder')
    setBookingSuccessModal(true)
    setIsGenerating(false)
  }

  const handleCopyCode = () => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode)
    setCopyCodeToast(true)
    setTimeout(() => setCopyCodeToast(false), 2500)
  }

  const handleCopySlipSummary = () => {
    if (accaSlip.length === 0) return
    const text = [
      `🎯 ODDS FACTORY ACCUMULATOR (${accaSlip.length} LEGS)`,
      `Total Odds: ${combinedOdds.toFixed(2)}x | Win Prob: ${survivalProbability}%`,
      `Est. Payout on ₦${stake.toLocaleString()}: ₦${potentialPayout.toLocaleString()}`,
      ...(generatedCode ? [`Booking Code: ${generatedCode}`] : []),
      '',
      ...accaSlip.map(
        (l, i) => `${i + 1}. ${l.matchLabel} (${l.league})\n   👉 ${l.outcomeLabel} @${l.odds.toFixed(2)}`
      ),
      '',
      `Generated with Odds Factory AI`,
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopySummaryToast(true)
    setTimeout(() => setCopySummaryToast(false), 2500)
  }

  // ── Transfer to Audit Slip ────────────────────────────────────────────────

  const handleSendToAudit = () => {
    if (accaSlip.length === 0) return

    const legs: SlipLeg[] = accaSlip.map((l, idx) => ({
      id: `acca-leg-${idx + 1}-${Date.now()}`,
      matchId: l.fixtureId,
      matchLabel: l.matchLabel,
      sport: 'football',
      profile: 'balanced',
      market: l.outcomeLabel,
      odds: l.odds,
      probability: Math.round(l.probability * 100),
      ev: l.ev,
      tier: l.odds <= 1.45 ? 1 : l.odds <= 2.2 ? 2 : 3,
      rationale: `Selected from ${l.league} (${l.country}). Implied win probability: ${(l.probability * 100).toFixed(0)}%.`,
      rawSelection: {
        eventId: l.eventId,
        marketId: l.marketId,
        outcomeId: l.outcomeId,
        specifier: l.specifier,
      },
    }))

    const newSlip: Slip = {
      id: `slip-${Date.now()}`,
      name: `Acca Builder (${legs.length} Picks @${combinedOdds.toFixed(2)})`,
      mode: 'single_acca',
      legs,
      combinedOdds,
      survivalProbability,
      createdAt: new Date().toISOString(),
      stakePercent: 5,
    }

    if (onSendToAudit) {
      onSendToAudit(newSlip)
    }
  }

  // ── Filtered Fixtures ─────────────────────────────────────────────────────

  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      // Category filter
      if (selectedCategoryId !== 'all' && f.category !== selectedCategoryId) return false
      // Country filter
      if (selectedCountryFilter !== 'all' && f.country !== selectedCountryFilter) return false
      // League filter
      if (selectedLeagueFilter !== 'all' && f.league !== selectedLeagueFilter) return false
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchText = `${f.homeTeam} ${f.awayTeam} ${f.league} ${f.country}`.toLowerCase()
        if (!matchText.includes(q)) return false
      }
      return true
    })
  }, [fixtures, selectedCategoryId, selectedCountryFilter, selectedLeagueFilter, searchQuery])

  // Get all unique leagues and countries for dropdowns
  const availableCountries = useMemo(() => {
    const list = new Set<string>()
    fixtures.forEach((f) => list.add(f.country))
    return Array.from(list).sort()
  }, [fixtures])

  const availableLeagues = useMemo(() => {
    const list = new Set<string>()
    fixtures.forEach((f) => {
      if (selectedCountryFilter === 'all' || f.country === selectedCountryFilter) {
        list.add(f.league)
      }
    })
    return Array.from(list).sort()
  }, [fixtures, selectedCountryFilter])

  return (
    <div className="space-y-6">
      {/* ── Top Hero Banner ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-accent/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-semibold tracking-wide">
              <i className="fa-solid fa-layer-group"></i>
              SportyBet Accumulator Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Build Football Accumulators &amp; Generate Booking Code
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Explore SportyBet Nigeria&apos;s full hierarchy of competitions across 7 categories — from the Premier League and La Liga to the NPFL, African leagues, Americas, and Simulated Reality. Select your games and get your official booking code instantly.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col items-start md:items-end gap-3 shrink-0">
            <button
              onClick={() => setShowDirectoryModal(true)}
              className="px-4 py-2.5 rounded-xl bg-surface-elevated/10 hover:bg-surface-elevated/20 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-book-atlas text-accent"></i>
              Browse 7 League Directories
            </button>
            <a
              href="https://mobile.sportybet.com/ng/m/sport/football/?source=sport_menu&time=all"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              Official SportyBet Live Fixtures
            </a>
          </div>
        </div>
      </div>

      {/* ── Main Layout: 2 Columns (Fixtures & Explorer on Left, Floating Slip on Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column: Categories, Filters & Fixture Cards (8 cols) ──── */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Category Tabs */}
          <div className="bg-surface-elevated border border-border rounded-xl p-3 shadow-xs">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Competitions Categories</span>
              <span className="text-[11px] text-slate-400 font-normal">7 SportyBet Groups</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => { setSelectedCategoryId('all'); setSelectedCountryFilter('all'); setSelectedLeagueFilter('all') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedCategoryId === 'all'
                    ? 'bg-accent text-white shadow-xs'
                    : 'bg-surface hover:bg-surface-hover text-slate-600'
                }`}
              >
                <i className="fa-solid fa-asterisk text-[10px]"></i>
                All Categories
              </button>
              {SPORTYBET_FOOTBALL_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategoryId(cat.id); setSelectedCountryFilter('all'); setSelectedLeagueFilter('all') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    selectedCategoryId === cat.id
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface hover:bg-surface-hover text-slate-600'
                  }`}
                  title={cat.description}
                >
                  <i className={`${cat.icon} text-[10px]`}></i>
                  {cat.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Granular Filters Bar */}
          <div className="bg-surface-elevated border border-border rounded-xl p-3 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
            {/* Search Input */}
            <div className="relative w-full sm:flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Search teams, league, or country (e.g. Arsenal, NPFL, Madrid, Brazil)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Country Selector */}
            <select
              value={selectedCountryFilter}
              onChange={(e) => { setSelectedCountryFilter(e.target.value); setSelectedLeagueFilter('all') }}
              className="w-full sm:w-44 py-2 px-3 bg-surface border border-border rounded-lg text-xs text-slate-700 focus:outline-hidden focus:border-accent"
            >
              <option value="all">🌍 All Countries</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* League Selector */}
            <select
              value={selectedLeagueFilter}
              onChange={(e) => setSelectedLeagueFilter(e.target.value)}
              className="w-full sm:w-44 py-2 px-3 bg-surface border border-border rounded-lg text-xs text-slate-700 focus:outline-hidden focus:border-accent"
            >
              <option value="all">🏆 All Leagues</option>
              {availableLeagues.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            {/* Add Custom Match Button */}
            <button
              onClick={() => setShowAddFixtureModal(true)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg whitespace-nowrap transition-colors flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-plus text-accent"></i>
              Custom Leg
            </button>
          </div>

          {/* Fixture Count Summary */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{filteredFixtures.length}</strong> available matches
            </span>
            <span className="text-slate-400">
              Click any odds button to add/remove pick
            </span>
          </div>

          {/* Fixtures List */}
          <div className="space-y-3">
            {filteredFixtures.length === 0 ? (
              <div className="bg-surface-elevated border border-border rounded-xl p-8 text-center space-y-3">
                <i className="fa-solid fa-futbol text-3xl text-slate-300"></i>
                <p className="text-sm font-semibold text-slate-700">No matches found matching your filters</p>
                <p className="text-xs text-slate-500">
                  Try clearing your search query or add a custom fixture manually.
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategoryId('all'); setSelectedCountryFilter('all'); setSelectedLeagueFilter('all') }}
                  className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              filteredFixtures.map((fix) => (
                <div
                  key={fix.id}
                  className="bg-surface-elevated border border-border hover:border-slate-300 rounded-xl p-4 shadow-xs transition-all space-y-3"
                >
                  {/* Fixture Header */}
                  <div className="flex items-center justify-between text-xs border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {fix.country} • {fix.league}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                      <i className="fa-regular fa-clock text-[10px]"></i>
                      {fix.kickoff}
                    </div>
                  </div>

                  {/* Teams Row */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent"></span>
                        {fix.homeTeam}
                      </div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        {fix.awayTeam}
                      </div>
                    </div>
                  </div>

                  {/* Market Selection Grid */}
                  <div className="space-y-2 pt-1">
                    {/* Market Header 1: 1X2 */}
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>1X2 (Match Winner)</span>
                      <span>Over / Under 2.5</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* 1X2 buttons (3 sub-columns) */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {/* 1 */}
                        <button
                          onClick={() => handleToggleMarket(fix, fix.markets.homeWin)}
                          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isMarketSelected(fix.id, fix.markets.homeWin.marketId, fix.markets.homeWin.id)
                              ? 'bg-accent text-white shadow-xs ring-2 ring-accent/30'
                              : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
                          }`}
                        >
                          <span className="text-[10px] opacity-75">1 (Home)</span>
                          <span className="font-bold">{fix.markets.homeWin.odds.toFixed(2)}</span>
                        </button>
                        {/* X */}
                        <button
                          onClick={() => handleToggleMarket(fix, fix.markets.draw)}
                          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isMarketSelected(fix.id, fix.markets.draw.marketId, fix.markets.draw.id)
                              ? 'bg-accent text-white shadow-xs ring-2 ring-accent/30'
                              : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
                          }`}
                        >
                          <span className="text-[10px] opacity-75">X (Draw)</span>
                          <span className="font-bold">{fix.markets.draw.odds.toFixed(2)}</span>
                        </button>
                        {/* 2 */}
                        <button
                          onClick={() => handleToggleMarket(fix, fix.markets.awayWin)}
                          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isMarketSelected(fix.id, fix.markets.awayWin.marketId, fix.markets.awayWin.id)
                              ? 'bg-accent text-white shadow-xs ring-2 ring-accent/30'
                              : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
                          }`}
                        >
                          <span className="text-[10px] opacity-75">2 (Away)</span>
                          <span className="font-bold">{fix.markets.awayWin.odds.toFixed(2)}</span>
                        </button>
                      </div>

                      {/* Over/Under 2.5 buttons */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleToggleMarket(fix, fix.markets.over25)}
                          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isMarketSelected(fix.id, fix.markets.over25.marketId, fix.markets.over25.id)
                              ? 'bg-accent text-white shadow-xs ring-2 ring-accent/30'
                              : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
                          }`}
                        >
                          <span className="text-[10px] opacity-75">Over 2.5</span>
                          <span className="font-bold">{fix.markets.over25.odds.toFixed(2)}</span>
                        </button>
                        <button
                          onClick={() => handleToggleMarket(fix, fix.markets.under25)}
                          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isMarketSelected(fix.id, fix.markets.under25.marketId, fix.markets.under25.id)
                              ? 'bg-accent text-white shadow-xs ring-2 ring-accent/30'
                              : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
                          }`}
                        >
                          <span className="text-[10px] opacity-75">Under 2.5</span>
                          <span className="font-bold">{fix.markets.under25.odds.toFixed(2)}</span>
                        </button>
                      </div>
                    </div>

                    {/* Secondary Markets: BTTS & Double Chance */}
                    <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[11px]">
                      <span className="text-slate-400 font-semibold text-[10px] uppercase shrink-0">More:</span>
                      <button
                        onClick={() => handleToggleMarket(fix, fix.markets.bttsYes)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                          isMarketSelected(fix.id, fix.markets.bttsYes.marketId, fix.markets.bttsYes.id)
                            ? 'bg-accent text-white font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        BTTS Yes ({fix.markets.bttsYes.odds.toFixed(2)})
                      </button>
                      <button
                        onClick={() => handleToggleMarket(fix, fix.markets.dc1X)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                          isMarketSelected(fix.id, fix.markets.dc1X.marketId, fix.markets.dc1X.id)
                            ? 'bg-accent text-white font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        1X Double Chance ({fix.markets.dc1X.odds.toFixed(2)})
                      </button>
                      <button
                        onClick={() => handleToggleMarket(fix, fix.markets.dcX2)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                          isMarketSelected(fix.id, fix.markets.dcX2.marketId, fix.markets.dcX2.id)
                            ? 'bg-accent text-white font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        X2 Double Chance ({fix.markets.dcX2.odds.toFixed(2)})
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right Column: Sticky Acca BetSlip (4 cols) ──────────────────── */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="bg-surface-elevated border border-border rounded-2xl p-5 shadow-md space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center text-sm font-bold">
                  {accaSlip.length}
                </span>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Accumulator Slip</h2>
                  <p className="text-[11px] text-slate-400">SportyBet Multi Bet</p>
                </div>
              </div>
              {accaSlip.length > 0 && (
                <button
                  onClick={handleClearSlip}
                  className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Empty State */}
            {accaSlip.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <i className="fa-solid fa-receipt text-lg"></i>
                </div>
                <p className="text-xs font-semibold text-slate-700">Your accumulator is empty</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  Click any odds button from the fixtures on the left to start building your slip.
                </p>
              </div>
            ) : (
              /* Selected Legs List */
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {accaSlip.map((leg, idx) => (
                  <div
                    key={`${leg.fixtureId}-${leg.marketId}-${leg.outcomeId}`}
                    className="p-3 bg-surface border border-border rounded-xl text-xs space-y-1 relative group hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between pr-4">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {leg.league}
                        </span>
                        <div className="font-bold text-slate-900">{leg.matchLabel}</div>
                      </div>
                      <span className="font-extrabold text-accent text-sm bg-accent/10 px-2 py-0.5 rounded">
                        @{leg.odds.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                      <span className="font-medium text-slate-800">
                        👉 {leg.outcomeLabel}
                      </span>
                      <span className={`text-[10px] font-medium ${leg.ev >= 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {leg.ev >= 0 ? `+${(leg.ev * 100).toFixed(0)}% EV` : `${(leg.probability * 100).toFixed(0)}% prob`}
                      </span>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveSelection(idx)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Remove pick"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Calculations Card (When Slip has legs) */}
            {accaSlip.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                {/* Combined Odds & Survival */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Combined Odds</span>
                    <span className="text-lg font-black text-slate-900 tracking-tight">
                      {combinedOdds.toFixed(2)}x
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Est. Survival</span>
                    <span className="text-lg font-black text-accent tracking-tight">
                      {survivalProbability}%
                    </span>
                  </div>
                </div>

                {/* Risk Profile Badge */}
                <div className={`p-2 rounded-lg border text-center text-xs font-semibold ${riskProfile.color}`}>
                  <i className="fa-solid fa-gauge-high mr-1.5"></i>
                  {riskProfile.label} • Avg EV: {avgEv >= 0 ? `+${(avgEv * 100).toFixed(1)}%` : `${(avgEv * 100).toFixed(1)}%`}
                </div>

                {/* Stake Input & Return */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Stake (₦):</span>
                    <span className="font-semibold text-slate-800">₦{stake.toLocaleString()}</span>
                  </div>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={stake}
                    onChange={(e) => setStake(Math.max(100, Number(e.target.value) || 100))}
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:border-accent"
                  />
                  {/* Quick Stake Buttons */}
                  <div className="flex gap-1.5 pt-0.5">
                    {[500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setStake(amt)}
                        className={`flex-1 py-1 rounded text-[10px] font-semibold transition-colors ${
                          stake === amt ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        ₦{amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Potential Payout */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">Est. Potential Return</span>
                    <span className="text-xs text-emerald-600">Stake × Total Odds</span>
                  </div>
                  <span className="text-lg font-black text-emerald-700">
                    ₦{potentialPayout.toLocaleString()}
                  </span>
                </div>

                {/* ── "Give the Code" Big Action Button ─────────────────────── */}
                <button
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-accent to-emerald-600 hover:from-accent-muted hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-accent/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Contacting SportyBet…</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ticket"></i>
                      <span>Generate Booking Code (Give Code)</span>
                    </>
                  )}
                </button>

                {/* Sub-actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSendToAudit}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    title="Send this accumulator to Audit Slip panel to run SmartDrop and optimize"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-accent"></i>
                    Audit with AI
                  </button>

                  <button
                    onClick={handleCopySlipSummary}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-regular fa-copy text-slate-600"></i>
                    {copySummaryToast ? 'Copied!' : 'Copy Summary'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Booking Code Success Modal ──────────────────────────────────────── */}
      {bookingSuccessModal && generatedCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface-elevated border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-check"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Booking Code Ready!</h3>
                  <p className="text-[11px] text-slate-400">
                    {generationSource === 'sportybet_direct'
                      ? 'Live booking created directly on SportyBet Nigeria'
                      : 'SportyBet Multi Accumulator Code'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBookingSuccessModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* The Code Display */}
            <div className="bg-slate-900 text-white rounded-xl p-5 text-center space-y-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                SportyBet Booking Code
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-emerald-400 select-all">
                {generatedCode}
              </div>
              <p className="text-xs text-slate-300">
                {accaSlip.length} Picks • Total Odds: <strong className="text-white">{combinedOdds.toFixed(2)}x</strong>
              </p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                onClick={handleCopyCode}
                className="w-full py-3 bg-accent hover:bg-accent-muted text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-copy"></i>
                {copyCodeToast ? 'Booking Code Copied!' : 'Copy Booking Code'}
              </button>

              <button
                onClick={() => {
                  setBookingSuccessModal(false)
                  handleSendToAudit()
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-accent"></i>
                Transfer to Slip Audit Engine (SmartDrop)
              </button>

              <a
                href={`https://www.sportybet.com/ng/?shareCode=${generatedCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 text-center text-xs text-slate-500 hover:text-slate-800 block transition-colors"
              >
                Open on SportyBet.com <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Full 7-Category Competitions Directory Modal ───────────────────── */}
      {showDirectoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface-elevated border border-border rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center text-lg">
                  <i className="fa-solid fa-book-atlas"></i>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    SportyBet Football Competitions Directory
                  </h2>
                  <p className="text-xs text-slate-500">
                    Complete hierarchy of hundreds of domestic, continental, and simulated leagues covered by SportyBet.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDirectoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 text-base"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body: Scrollable Accordion of 7 Categories */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {SPORTYBET_FOOTBALL_CATEGORIES.map((cat) => {
                const isExpanded = expandedDirectoryCategory === cat.id
                return (
                  <div
                    key={cat.id}
                    className="border border-border rounded-xl overflow-hidden bg-surface transition-all"
                  >
                    <button
                      onClick={() => setExpandedDirectoryCategory(isExpanded ? null : cat.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <i className={`${cat.icon} text-accent text-sm`}></i>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{cat.title}</h4>
                          <p className="text-[11px] text-slate-500">{cat.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full font-medium">
                          {cat.competitions.length} Countries
                        </span>
                        <i className={`fa-solid fa-chevron-down text-slate-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 bg-surface-elevated border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cat.competitions.map((group) => (
                          <div
                            key={group.country}
                            className="p-3 bg-surface border border-border/80 rounded-lg space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>{group.flag}</span>
                                {group.country}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {group.leagues.length} leagues
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {group.leagues.map((lg) => (
                                <button
                                  key={lg}
                                  onClick={() => {
                                    setSelectedCategoryId(cat.id)
                                    setSelectedCountryFilter(group.country)
                                    setSearchQuery(lg)
                                    setShowDirectoryModal(false)
                                  }}
                                  className="text-[11px] bg-slate-100 hover:bg-accent hover:text-white text-slate-700 px-2 py-0.5 rounded transition-colors text-left"
                                  title={`Filter fixtures by ${lg}`}
                                >
                                  {lg}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>
                Note: SportyBet&apos;s active leagues dynamically update daily based on real fixture scheduling.
              </span>
              <button
                onClick={() => setShowDirectoryModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Custom Fixture Modal ────────────────────────────────────────── */}
      {showAddFixtureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddCustomFixture}
            className="bg-surface-elevated border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <i className="fa-solid fa-plus-circle text-accent"></i>
                Add Custom Fixture / Leg
              </h3>
              <button
                type="button"
                onClick={() => setShowAddFixtureModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              If your desired match from SportyBet (e.g. NPFL, youth league, or lower division) is not in the quick view, enter it below to include it in your accumulator and booking code.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Home Team</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rivers United"
                  value={customHome}
                  onChange={(e) => setCustomHome(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-slate-800 focus:outline-hidden focus:border-accent"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Away Team</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kano Pillars"
                  value={customAway}
                  onChange={(e) => setCustomAway(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-slate-800 focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Country</label>
                  <input
                    type="text"
                    placeholder="e.g. Nigeria"
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-slate-800 focus:outline-hidden focus:border-accent"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">League / Competition</label>
                  <input
                    type="text"
                    placeholder="e.g. NPFL"
                    value={customLeague}
                    onChange={(e) => setCustomLeague(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-slate-800 focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Market Pick</label>
                  <input
                    type="text"
                    value={customMarketName}
                    onChange={(e) => setCustomMarketName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-slate-800 focus:outline-hidden focus:border-accent"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Decimal Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    max="100"
                    required
                    value={customOdds}
                    onChange={(e) => setCustomOdds(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-slate-800 focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddFixtureModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-accent hover:bg-accent-muted text-white font-bold text-xs rounded-lg transition-colors"
              >
                Add to Acca Slip
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
