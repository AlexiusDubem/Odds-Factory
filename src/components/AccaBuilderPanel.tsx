import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  DAILY_SURE_PICKS,
  type DailySurePick,
  type DiscoveredCompetition,
  type MarketFamily,
} from '../data/sportybetCompetitions'
import type { Slip, SlipLeg } from '../types'
import { MatchIntelligenceModal } from './MatchIntelligenceModal'
import {
  challengeSelection,
  generateEvidenceRationale,
  type ChallengeResult,
} from '../engine/aiSelectionChallenger'
import { batchGenerateEvidenceRationales } from '../engine/geminiService'

interface Props {
  onSendToAudit?: (slip: Slip) => void
}

export type LeagueScope = 'major' | 'small' | 'all'
export type MatchDuration = 'today' | 'midnight' | '3days' | '1week'
export type RiskLevel = 1 | 2 | 3 | 4 | 5

interface RiskConfig {
  label: string
  tag: string
  icon: string
  color: string
  badgeBg: string
  badgeBorder: string
  trackColor: string
  tiers: number[]
  minOdds: number
  maxOdds: number
  minProb: number
  desc: string
}

const RISK_CONFIG: Record<RiskLevel, RiskConfig> = {
  1: {
    label: 'Ultra Safe',
    tag: 'BANKER LOCKS',
    icon: 'fa-solid fa-shield-halved',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    trackColor: '#10B981',
    tiers: [1],
    minOdds: 1.08,
    maxOdds: 1.25,
    minProb: 0.78,
    desc: 'Very small individual odds, highest probability locks. Maximizes ticket survival.',
  },
  2: {
    label: 'Safe',
    tag: 'STEADY ACCA',
    icon: 'fa-solid fa-circle-check',
    color: 'text-teal-700',
    badgeBg: 'bg-teal-50',
    badgeBorder: 'border-teal-200',
    trackColor: '#0D9488',
    tiers: [1, 2],
    minOdds: 1.20,
    maxOdds: 1.45,
    minProb: 0.68,
    desc: 'Solid banker selections with healthy odds. Best balance for daily accumulators.',
  },
  3: {
    label: 'Balanced',
    tag: 'BALANCED MULTI',
    icon: 'fa-solid fa-scale-balanced',
    color: 'text-blue-700',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
    trackColor: '#3B82F6',
    tiers: [1, 2, 3],
    minOdds: 1.35,
    maxOdds: 1.65,
    minProb: 0.58,
    desc: 'Mix of solid favorites and value opportunities. Good return with controlled risk.',
  },
  4: {
    label: 'Daring',
    tag: 'PUNCHY PICKS',
    icon: 'fa-solid fa-fire',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
    trackColor: '#F59E0B',
    tiers: [2, 3],
    minOdds: 1.50,
    maxOdds: 1.85,
    minProb: 0.52,
    desc: 'Higher odds per match. Allows hitting 10x-20x odds in fewer games.',
  },
  5: {
    label: 'High Risk',
    tag: 'MAX MULTIPLIER',
    icon: 'fa-solid fa-bolt',
    color: 'text-rose-700',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    trackColor: '#EF4444',
    tiers: [3],
    minOdds: 1.65,
    maxOdds: 1.95,
    minProb: 0.48,
    desc: 'Bold straight wins, Over 2.5 and BTTS. Big potential returns for audacious tickets.',
  },
}

export function AccaBuilderPanel({ onSendToAudit }: Props) {
  // Real live picks from SportyBet
  const [allLivePicks, setAllLivePicks] = useState<DailySurePick[]>(DAILY_SURE_PICKS)
  const [discoveredCompetitions, setDiscoveredCompetitions] = useState<DiscoveredCompetition[]>([])
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true)
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false)

  // ── User Conditions ────────────────────────────────────────────────────────
  const [duration, setDuration] = useState<MatchDuration>('today')
  const [leagueScope, setLeagueScope] = useState<LeagueScope>('all')
  const [marketFamily, setMarketFamily] = useState<MarketFamily>('all')
  const [numGames, setNumGames] = useState<number>(6)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(2)
  const [useTargetOdds, setUseTargetOdds] = useState<boolean>(false)
  const [targetOdds, setTargetOdds] = useState<number>(10.0)
  const [customOddsInput, setCustomOddsInput] = useState<string>('10.0')
  const [stake, setStake] = useState<number>(1000)

  // ── Generation State ───────────────────────────────────────────────────────
  const [hasGenerated, setHasGenerated] = useState<boolean>(false)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [chosenPicks, setChosenPicks] = useState<DailySurePick[]>([])

  // ── Match Intelligence & AI Challenger State ────────────────────────────────
  const [inspectingPick, setInspectingPick] = useState<DailySurePick | null>(null)
  const [isChallenging, setIsChallenging] = useState<boolean>(false)
  const [challengeResults, setChallengeResults] = useState<Record<string, ChallengeResult>>({})

  // ── Booking Code State ─────────────────────────────────────────────────────
  const [isBooking, setIsBooking] = useState(false)
  const [bookingCode, setBookingCode] = useState<string | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  const todayDateString = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }, [])

  const currentRisk = RISK_CONFIG[riskLevel]

  const estimatedOdds = useMemo(() => {
    const midOdd = (currentRisk.minOdds + currentRisk.maxOdds) / 2
    return Math.pow(midOdd, numGames)
  }, [numGames, currentRisk])

  // ── Fetch Real Live Matches from SportyBet API ────────────────────────────

  const fetchLiveSportyBetMatches = useCallback(
    async (selectedDuration: MatchDuration = duration) => {
      setIsLoadingLive(true)
      try {
        let res = await fetch(`/api/local/today-sure-picks?duration=${selectedDuration}`).catch(() => null)
        if (!res || !res.ok) {
          res = await fetch(`/api/today-sure-picks?duration=${selectedDuration}`).catch(() => null)
        }
        if (!res || !res.ok) {
          res = await fetch(`http://localhost:3001/today-sure-picks?duration=${selectedDuration}`).catch(() => null)
        }

        if (res && res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.picks) && data.picks.length > 0) {
            setAllLivePicks(data.picks)
            if (Array.isArray(data.competitions)) {
              setDiscoveredCompetitions(data.competitions)
            }
            setIsLiveConnected(true)
            setIsLoadingLive(false)
            return
          }
        }
      } catch {
        // Fallback to verified pool
      }

      setAllLivePicks(DAILY_SURE_PICKS)
      setIsLiveConnected(false)
      setIsLoadingLive(false)
    },
    [duration]
  )

  useEffect(() => {
    fetchLiveSportyBetMatches(duration)
  }, [duration, fetchLiveSportyBetMatches])

  const handleDurationChange = (newDur: MatchDuration) => {
    setDuration(newDur)
    setHasGenerated(false)
    fetchLiveSportyBetMatches(newDur)
  }

  // ── The Analysis & Generation Algorithm ───────────────────────────────────

  const handleRunAnalysisAndGenerate = () => {
    setIsAnalyzing(true)
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)

    setTimeout(() => {
      const risk = RISK_CONFIG[riskLevel]

      // 1. Filter candidates by duration, league preference, market family, and risk band
      let candidates = allLivePicks.filter((p) => {
        if (p.hoursFromNow !== undefined) {
          if (duration === 'today' && p.hoursFromNow > 24) return false
          if (duration === '3days' && p.hoursFromNow > 72) return false
          if (duration === 'midnight') {
            if (p.estimateStartTime) {
              const d = new Date(p.estimateStartTime)
              const watHour = (d.getUTCHours() + 1) % 24
              const isNightHour = watHour >= 22 || watHour < 6
              if (!isNightHour) return false
            } else {
              const lowerKo = (p.kickoff || '').toLowerCase()
              const isNightText = ['22:', '23:', '00:', '01:', '02:', '03:', '04:', '05:'].some(h => lowerKo.includes(h))
              if (!isNightText) return false
            }
            if (p.hoursFromNow > 28 || p.hoursFromNow < -2) return false
          }
          if (p.hoursFromNow > 168) return false
        }
        if (leagueScope === 'major' && p.leagueScope && p.leagueScope !== 'major') return false
        if (leagueScope === 'small' && p.leagueScope && p.leagueScope === 'major') return false
        if (marketFamily !== 'all' && p.marketFamily && p.marketFamily !== marketFamily) return false
        if (p.confidenceTier && !risk.tiers.includes(p.confidenceTier)) return false
        if (p.odds < risk.minOdds || p.odds > risk.maxOdds) return false
        if (p.probability < risk.minProb) return false
        return true
      })

      // Fallback: relax slightly if pool is constrained
      if (candidates.length < numGames) {
        candidates = allLivePicks.filter((p) => {
          if (p.hoursFromNow !== undefined) {
            if (duration === 'today' && p.hoursFromNow > 24) return false
            if (duration === '3days' && p.hoursFromNow > 72) return false
            if (p.hoursFromNow > 168) return false
          }
          if (leagueScope === 'major' && p.leagueScope && p.leagueScope !== 'major') return false
          if (leagueScope === 'small' && p.leagueScope && p.leagueScope === 'major') return false
          if (marketFamily !== 'all' && p.marketFamily && p.marketFamily !== marketFamily) return false
          if (p.odds < risk.minOdds * 0.85 || p.odds > risk.maxOdds * 1.25) return false
          return true
        })
      }

      if (candidates.length === 0) candidates = allLivePicks

      // 2. Target leg calculation
      const idealLegOdds = useTargetOdds
        ? Math.pow(targetOdds, 1 / numGames)
        : (risk.minOdds + risk.maxOdds) / 2

      candidates.sort((a, b) => {
        const distA = Math.abs(a.odds - idealLegOdds)
        const distB = Math.abs(b.odds - idealLegOdds)
        if (Math.abs(distA - distB) > 0.04) return distA - distB
        return b.probability - a.probability
      })

      // 3. Select exactly numGames (strictly unique eventIds)
      // Enforce balanced variety: cap Under markets so tickets are not excessively flooded with Under bets
      const usedEvents = new Set<string>()
      const selected: DailySurePick[] = []
      let underPicksCount = 0
      const maxAllowedUnder = numGames >= 7 ? 2 : 1

      for (const pick of candidates) {
        if (usedEvents.has(pick.eventId)) continue

        const isUnder =
          pick.market.toLowerCase().includes('under') ||
          (pick.marketName && pick.marketName.toLowerCase().includes('under'))

        if (isUnder && underPicksCount >= maxAllowedUnder) {
          continue
        }

        selected.push(pick)
        usedEvents.add(pick.eventId)
        if (isUnder) underPicksCount++
        if (selected.length >= numGames) break
      }

      // 4. Fill up if we are short
      if (selected.length < numGames) {
        for (const pick of candidates) {
          if (!usedEvents.has(pick.eventId)) {
            selected.push(pick)
            usedEvents.add(pick.eventId)
            if (selected.length >= numGames) break
          }
        }
      }

      // Enrich every selected pick with real evidence-backed rationale
      const enriched = selected.map((p) => ({
        ...p,
        modelRationale: generateEvidenceRationale(p, allLivePicks),
      }))

      setChosenPicks(enriched)
      setHasGenerated(true)
      setIsAnalyzing(false)

      // Query Gemini in background to enhance all selected legs with live sports proof
      batchGenerateEvidenceRationales(enriched).then((geminiMap) => {
        if (geminiMap && Object.keys(geminiMap).length > 0) {
          setChosenPicks((prev) =>
            prev.map((p) => (geminiMap[p.id] ? { ...p, modelRationale: geminiMap[p.id] } : p))
          )
        }
      })
    }, 450)
  }

  // ── Ticket Calculations ───────────────────────────────────────────────────

  const combinedOdds = useMemo(() => {
    if (chosenPicks.length === 0) return 1.0
    return chosenPicks.reduce((acc, p) => acc * p.odds, 1.0)
  }, [chosenPicks])

  const survivalProbability = useMemo(() => {
    if (chosenPicks.length === 0) return 100
    const raw = chosenPicks.reduce((acc, p) => acc * p.probability, 1.0) * 100
    return Math.max(0.1, Number(raw.toFixed(1)))
  }, [chosenPicks])

  const potentialPayout = useMemo(() => {
    return Math.round(stake * combinedOdds)
  }, [stake, combinedOdds])

  const handleRemovePick = (pickId: string) => {
    setChosenPicks((prev) => prev.filter((p) => p.id !== pickId))
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)
    setChallengeResults((prev) => {
      const next = { ...prev }
      delete next[pickId]
      return next
    })
  }

  // ── AI Selection Challenger & Market Swapper ──────────────────────────────
  const handleRunAIChallenger = () => {
    setIsChallenging(true)
    setTimeout(() => {
      const results: Record<string, ChallengeResult> = {}
      for (const pick of chosenPicks) {
        results[pick.id] = challengeSelection(pick, allLivePicks)
      }
      setChallengeResults(results)
      setIsChallenging(false)
    }, 350)
  }

  const handleApplySwap = (originalPickId: string, newPick: DailySurePick) => {
    const enriched = {
      ...newPick,
      modelRationale: generateEvidenceRationale(newPick, allLivePicks),
    }
    setChosenPicks((prev) =>
      prev.map((p) => (p.id === originalPickId ? enriched : p))
    )
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)
    setChallengeResults((prev) => {
      const next = { ...prev }
      delete next[originalPickId]
      return next
    })
  }

  const handleSelectOutcomeFromModal = (newPick: DailySurePick) => {
    const enriched = {
      ...newPick,
      modelRationale: generateEvidenceRationale(newPick, allLivePicks),
    }
    setChosenPicks((prev) => {
      const exists = prev.some((p) => p.eventId === newPick.eventId)
      if (exists) {
        return prev.map((p) => (p.eventId === newPick.eventId ? enriched : p))
      }
      return [...prev, enriched]
    })
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)
  }

  // ── Generate Real SportyBet Booking Code ──────────────────────────────────
  // Note: NEVER falls back to random fake strings. Extracts authentic codes only.

  const handleGenerateRealBookingCode = async () => {
    if (chosenPicks.length === 0) return
    setIsBooking(true)
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)

    const selections = chosenPicks.map((pick) => ({
      eventId: pick.eventId,
      marketId: pick.marketId,
      outcomeId: pick.outcomeId,
      specifier: pick.specifier || '',
    }))

    try {
      // 1. Try local dev proxy (/api/local/book)
      let res = await fetch('/api/local/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      }).catch(() => null)

      // 2. Try direct local port 3001
      if (!res || !res.ok) {
        res = await fetch('http://localhost:3001/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selections }),
        }).catch(() => null)
      }

      // 3. Try Vercel Serverless Function (/api/book)
      if (!res || !res.ok) {
        res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selections }),
        }).catch(() => null)
      }

      if (res && res.ok) {
        const data = await res.json()
        const code = data.shareCode || data.data?.shareCode || data.raw?.data?.shareCode
        const url =
          data.shareURL ||
          data.data?.shareURL ||
          (code ? `https://www.sportybet.com/ng/?shareCode=${code}` : null)

        if (code) {
          setBookingCode(code)
          setShareUrl(url)
          setShowCodeModal(true)
          setIsBooking(false)
          return
        } else if (data.error || data.message) {
          throw new Error(data.error || data.message)
        }
      }

      throw new Error(
        'SportyBet could not generate a booking code. A market or outcome may have just closed.'
      )
    } catch (err: any) {
      console.error('Booking failed:', err)
      setBookingError(
        err.message || 'Unable to book ticket on SportyBet. Please re-generate with fresh picks.'
      )
      setShowCodeModal(true)
      setIsBooking(false)
    }
  }

  const handleCopyCode = () => {
    if (!bookingCode) return
    navigator.clipboard.writeText(bookingCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2500)
  }

  const handleCopySummary = () => {
    if (chosenPicks.length === 0) return
    const text = [
      `ODDS FACTORY SURE PICKS (${todayDateString.toUpperCase()})`,
      `Total Odds: ${combinedOdds.toFixed(2)}x • Model Survival: ${survivalProbability}%`,
      `Stake: ₦${stake.toLocaleString()} • Return: ₦${potentialPayout.toLocaleString()}`,
      ...(bookingCode ? [`SportyBet Booking Code: ${bookingCode}`] : []),
      '',
      ...chosenPicks.map(
        (p, i) => `${i + 1}. ${p.matchLabel} (${p.league})\n   Selection: ${p.market} @${p.odds.toFixed(2)} (${p.kickoff})`
      ),
      '',
      `Generated with Odds Factory AI`,
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2500)
  }

  const handleSendToAudit = () => {
    if (chosenPicks.length === 0) return

    const legs: SlipLeg[] = chosenPicks.map((p, idx) => ({
      id: `sure-leg-${idx + 1}-${Date.now()}`,
      matchId: p.eventId,
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
      name: `AI Sure Picks (${todayDateString}) @${combinedOdds.toFixed(2)}x`,
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans">
      {/* ── Dottaa Studio Hero Header ────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-10 shadow-[0_2px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 text-[11px] font-bold tracking-tight">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real Live SportyBet Engine</span>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-500">{todayDateString}</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>
              {isLoadingLive
                ? 'Discovering competitions & markets…'
                : isLiveConnected
                ? `${discoveredCompetitions.length || 36} leagues • ${allLivePicks.length} markets audited`
                : 'Model engine ready'}
            </span>
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-[1.08] mb-3">
          Considered Picks. <br className="hidden sm:inline" />
          <span className="text-zinc-400 font-semibold">Real Booking Codes.</span>
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 max-w-2xl leading-relaxed">
          Dynamic SportyBet competition & market discovery. Filter across Goals, Corners, Cards, Handicaps, and Match Results to assemble mathematically sound tickets with real booking codes.
        </p>
      </div>

      {/* ── Main Bento Configuration Box ──────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-zinc-950 text-sm"></i>
              Configure Ticket Conditions
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tune your timeframe, leagues, market type, and risk appetite.
            </p>
          </div>
          <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400 bg-zinc-50 border border-zinc-200/60 px-2.5 py-1 rounded-full">
            STEP 01
          </span>
        </div>

        {/* 1. Timeframe & League Scope Segmented Pills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Timeframe */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                Match Timeframe
              </label>
              <span className="text-[10px] text-zinc-500 font-semibold">
                {duration === 'today' ? 'Kickoff in <24h' : duration === 'midnight' ? '10:00 PM – 6:00 AM Night Slate' : duration === '3days' ? 'Weekend slate' : 'Max 7 days'}
              </span>
            </div>
            <div className="bg-zinc-100/80 p-1.5 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-1 border border-zinc-200/60">
              {([
                ['today', 'fa-solid fa-bolt', 'Today', 'Next 24h'],
                ['midnight', 'fa-solid fa-moon text-indigo-500', 'Midnight', '10 PM - 6 AM'],
                ['3days', 'fa-solid fa-calendar-days', '3 Days', 'Weekend'],
                ['1week', 'fa-solid fa-calendar-week', '1 Week', 'Max 7d'],
              ] as const).map(([val, icon, label, sub]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleDurationChange(val)}
                  className={`py-2 px-2 rounded-xl text-center transition-all cursor-pointer ${
                    duration === val
                      ? 'bg-white text-zinc-950 shadow-xs font-black'
                      : 'text-zinc-600 hover:text-zinc-950 font-bold hover:bg-white/50'
                  }`}
                >
                  <div className="text-xs flex items-center justify-center gap-1.5 leading-none">
                    <i className={`${icon} text-[11px]`}></i>
                    <span>{label}</span>
                  </div>
                  <div className="text-[9px] text-zinc-400 mt-1 font-semibold">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* League Scope */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                League Preference
              </label>
              <span className="text-[10px] text-zinc-500 font-semibold">
                {leagueScope === 'major'
                  ? 'Top European (EPL, UCL…)'
                  : leagueScope === 'small'
                  ? 'Secondary & Regional (NPFL…)'
                  : `All Discovered (${discoveredCompetitions.length || '30+'} Leagues)`}
              </span>
            </div>
            <div className="bg-zinc-100/80 p-1.5 rounded-2xl grid grid-cols-3 gap-1 border border-zinc-200/60">
              {([
                ['major', 'fa-solid fa-trophy', 'Major', 'EPL, UCL…'],
                ['small', 'fa-solid fa-earth-africa', 'Small', 'NPFL, Cups'],
                ['all', 'fa-solid fa-globe', 'All', `${discoveredCompetitions.length || 'All'} Leagues`],
              ] as const).map(([val, icon, label, sub]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setLeagueScope(val)}
                  className={`py-2 px-2 rounded-xl text-center transition-all cursor-pointer ${
                    leagueScope === val
                      ? 'bg-white text-zinc-950 shadow-xs font-black'
                      : 'text-zinc-600 hover:text-zinc-950 font-bold hover:bg-white/50'
                  }`}
                >
                  <div className="text-xs flex items-center justify-center gap-1.5 leading-none">
                    <i className={`${icon} text-[11px]`}></i>
                    <span>{label}</span>
                  </div>
                  <div className="text-[9px] text-zinc-400 mt-1 font-semibold">{sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Dynamic Market Families Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Market Family & Category
              </label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Target specific sports markets or discover across all active SportyBet lines.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-full">
              Full Discovery Active
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {([
              ['all', 'fa-solid fa-layer-group', 'All Markets'],
              ['goals', 'fa-solid fa-futbol', 'Goals & Totals'],
              ['match_result', 'fa-solid fa-trophy', 'Match Result / DC'],
              ['btts', 'fa-solid fa-arrows-split-up-and-left', 'Both Score (GG)'],
              ['corners', 'fa-solid fa-flag', 'Corners'],
              ['cards_bookings', 'fa-solid fa-square', 'Cards & Bookings'],
              ['intervals_halves', 'fa-solid fa-stopwatch', 'Halves & Intervals'],
              ['handicap', 'fa-solid fa-scale-unbalanced', 'Handicap'],
              ['cleansheet', 'fa-solid fa-shield-cat', 'Clean Sheet'],
            ] as const).map(([val, icon, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setMarketFamily(val)}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  marketFamily === val
                    ? 'bg-zinc-950 text-white shadow-xs font-black'
                    : 'bg-zinc-100/80 hover:bg-zinc-200/80 text-zinc-600 hover:text-zinc-950 border border-zinc-200/60'
                }`}
              >
                <i className={`${icon} text-[11px]`}></i>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Number of Games Slider (Dottaa Tactile Range) */}
        <div className="bg-zinc-50/70 border border-zinc-200/70 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Number of Games
              </label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Target count of unique matches on the ticket.
              </p>
            </div>
            <div className="text-right">
              <span className="text-4xl font-black text-zinc-950 tracking-tight leading-none">
                {numGames}
              </span>
              <span className="text-xs font-bold text-zinc-400 ml-1">games</span>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={numGames}
              onChange={(e) => setNumGames(Number(e.target.value))}
              className="w-full h-2.5 rounded-full cursor-pointer appearance-none bg-zinc-200 accent-zinc-950"
              style={{
                background: `linear-gradient(to right, #09090b ${
                  ((numGames - 2) / 18) * 100
                }%, #e4e4e7 ${((numGames - 2) / 18) * 100}%)`,
              }}
            />
            <div className="flex justify-between text-[10px] font-bold text-zinc-400 px-0.5">
              <span>2 Games (Punchy)</span>
              <span>10 Games</span>
              <span>20 Games (Max Safe)</span>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase mr-1">Presets:</span>
            {[3, 5, 6, 8, 10, 12, 15].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumGames(n)}
                className={`py-1 px-3 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  numGames === n
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                }`}
              >
                {n} legs
              </button>
            ))}
          </div>
        </div>

        {/* 3. Risk Level Slider (Odds Per Game) */}
        <div className="bg-zinc-50/70 border border-zinc-200/70 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Risk Level & Odds Intensity
              </label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Controls individual match odds range and probability thresholds.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-black ${currentRisk.badgeBg} ${currentRisk.badgeBorder} ${currentRisk.color}`}
            >
              <i className={`${currentRisk.icon} text-xs`}></i>
              <span>{currentRisk.label}</span>
              <span className="text-[10px] opacity-75 font-semibold">
                (~{currentRisk.minOdds.toFixed(2)}–{currentRisk.maxOdds.toFixed(2)}x /leg)
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={riskLevel}
              onChange={(e) => setRiskLevel(Number(e.target.value) as RiskLevel)}
              className="w-full h-2.5 rounded-full cursor-pointer appearance-none"
              style={{
                background: `linear-gradient(to right, ${currentRisk.trackColor} ${
                  ((riskLevel - 1) / 4) * 100
                }%, #e4e4e7 ${((riskLevel - 1) / 4) * 100}%)`,
              }}
            />
            <div className="flex justify-between text-[10px] font-bold px-0.5">
              <span className="text-emerald-700 flex items-center gap-1">
                <i className="fa-solid fa-shield-halved text-[9px]"></i> Ultra Safe
              </span>
              <span className="text-teal-700 flex items-center gap-1">
                <i className="fa-solid fa-circle-check text-[9px]"></i> Safe
              </span>
              <span className="text-blue-700 flex items-center gap-1">
                <i className="fa-solid fa-scale-balanced text-[9px]"></i> Balanced
              </span>
              <span className="text-amber-700 flex items-center gap-1">
                <i className="fa-solid fa-fire text-[9px]"></i> Daring
              </span>
              <span className="text-rose-700 flex items-center gap-1">
                <i className="fa-solid fa-bolt text-[9px]"></i> High Risk
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-600 bg-white border border-zinc-200/70 rounded-xl px-3.5 py-2.5 font-medium leading-relaxed">
            {currentRisk.desc}
          </p>
        </div>

        {/* 4. Live Multiplier Projection & Target Lock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-950 text-white rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Projected Multiplier
              </span>
              <span className="text-[10px] font-semibold text-zinc-400">
                {numGames} games × {currentRisk.label}
              </span>
            </div>
            <div className="my-3">
              <div className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                {estimatedOdds >= 1000000
                  ? `${(estimatedOdds / 1000000).toFixed(1)}M`
                  : estimatedOdds >= 1000
                  ? `${(estimatedOdds / 1000).toFixed(1)}K`
                  : estimatedOdds >= 100
                  ? estimatedOdds.toFixed(0)
                  : estimatedOdds.toFixed(1)}
                <span className="text-2xl text-emerald-400 font-bold ml-1">x</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Estimated odds based on your chosen risk level.
              </p>
            </div>
            <div className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span>Potential Return on ₦{stake.toLocaleString()}:</span>
              <span className="font-bold text-emerald-400">
                ₦{Math.round(stake * estimatedOdds).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/70 rounded-2xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                Lock to Target Odds
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTargetOdds}
                  onChange={(e) => setUseTargetOdds(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-950"></div>
              </label>
            </div>

            <div className={`space-y-2.5 transition-all ${useTargetOdds ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 10, 20, 50].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setTargetOdds(v)
                      setCustomOddsInput(String(v))
                    }}
                    className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      targetOdds === v && useTargetOdds
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {v}x
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1.5"
                max="500"
                step="0.5"
                placeholder="Or enter custom odds…"
                value={customOddsInput}
                onChange={(e) => {
                  setCustomOddsInput(e.target.value)
                  const v = parseFloat(e.target.value)
                  if (v > 1) setTargetOdds(v)
                }}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 text-center focus:outline-none focus:border-zinc-950"
              />
            </div>

            <span className="text-[10px] text-zinc-400">
              {useTargetOdds
                ? `System will assemble ${numGames} matches calibrated to hit ${targetOdds}x.`
                : 'Free mode: model picks the best probability matches in the tier.'}
            </span>
          </div>
        </div>

        {/* 5. Primary Action Button (Dottaa Tactile Pill) */}
        <button
          onClick={handleRunAnalysisAndGenerate}
          disabled={isAnalyzing}
          className="w-full py-4.5 px-6 bg-zinc-950 hover:bg-zinc-800 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin text-emerald-400 text-base"></i>
              <span>Auditing Matches & Assembling Ticket…</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-wand-magic-sparkles text-emerald-400 text-base"></i>
              <span>
                Analyze & Build {numGames} {currentRisk.label} Games
                {useTargetOdds
                  ? ` • ${targetOdds}x Target`
                  : ` • ~${
                      estimatedOdds >= 1000
                        ? `${(estimatedOdds / 1000).toFixed(1)}K`
                        : estimatedOdds.toFixed(1)
                    }x Est.`}
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Generated Ticket Section ──────────────────────────────────────── */}
      {hasGenerated && (
        <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 mb-1.5">
                <i className="fa-solid fa-circle-check text-xs"></i>
                <span>
                  {chosenPicks.length} Games Chosen • {combinedOdds.toFixed(2)}x Total Multiplier
                </span>
              </div>
              <h3 className="text-xl font-black text-zinc-950 tracking-tight">
                Your AI Audited Ticket
              </h3>
              <p className="text-xs text-zinc-500">
                Review each pick below. Click the trash icon to drop any match before booking.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRunAIChallenger}
                disabled={isChallenging}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isChallenging ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-emerald-400 text-xs"></i>
                    <span>Challenging Markets…</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles text-emerald-400 text-xs"></i>
                    <span>AI Challenge Markets</span>
                  </>
                )}
              </button>
              <button
                onClick={handleRunAnalysisAndGenerate}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-arrows-rotate text-xs"></i>
                Re-Roll
              </button>
              <button
                onClick={handleSendToAudit}
                className="px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-magnifying-glass-chart text-xs"></i>
                Deep Audit
              </button>
            </div>
          </div>

          {/* Matches List */}
          {chosenPicks.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-3">
              <i className="fa-solid fa-ticket text-4xl text-zinc-300"></i>
              <p className="text-sm font-bold text-zinc-800">You removed all games</p>
              <button
                onClick={handleRunAnalysisAndGenerate}
                className="px-5 py-2.5 bg-zinc-950 text-white text-xs font-black rounded-xl"
              >
                Re-Generate Games
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {chosenPicks.map((pick, idx) => {
                const challenge = challengeResults[pick.id]
                return (
                  <div
                    key={pick.id}
                    className="bg-zinc-50/70 border border-zinc-200/70 hover:border-zinc-300/90 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[10px] font-black">
                            {idx + 1}
                          </span>
                          <span className="text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 px-2.5 py-0.5 rounded-full">
                            {pick.league}
                          </span>
                          {pick.badgeLabel && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              {pick.badgeLabel}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <i className="fa-solid fa-clock text-[9px]"></i>
                            {pick.kickoff}
                          </span>
                          {pick.hoursFromNow !== undefined && (
                            <span className="text-[10px] text-zinc-400 font-semibold">
                              (in {pick.hoursFromNow > 24 ? `${Math.round(pick.hoursFromNow / 24)}d` : `${pick.hoursFromNow}h`})
                            </span>
                          )}
                        </div>

                        <div className="text-base font-extrabold text-zinc-950 tracking-tight">
                          {pick.matchLabel}
                        </div>

                        <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                          {pick.modelRationale}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="bg-white border border-zinc-200 px-4 py-2.5 rounded-2xl text-center shadow-xs">
                          <div className="text-[9px] uppercase font-black text-zinc-400">
                            {pick.marketName}
                          </div>
                          <div className="text-sm font-black text-zinc-950 flex items-center gap-1.5 justify-center">
                            <span>{pick.market}</span>
                            <span className="text-emerald-600 font-black">@{pick.odds.toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] font-bold text-emerald-600">
                            {Math.round(pick.probability * 100)}% Win Probability
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => setInspectingPick(pick)}
                            className="px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            title="Inspect statistics & edit market"
                          >
                            <i className="fa-solid fa-chart-pie text-zinc-500 text-[11px]"></i>
                            <span className="hidden sm:inline">Inspect & Edit</span>
                          </button>
                          <button
                            onClick={() => handleRemovePick(pick.id)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 text-zinc-400 hover:text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            title="Remove this pick"
                          >
                            <i className="fa-solid fa-trash-can text-[11px]"></i>
                            <span className="hidden sm:inline">Drop</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* AI Challenger Verdict Banner */}
                    {challenge && (
                      <div
                        className={`rounded-2xl p-4 border space-y-2.5 transition-all animate-in fade-in duration-200 ${challenge.actionBg} ${challenge.actionBorder}`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white border shadow-xs ${challenge.actionColor}`}
                            >
                              <i className={`${challenge.icon} text-[10px]`}></i>
                              {challenge.actionLabel}
                            </span>
                            <span className="text-xs font-extrabold text-zinc-900">
                              {challenge.title}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-zinc-600">
                            Calculated EV: <span className="font-mono text-zinc-950 font-black">{challenge.evPercentage}</span> • True Prob: <span className="font-mono text-zinc-950 font-black">{Math.round(challenge.trueProbability * 100)}%</span>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-600 leading-relaxed font-normal">
                          {challenge.explanation}
                        </p>

                        {/* Interactive Swap Button */}
                        {challenge.action === 'REPLACE' && challenge.recommendedAlternative && (
                          <div className="pt-1 flex items-center justify-between flex-wrap gap-2 border-t border-amber-200/70">
                            <div className="text-xs font-bold text-amber-950">
                              Proposed Market: <span className="underline decoration-amber-400">{challenge.recommendedAlternative.market}</span> (@{challenge.recommendedAlternative.odds.toFixed(2)})
                            </div>
                            <button
                              onClick={() => handleApplySwap(pick.id, challenge.recommendedAlternative!)}
                              className="py-1.5 px-4 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              <i className="fa-solid fa-shuffle text-amber-400 text-xs"></i>
                              <span>Apply AI Swap</span>
                            </button>
                          </div>
                        )}

                        {challenge.action === 'REMOVE' && (
                          <div className="pt-1 flex justify-end border-t border-rose-200/70">
                            <button
                              onClick={() => handleRemovePick(pick.id)}
                              className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Drop Negative EV Leg
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Ticket Summary & Real Booking Code Bar */}
          {chosenPicks.length > 0 && (
            <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-black block">Total Multiplier</span>
                  <span className="text-2xl font-black text-zinc-950">{combinedOdds.toFixed(2)}x</span>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-black block">Survival Prob</span>
                  <span className="text-2xl font-black text-emerald-600">{survivalProbability}%</span>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-black block">Stake (₦)</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={stake}
                    onChange={(e) => setStake(Math.max(100, Number(e.target.value) || 100))}
                    className="w-full text-center font-black text-lg text-zinc-900 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-emerald-800 uppercase font-black block">Est. Payout</span>
                  <span className="text-2xl font-black text-emerald-700">₦{potentialPayout.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <button
                  onClick={handleGenerateRealBookingCode}
                  disabled={isBooking}
                  className="flex-1 w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  {isBooking ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-base"></i>
                      <span>Generating Live SportyBet Code…</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ticket text-base"></i>
                      <span>Generate Real SportyBet Booking Code</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopySummary}
                  className="w-full sm:w-auto py-4 px-5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className={`fa-solid ${copiedSummary ? 'fa-check text-emerald-600' : 'fa-share-nodes'}`}></i>
                  <span>{copiedSummary ? 'Copied Summary!' : 'Copy Summary'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dottaa-style Booking Code Modal / Bottom Sheet ─────────────────── */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 rounded-[32px] p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setShowCodeModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center cursor-pointer transition-colors"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>

            {bookingCode ? (
              <>
                <div className="text-center space-y-2 pt-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-xl shadow-xs">
                    <i className="fa-solid fa-ticket"></i>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
                    Official SportyBet Booking Code
                  </span>
                  <h3 className="text-2xl font-black text-zinc-950 tracking-tight">
                    Code Ready To Load!
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {chosenPicks.length} Games • {combinedOdds.toFixed(2)}x Combined Multiplier
                  </p>
                </div>

                {/* Big Code Card */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    SportyBet Booking Code
                  </span>
                  <div className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-zinc-950 select-all">
                    {bookingCode}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold block">
                    Valid for all SportyBet platforms (App & Web)
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  <button
                    onClick={handleCopyCode}
                    className="w-full py-3.5 px-4 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className={`fa-solid ${copiedCode ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    <span>{copiedCode ? 'Copied Code to Clipboard!' : 'Copy Real Booking Code'}</span>
                  </button>

                  <button
                    onClick={handleSendToAudit}
                    className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-emerald-400"></i>
                    <span>Open in Slip Auditor & Editor</span>
                  </button>

                  {shareUrl && (
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 text-center"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                      <span>Open Direct on SportyBet.com</span>
                    </a>
                  )}
                </div>

                {/* 3 Step Guide */}
                <div className="bg-zinc-50 border border-zinc-200/70 rounded-xl p-3.5 text-xs text-zinc-600 space-y-1.5">
                  <div className="font-bold text-zinc-900 text-[11px] uppercase tracking-wide">
                    How to load this code:
                  </div>
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="font-bold text-zinc-950">1.</span>
                    <span>Open SportyBet app or visit SportyBet.com</span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="font-bold text-zinc-950">2.</span>
                    <span>Tap <strong>Betslip</strong> → tap <strong>Load Code</strong></span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="font-bold text-zinc-950">3.</span>
                    <span>Paste <strong>{bookingCode}</strong> and place bet!</span>
                  </div>
                </div>
              </>
            ) : (
              /* Booking Error State */
              <div className="text-center space-y-4 pt-2">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center text-xl">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 className="text-xl font-black text-zinc-950">
                  Could Not Generate Code
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed bg-rose-50 border border-rose-200/70 p-3 rounded-xl">
                  {bookingError || 'SportyBet rejected one of the selections. Odds may have shifted or the match kickoff has passed.'}
                </p>
                <button
                  onClick={() => {
                    setShowCodeModal(false)
                    handleRunAnalysisAndGenerate()
                  }}
                  className="w-full py-3 px-4 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs rounded-xl cursor-pointer"
                >
                  Re-Roll Fresh Picks & Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Match Intelligence & Market Inspection Modal ──────────────────── */}
      {inspectingPick && (
        <MatchIntelligenceModal
          matchPick={inspectingPick}
          allEventPicks={allLivePicks}
          onSelectOutcome={handleSelectOutcomeFromModal}
          onClose={() => setInspectingPick(null)}
        />
      )}
    </div>
  )
}
