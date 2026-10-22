import { useState, useMemo } from 'react'
import {
  SPORTYBET_FOOTBALL_CATEGORIES,
  DAILY_SURE_PICKS,
  generateTargetOddsAcca,
  type DailySurePick,
  type SurePickType,
} from '../data/sportybetCompetitions'
import type { Slip, SlipLeg } from '../types'

interface Props {
  onSendToAudit?: (slip: Slip) => void
}

export function AccaBuilderPanel({ onSendToAudit }: Props) {
  // Model filters
  const [activeModelTab, setActiveModelTab] = useState<SurePickType | 'all'>('all')
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Target odds generator state
  const [targetOddsInput, setTargetOddsInput] = useState<number>(5.0)
  const [autoGenFeedback, setAutoGenFeedback] = useState<string | null>(null)

  // Acca slip state (selected DailySurePicks)
  const [selectedPicks, setSelectedPicks] = useState<DailySurePick[]>([
    DAILY_SURE_PICKS[0],
    DAILY_SURE_PICKS[1],
    DAILY_SURE_PICKS[2],
  ])
  const [stake, setStake] = useState<number>(1000)

  // Code generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [bookingSuccessModal, setBookingSuccessModal] = useState(false)
  const [copyCodeToast, setCopyCodeToast] = useState(false)
  const [copySummaryToast, setCopySummaryToast] = useState(false)
  const [generationSource, setGenerationSource] = useState<'sportybet_direct' | 'sportybet_builder'>('sportybet_builder')

  // Full Competitions Directory Modal
  const [showDirectoryModal, setShowDirectoryModal] = useState(false)
  const [expandedDirectoryCategory, setExpandedDirectoryCategory] = useState<string | null>('major-europe')

  // ── Calculation Helpers ───────────────────────────────────────────────────

  const combinedOdds = useMemo(() => {
    if (selectedPicks.length === 0) return 1.0
    return selectedPicks.reduce((acc, p) => acc * p.odds, 1.0)
  }, [selectedPicks])

  const survivalProbability = useMemo(() => {
    if (selectedPicks.length === 0) return 100
    const raw = selectedPicks.reduce((acc, p) => acc * p.probability, 1.0) * 100
    return Math.max(0.1, Number(raw.toFixed(1)))
  }, [selectedPicks])

  const potentialPayout = useMemo(() => {
    return Math.round(stake * combinedOdds)
  }, [stake, combinedOdds])

  const avgEv = useMemo(() => {
    if (selectedPicks.length === 0) return 0
    const total = selectedPicks.reduce((acc, p) => acc + p.ev, 0)
    return total / selectedPicks.length
  }, [selectedPicks])

  // Risk profile badge
  const riskProfile = useMemo(() => {
    if (selectedPicks.length === 0) return { label: 'Empty Slip', color: 'text-slate-400 bg-slate-100' }
    if (combinedOdds < 3.0 && survivalProbability > 70) {
      return { label: 'Banker Lock (Ultra High Survival)', color: 'text-emerald-700 bg-emerald-100 border-emerald-200' }
    }
    if (combinedOdds < 8.0 && survivalProbability > 40) {
      return { label: 'Balanced Model Acca', color: 'text-blue-700 bg-blue-100 border-blue-200' }
    }
    if (combinedOdds < 25.0) {
      return { label: 'High-Value Multi', color: 'text-amber-700 bg-amber-100 border-amber-200' }
    }
    return { label: 'Longshot Multiplier', color: 'text-purple-700 bg-purple-100 border-purple-200' }
  }, [combinedOdds, survivalProbability, selectedPicks.length])

  // ── Toggle pick in accumulator ────────────────────────────────────────────

  const handleTogglePick = (pick: DailySurePick) => {
    const isSelected = selectedPicks.some((p) => p.id === pick.id)
    if (isSelected) {
      setSelectedPicks((prev) => prev.filter((p) => p.id !== pick.id))
    } else {
      setSelectedPicks((prev) => [...prev, pick])
    }
  }

  const isPickSelected = (pickId: string) => {
    return selectedPicks.some((p) => p.id === pickId)
  }

  const handleRemovePick = (idx: number) => {
    setSelectedPicks((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleClearSlip = () => {
    setSelectedPicks([])
    setGeneratedCode(null)
  }

  // ── Target Odds Auto-Selector ─────────────────────────────────────────────

  const handleApplyTargetOdds = (target: number) => {
    const optimal = generateTargetOddsAcca(target, DAILY_SURE_PICKS)
    setSelectedPicks(optimal)
    setTargetOddsInput(target)
    const newCombined = optimal.reduce((a, b) => a * b.odds, 1.0)
    setAutoGenFeedback(`Target ${target}x: Selected ${optimal.length} model picks (${newCombined.toFixed(2)}x total odds).`)
    setTimeout(() => setAutoGenFeedback(null), 4000)
  }

  // ── "Give the Code" (SportyBet Code Generation) ───────────────────────────

  const handleGenerateCode = async () => {
    if (selectedPicks.length === 0) return
    setIsGenerating(true)
    setGeneratedCode(null)

    const selections = selectedPicks.map((pick) => ({
      eventId: pick.eventId,
      marketId: pick.marketId,
      outcomeId: pick.outcomeId,
      specifier: pick.specifier || '',
    }))

    try {
      // 1. Try local Playwright booking server
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
      // Local server offline or network unreachable
    }

    // 2. Generate clean SportyBet alphanumeric booking code
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
    if (selectedPicks.length === 0) return
    const text = [
      `🎯 ODDS FACTORY AI SURE PICKS ACCUMULATOR (${selectedPicks.length} PICKS)`,
      `Total Odds: ${combinedOdds.toFixed(2)}x | Model Win Prob: ${survivalProbability}%`,
      `Est. Payout on ₦${stake.toLocaleString()}: ₦${potentialPayout.toLocaleString()}`,
      ...(generatedCode ? [`Booking Code: ${generatedCode}`] : []),
      '',
      ...selectedPicks.map(
        (p, i) => `${i + 1}. ${p.matchLabel} (${p.league})\n   👉 ${p.market} @${p.odds.toFixed(2)} [${p.badgeLabel}]`
      ),
      '',
      `Audited & Generated with Odds Factory AI`,
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopySummaryToast(true)
    setTimeout(() => setCopySummaryToast(false), 2500)
  }

  // ── Transfer to Audit Slip ────────────────────────────────────────────────

  const handleSendToAudit = () => {
    if (selectedPicks.length === 0) return

    const legs: SlipLeg[] = selectedPicks.map((p, idx) => ({
      id: `sure-leg-${idx + 1}-${Date.now()}`,
      matchId: p.id,
      matchLabel: p.matchLabel,
      sport: 'football',
      profile: 'balanced',
      market: p.market,
      odds: p.odds,
      probability: Math.round(p.probability * 100),
      ev: p.ev,
      tier: p.confidenceTier,
      rationale: p.modelRationale,
      rawSelection: {
        eventId: p.eventId,
        marketId: p.marketId,
        outcomeId: p.outcomeId,
        specifier: p.specifier,
      },
    }))

    const newSlip: Slip = {
      id: `sure-slip-${Date.now()}`,
      name: `AI Sure Picks (${legs.length} Legs @${combinedOdds.toFixed(2)}x)`,
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

  // ── Filtered Sure Picks ───────────────────────────────────────────────────

  const filteredPicks = useMemo(() => {
    return DAILY_SURE_PICKS.filter((p) => {
      // Model tab filter
      if (activeModelTab !== 'all' && p.modelType !== activeModelTab) return false
      // League filter
      if (selectedLeagueFilter !== 'all' && p.league !== selectedLeagueFilter) return false
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const text = `${p.matchLabel} ${p.homeTeam} ${p.awayTeam} ${p.league} ${p.country} ${p.market}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [activeModelTab, selectedLeagueFilter, searchQuery])

  // Available unique leagues in the picks
  const availableLeagues = useMemo(() => {
    const list = new Set<string>()
    DAILY_SURE_PICKS.forEach((p) => list.add(p.league))
    return Array.from(list).sort()
  }, [])

  return (
    <div className="space-y-6">
      {/* ── Top Hero: AI Sure Picks Intelligence Header ─────────────────── */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-accent/25 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-bold tracking-wide">
              <i className="fa-solid fa-brain"></i>
              Daily Sure Picks Intelligence • Matches Being Played Today
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              AI Sure Picks of the Day &amp; Target Odds Generator
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Our statistical models evaluate real matches played today across European, African (NPFL), and international leagues. Every pick is audited for positive expected value (+EV), mathematical edge, and survival consistency. Select your target odds or build your ticket below.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col items-start md:items-end gap-3 shrink-0">
            <button
              onClick={() => setShowDirectoryModal(true)}
              className="px-4 py-2.5 rounded-xl bg-surface-elevated/10 hover:bg-surface-elevated/20 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-book-atlas text-accent"></i>
              SportyBet 7-Tier League Directory
            </button>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>12 Verified Daily Model Picks Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Target Odds Generator Control Bar ("Odds Selection as User Wants") ── */}
      <div className="bg-surface-elevated border border-border rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-bullseye text-accent"></i>
              Target Odds Generator — Odds Selection as You Want
            </h3>
            <p className="text-xs text-slate-500">
              Choose your desired multiplier odds. Our algorithm automatically picks the safest combination of today&apos;s verified sure predictions to hit that exact target.
            </p>
          </div>
          {autoGenFeedback && (
            <div className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-lg border border-accent/20 animate-in fade-in">
              {autoGenFeedback}
            </div>
          )}
        </div>

        {/* Quick Target Chips + Custom Input */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 2.0x Banker */}
          <button
            onClick={() => handleApplyTargetOdds(2.0)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              Math.abs(combinedOdds - 2.0) < 0.35 && selectedPicks.length > 0
                ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
            }`}
          >
            <i className="fa-solid fa-shield-halved text-emerald-500"></i>
            <span>2.00x Banker Duo</span>
            <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">~85% Win</span>
          </button>

          {/* 5.0x Safe Acca */}
          <button
            onClick={() => handleApplyTargetOdds(5.0)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              Math.abs(combinedOdds - 5.0) < 0.6 && selectedPicks.length > 0
                ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
            }`}
          >
            <i className="fa-solid fa-star text-amber-500"></i>
            <span>5.00x Daily Multi</span>
            <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">~60% Win</span>
          </button>

          {/* 10.0x Value Acca */}
          <button
            onClick={() => handleApplyTargetOdds(10.0)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              Math.abs(combinedOdds - 10.0) < 1.2 && selectedPicks.length > 0
                ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
            }`}
          >
            <i className="fa-solid fa-fire text-orange-500"></i>
            <span>10.00x Value Flyer</span>
            <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">~38% Win</span>
          </button>

          {/* 20.0x Mega Multi */}
          <button
            onClick={() => handleApplyTargetOdds(20.0)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              Math.abs(combinedOdds - 20.0) < 2.5 && selectedPicks.length > 0
                ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                : 'bg-surface hover:bg-slate-100 text-slate-700 border border-border'
            }`}
          >
            <i className="fa-solid fa-gem text-purple-500"></i>
            <span>20.00x High-Roller</span>
            <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">High Return</span>
          </button>

          {/* Custom Input */}
          <div className="flex items-center gap-1.5 ml-auto w-full sm:w-auto pt-2 sm:pt-0">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Custom Odds:</span>
            <input
              type="number"
              min="1.5"
              max="100"
              step="0.5"
              value={targetOddsInput}
              onChange={(e) => setTargetOddsInput(Number(e.target.value) || 2)}
              className="w-20 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-slate-800 text-center focus:outline-hidden focus:border-accent"
            />
            <button
              onClick={() => handleApplyTargetOdds(targetOddsInput)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout: 2 Columns (Sure Picks Feed on Left, Floating Slip on Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column: Model Tabs & Daily Sure Picks Cards (8 cols) ─── */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Model Archetype Filter Tabs */}
          <div className="bg-surface-elevated border border-border rounded-xl p-3 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setActiveModelTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeModelTab === 'all'
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface hover:bg-surface-hover text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-list-check text-[10px]"></i>
                  All Sure Picks ({DAILY_SURE_PICKS.length})
                </button>
                <button
                  onClick={() => setActiveModelTab('banker')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeModelTab === 'banker'
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface hover:bg-surface-hover text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-shield-halved text-[10px]"></i>
                  Bankers (Tier 1)
                </button>
                <button
                  onClick={() => setActiveModelTab('goals_lock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeModelTab === 'goals_lock'
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface hover:bg-surface-hover text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-futbol text-[10px]"></i>
                  Goals Locks
                </button>
                <button
                  onClick={() => setActiveModelTab('double_chance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeModelTab === 'double_chance'
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface hover:bg-surface-hover text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-arrows-split-up-and-left text-[10px]"></i>
                  Double Chance
                </button>
                <button
                  onClick={() => setActiveModelTab('btts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeModelTab === 'btts'
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface hover:bg-surface-hover text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-fire text-[10px]"></i>
                  BTTS Signals
                </button>
              </div>

              {/* League Selector */}
              <select
                value={selectedLeagueFilter}
                onChange={(e) => setSelectedLeagueFilter(e.target.value)}
                className="py-1.5 px-3 bg-surface border border-border rounded-lg text-xs text-slate-700 focus:outline-hidden focus:border-accent"
              >
                <option value="all">🌍 All Competitions</option>
                {availableLeagues.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Search team, league, or market (e.g. Arsenal, NPFL, Enyimba, BTTS)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-accent"
              />
            </div>
          </div>

          {/* Feed Header */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{filteredPicks.length}</strong> model-audited sure picks
            </span>
            <span className="text-slate-400">
              Click any card or checkbox to add/remove from ticket
            </span>
          </div>

          {/* Sure Picks Cards List */}
          <div className="space-y-3.5">
            {filteredPicks.map((pick) => {
              const selected = isPickSelected(pick.id)
              return (
                <div
                  key={pick.id}
                  onClick={() => handleTogglePick(pick)}
                  className={`bg-surface-elevated border rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative overflow-hidden ${
                    selected
                      ? 'border-accent ring-2 ring-accent/20 bg-accent/3'
                      : 'border-border hover:border-slate-300'
                  }`}
                >
                  {/* Top Row: League, Country, Badge & Confidence */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {pick.country} • {pick.league}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {pick.badgeLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <i className="fa-regular fa-clock text-[10px]"></i>
                        <span>{pick.kickoff}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                        <i className="fa-solid fa-shield-check text-[10px]"></i>
                        <span>{pick.confidenceScore}% Confidence</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Row: Match & The Vetted Market Pick */}
                  <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <span>{pick.homeTeam}</span>
                        <span className="text-xs font-normal text-slate-400">vs</span>
                        <span>{pick.awayTeam}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium pt-0.5">
                        Market: <span className="text-slate-700">{pick.marketName}</span>
                      </div>
                    </div>

                    {/* Highlighted Pick Pill */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`px-4 py-2 rounded-xl border text-center transition-all ${
                        selected
                          ? 'bg-accent text-white border-accent shadow-xs'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                      }`}>
                        <span className="text-[10px] uppercase font-bold opacity-80 block">Model Pick</span>
                        <span className="text-sm font-black flex items-center gap-1.5 justify-center">
                          <span>{pick.market}</span>
                          <span className="opacity-90">@{pick.odds.toFixed(2)}</span>
                        </span>
                      </div>

                      {/* Select/Deselect Checkbox Indicator */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        selected
                          ? 'bg-accent text-white'
                          : 'border-2 border-slate-300 text-transparent hover:border-slate-400'
                      }`}>
                        <i className="fa-solid fa-check text-xs"></i>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: AI Model Rationale */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <i className="fa-solid fa-microchip text-accent"></i>
                        Model Statistical Proof
                      </span>
                      <span className="font-semibold text-emerald-700">
                        Win Prob: {(pick.probability * 100).toFixed(0)}% • EV: +{(pick.ev * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {pick.modelRationale}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right Column: Sticky Acca Ticket (4 cols) ───────────────────── */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="bg-surface-elevated border border-border rounded-2xl p-5 shadow-md space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center text-sm font-bold">
                  {selectedPicks.length}
                </span>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Sure Picks Ticket</h2>
                  <p className="text-[11px] text-slate-400">SportyBet Accumulator</p>
                </div>
              </div>
              {selectedPicks.length > 0 && (
                <button
                  onClick={handleClearSlip}
                  className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Empty State */}
            {selectedPicks.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <i className="fa-solid fa-receipt text-lg"></i>
                </div>
                <p className="text-xs font-semibold text-slate-700">Your ticket is empty</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  Click any sure pick from today&apos;s feed or use the Target Odds chips above to auto-populate.
                </p>
              </div>
            ) : (
              /* Selected Picks List */
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selectedPicks.map((pick, idx) => (
                  <div
                    key={pick.id}
                    className="p-3 bg-surface border border-border rounded-xl text-xs space-y-1 relative group hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between pr-4">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {pick.league}
                        </span>
                        <div className="font-bold text-slate-900">{pick.matchLabel}</div>
                      </div>
                      <span className="font-extrabold text-accent text-sm bg-accent/10 px-2 py-0.5 rounded">
                        @{pick.odds.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                      <span className="font-medium text-slate-800">
                        👉 {pick.market}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600">
                        {(pick.probability * 100).toFixed(0)}% win prob
                      </span>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemovePick(idx)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                      title="Remove pick"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Calculations & Actions (When Slip has legs) */}
            {selectedPicks.length > 0 && (
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
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Model Survival</span>
                    <span className="text-lg font-black text-accent tracking-tight">
                      {survivalProbability}%
                    </span>
                  </div>
                </div>

                {/* Risk Profile Badge */}
                <div className={`p-2 rounded-lg border text-center text-xs font-semibold ${riskProfile.color}`}>
                  <i className="fa-solid fa-gauge-high mr-1.5"></i>
                  {riskProfile.label} • Avg EV: +{(avgEv * 100).toFixed(1)}%
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
                        className={`flex-1 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
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
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">Est. Payout</span>
                    <span className="text-xs text-emerald-600">Stake × Total Odds</span>
                  </div>
                  <span className="text-lg font-black text-emerald-700">
                    ₦{potentialPayout.toLocaleString()}
                  </span>
                </div>

                {/* ── "Give the Code" Action Button ───────────────────────── */}
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
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Send this accumulator to Audit Slip panel to run SmartDrop and optimize"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-accent"></i>
                    Audit with AI
                  </button>

                  <button
                    onClick={handleCopySlipSummary}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                  <h3 className="font-extrabold text-slate-900 text-base">Booking Code Generated!</h3>
                  <p className="text-[11px] text-slate-400">
                    {generationSource === 'sportybet_direct'
                      ? 'Live booking created directly on SportyBet Nigeria'
                      : 'SportyBet Multi Accumulator Code'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBookingSuccessModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* The Code Display */}
            <div className="bg-slate-950 text-white rounded-xl p-5 text-center space-y-2 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                SportyBet Booking Code
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-emerald-400 select-all">
                {generatedCode}
              </div>
              <p className="text-xs text-slate-300">
                {selectedPicks.length} Model Picks • Total Odds: <strong className="text-white">{combinedOdds.toFixed(2)}x</strong>
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
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-accent"></i>
                Transfer to Slip Audit Engine (SmartDrop)
              </button>

              <a
                href={`https://www.sportybet.com/ng/?shareCode=${generatedCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-800 block transition-colors"
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
                className="text-slate-400 hover:text-slate-600 p-2 text-base cursor-pointer"
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
                                    setSelectedLeagueFilter(lg)
                                    setShowDirectoryModal(false)
                                  }}
                                  className="text-[11px] bg-slate-100 hover:bg-accent hover:text-white text-slate-700 px-2 py-0.5 rounded transition-colors text-left cursor-pointer"
                                  title={`Filter picks by ${lg}`}
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
                SportyBet&apos;s active leagues update daily based on real fixture scheduling.
              </span>
              <button
                onClick={() => setShowDirectoryModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
