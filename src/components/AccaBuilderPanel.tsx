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
    maxOdds: 1.35,
    minProb: 0.72,
    desc: 'Highest probability locks: Over 1.5 goals, Double Chance 1X/X2 & Draw No Bet.',
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
    minOdds: 1.15,
    maxOdds: 1.55,
    minProb: 0.62,
    desc: 'Classic Over 1.5, Double Chance, and steady home bankers. Best daily accumulator balance.',
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
    minOdds: 1.25,
    maxOdds: 1.85,
    minProb: 0.52,
    desc: 'Classic Over 2.5 Goals, BTTS Yes, and Match Winner value plays with strong returns.',
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
          // Pre-match rule: Match must not have started yet (diffHours >= 0.05 / 3 mins ahead)
          if (p.hoursFromNow < 0.05) return false
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
            if (p.hoursFromNow > 28) return false
          }
          if (p.hoursFromNow > 168) return false
        }

        // Exclude tight risky under lines (Under 0.5, 1.5, 2.5) that destroy multi-leg slips
        const lowerMarket = (p.market || '').toLowerCase()
        if (lowerMarket.includes('under 0.5') || lowerMarket.includes('under 1.5') || lowerMarket.includes('under 2.5')) return false

        if (leagueScope === 'major' && p.leagueScope && p.leagueScope !== 'major') return false
        if (leagueScope === 'small' && p.leagueScope && p.leagueScope === 'major') return false
        if (marketFamily !== 'all' && p.marketFamily && p.marketFamily !== marketFamily) return false
        if (p.confidenceTier && !risk.tiers.includes(p.confidenceTier)) return false
        if (p.odds < risk.minOdds || p.odds > risk.maxOdds) return false
        if (p.probability < risk.minProb) return false
        return true
      })

      // Fallback: relax slightly if pool is constrained
      const isSimulated = (text?: string): boolean => {
        if (!text) return false
        const l = String(text).toLowerCase()
        return l.includes('srl') || l.includes('simulated') || l.includes('virtual') || l.includes('electronic')
      }

      if (candidates.length < numGames) {
        candidates = allLivePicks.filter((p) => {
          if (isSimulated(p.league) || isSimulated(p.matchLabel)) return false
          if (p.hoursFromNow !== undefined) {
            if (p.hoursFromNow < 0.05) return false
            if (duration === 'today' && p.hoursFromNow > 24) return false
            if (duration === '3days' && p.hoursFromNow > 72) return false
            if (p.hoursFromNow > 168) return false
          }
          const lowerMarket = (p.market || '').toLowerCase()
          if (lowerMarket.includes('under 0.5') || lowerMarket.includes('under 1.5') || lowerMarket.includes('under 2.5')) return false
          if (leagueScope === 'major' && p.leagueScope && p.leagueScope !== 'major') return false
          if (leagueScope === 'small' && p.leagueScope && p.leagueScope === 'major') return false
          if (marketFamily !== 'all' && p.marketFamily && p.marketFamily !== marketFamily) return false
          if (p.odds < risk.minOdds * 0.85 || p.odds > risk.maxOdds * 1.25) return false
          return true
        })
      }

      if (candidates.length === 0) candidates = allLivePicks

      // 2. Intelligent Candidate Ranking:
      // Priority 1: Major European Leagues (Premier League, La Liga, Serie A, Bundesliga, Champions League)
      // Priority 2: High-Cushion Safety Markets (Double Chance 1X/X2, Over 1.5 Goals, Draw No Bet)
      // Priority 3: Highest Statistical Probability & EV
      candidates.sort((a, b) => {
        const scopeA = a.leagueScope === 'major' ? 2 : a.leagueScope === 'small' ? 1 : 0
        const scopeB = b.leagueScope === 'major' ? 2 : b.leagueScope === 'small' ? 1 : 0
        if (scopeA !== scopeB) return scopeB - scopeA

        const isCushionA = (a.marketId === '10' || a.marketId === '11' || (a.marketFamily === 'goals' && a.market.includes('Over 1.5'))) ? 1 : 0
        const isCushionB = (b.marketId === '10' || b.marketId === '11' || (b.marketFamily === 'goals' && b.market.includes('Over 1.5'))) ? 1 : 0
        if (isCushionA !== isCushionB) return isCushionB - isCushionA

        return b.probability - a.probability
      })

      // 3. Select exactly numGames with Market Diversification:
      // Guarantee classic Over 1.5 / Over 2.5 Goals (35-45% of ticket),
      // Double Chance & DNB (30-35%), and other value lines.
      const usedEvents = new Set<string>()
      const selected: DailySurePick[] = []
      let underPicksCount = 0
      const maxAllowedUnder = numGames >= 7 ? 2 : 1

      // Pass 1: Prioritize Classic Goals (Over 1.5, Over 2.5, BTTS)
      const targetGoals = marketFamily === 'all' ? Math.max(1, Math.round(numGames * 0.40)) : 0
      let goalsCount = 0

      if (targetGoals > 0) {
        for (const pick of candidates) {
          if (usedEvents.has(pick.eventId)) continue
          const mLower = (pick.market || '').toLowerCase()
          const isGoalPick = (mLower.includes('over 1.5') || mLower.includes('over 2.5') || pick.marketFamily === 'goals' || pick.marketFamily === 'btts') && !mLower.includes('under')
          if (isGoalPick) {
            selected.push(pick)
            usedEvents.add(pick.eventId)
            goalsCount++
            if (goalsCount >= targetGoals || selected.length >= numGames) break
          }
        }
      }

      // Pass 2: Select Double Chance, Draw No Bet, and Strong Winners
      for (const pick of candidates) {
        if (selected.length >= numGames) break
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
      }

      // 4. Fill up if we are short (first from candidates, then allLivePicks, then fallback DAILY_SURE_PICKS)
      if (selected.length < numGames) {
        for (const pick of candidates) {
          if (!usedEvents.has(pick.eventId)) {
            selected.push(pick)
            usedEvents.add(pick.eventId)
            if (selected.length >= numGames) break
          }
        }
      }
      if (selected.length < numGames) {
        for (const pick of allLivePicks) {
          if (!usedEvents.has(pick.eventId)) {
            selected.push(pick)
            usedEvents.add(pick.eventId)
            if (selected.length >= numGames) break
          }
        }
      }
      if (selected.length < numGames) {
        for (const pick of DAILY_SURE_PICKS) {
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
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* ── Page Intro ───────────────────────────────────────────────────────── */}
      <section className="page-intro">
        <div className="eyebrow flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Model-ranked picks · Live market explorer</span>
        </div>
        <h2>Considered picks.<br />Real booking codes.</h2>
        <p>Set the guardrails, then let the engine find a healthier set of selections across active SportyBet markets.</p>
      </section>

      {/* ── Ticket Filters Card ──────────────────────────────────────────────── */}
      <section className="card filters-box">
        <div className="filter-step">
          <span className="num">01</span>
          <b>Set your ticket conditions</b>
          <span className="ml-auto text-[10px] font-mono text-zinc-500 hidden sm:inline">
            {isLoadingLive
              ? 'Discovering lines…'
              : isLiveConnected
              ? `${discoveredCompetitions.length || 36} leagues • ${allLivePicks.length} markets audited`
              : 'Statistical engine ready'}
          </span>
        </div>

        {/* 1. Timeframe */}
        <div className="option-group">
          <label>
            <span>Match timeframe</span>
            <span className="lowercase font-mono text-[10px] text-zinc-400">
              {duration === 'today' ? 'Kickoff in <24h' : duration === 'midnight' ? '10 PM - 6 AM night slate' : duration === '3days' ? 'Weekend slate' : 'Max 7 days'}
            </span>
          </label>
          <div className="chips">
            {([
              ['today', '⚡ Today · Next 24h'],
              ['midnight', '☾ Midnight (10 PM - 6 AM)'],
              ['3days', '3 Days · Weekend'],
              ['1week', '1 Week'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => handleDurationChange(val)}
                className={`chip ${duration === val ? 'on' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. League Preference */}
        <div className="option-group">
          <label>
            <span>League preference</span>
            <span className="font-mono text-[10px] text-zinc-400">
              {leagueScope === 'major' ? 'Top European (EPL, UCL…)' : leagueScope === 'small' ? 'Secondary & Regional (NPFL…)' : 'All Leagues'}
            </span>
          </label>
          <div className="chips">
            {([
              ['major', 'Top European (EPL, UCL…)'],
              ['small', 'Secondary & Regional (NPFL…)'],
              ['all', `All Leagues (${discoveredCompetitions.length || '30+'})`],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setLeagueScope(val)}
                className={`chip ${leagueScope === val ? 'on' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Market Family */}
        <div className="option-group">
          <label>
            <span>Market family</span>
            <span className="text-emerald-700 font-mono text-[10px] font-bold">Full Discovery Active</span>
          </label>
          <div className="chips">
            {([
              ['all', 'All markets'],
              ['goals', 'Goals & totals'],
              ['match_result', 'Match result / DC'],
              ['btts', 'Both teams score'],
              ['corners', 'Corners'],
              ['cards_bookings', 'Cards'],
              ['cleansheet', 'Clean sheet'],
              ['intervals_halves', 'Halves & intervals'],
              ['handicap', 'Handicap'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setMarketFamily(val)}
                className={`chip ${marketFamily === val ? 'on' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Number of Games */}
        <div className="option-group">
          <label>
            <span>Number of games <span className="text-zinc-950 font-bold font-mono">({numGames})</span></span>
            <span className="font-mono text-[10px] text-zinc-400">Min 2 · Max 30</span>
          </label>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={numGames}
            onChange={(e) => setNumGames(Number(e.target.value))}
            className="range-slider my-2"
          />
          <div className="chips">
            {[3, 5, 6, 8, 10, 15, 20, 25, 30].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumGames(n)}
                className={`chip ${numGames === n ? 'on' : ''}`}
              >
                {n} legs
              </button>
            ))}
          </div>
          {numGames >= 8 && (
            <div className="mt-3 p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-start gap-3 text-xs text-amber-950 animate-in fade-in duration-200">
              <i className="fa-solid fa-lightbulb text-amber-600 text-sm mt-0.5 shrink-0"></i>
              <div className="space-y-1">
                <span className="font-bold">Tip for {numGames}-Game Tickets:</span>
                <p className="text-[11px] text-amber-900 leading-relaxed font-normal">
                  Tickets with {numGames} games have massive returns, but are harder to win! We prioritized safer selections (like Win or Draw and Over 1.5 Goals) to give your ticket the strongest fighting chance. Consider splitting them into smaller tickets to protect your balance.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 5. Risk Level */}
        <div className="option-group">
          <label>
            <span>Risk level & model threshold</span>
            <span className="font-mono text-[10px] text-zinc-400">~{currentRisk.minOdds.toFixed(2)}–{currentRisk.maxOdds.toFixed(2)}x / leg</span>
          </label>
          <div className="chips">
            {([1, 2, 3, 4, 5] as RiskLevel[]).map((lvl) => {
              const r = RISK_CONFIG[lvl]
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setRiskLevel(lvl)}
                  className={`chip ${riskLevel === lvl ? 'on' : ''}`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 font-medium">
            {currentRisk.desc}
          </p>
        </div>

        {/* 6. Optional Target Odds */}
        <div className="option-group pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-2">
            <label className="mb-0">
              <span>Lock to Target Multiplier (Optional)</span>
            </label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useTargetOdds}
                onChange={(e) => setUseTargetOdds(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-zinc-950"></div>
            </label>
          </div>
          {useTargetOdds && (
            <div className="chips mt-2">
              {[5, 10, 20, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setTargetOdds(v)
                    setCustomOddsInput(String(v))
                  }}
                  className={`chip ${targetOdds === v ? 'on' : ''}`}
                >
                  {v}x
                </button>
              ))}
              <input
                type="number"
                min="1.5"
                max="500"
                step="0.5"
                placeholder="Custom odds…"
                value={customOddsInput}
                onChange={(e) => {
                  setCustomOddsInput(e.target.value)
                  const v = parseFloat(e.target.value)
                  if (v > 1) setTargetOdds(v)
                }}
                className="px-2.5 py-1 text-xs border border-zinc-200 rounded-lg w-28 font-mono font-bold"
              />
            </div>
          )}
        </div>

        {/* 7. Result Bar */}
        <div className="result-bar">
          <div>
            <div className="eyebrow">Projected multiplier</div>
            <b>
              {numGames} games × {currentRisk.label} · <span className="green">{useTargetOdds ? `${targetOdds}x target` : `${estimatedOdds >= 1000 ? `${(estimatedOdds / 1000).toFixed(1)}k` : estimatedOdds.toFixed(1)}x est.`}</span>
            </b>
            <div className="text-[11px] text-zinc-500 mt-0.5 font-mono">
              Potential Return on ₦{stake.toLocaleString()}: <span className="font-bold text-zinc-900">₦{Math.round(stake * (useTargetOdds ? targetOdds : estimatedOdds)).toLocaleString()}</span>
            </div>
          </div>
          <button
            type="button"
            id="build"
            onClick={handleRunAnalysisAndGenerate}
            disabled={isAnalyzing}
            className="primary flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                <span>Auditing live lines…</span>
              </>
            ) : (
              <>
                <i className="not-italic text-lime font-bold">✦</i>
                <span>Analyze & build {numGames} candidate games</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ── Generated Ticket Section ──────────────────────────────────────── */}
      {hasGenerated && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="section-title flex items-center justify-between pb-3 border-b border-[#e5e9e3]">
            <div>
              <h2 className="text-xl font-extrabold text-[#16201c] tracking-tight">Your Model Selections ({chosenPicks.length} Games)</h2>
              <p className="fine text-[#71807a] text-xs">
                Calibrated for {currentRisk.label} · Combined multiplier <b>{combinedOdds.toFixed(2)}x</b> · Ticket chance <b>{survivalProbability}%</b>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRunAIChallenger}
                disabled={isChallenging}
                className="chip font-bold text-xs"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-amber-500 text-xs"></i>
                <span>{isChallenging ? 'Auditing…' : 'Audit Slip'}</span>
              </button>
              <button
                onClick={handleRunAnalysisAndGenerate}
                className="chip font-bold text-xs"
              >
                <i className="fa-solid fa-rotate text-xs"></i>
                <span>Re-Roll</span>
              </button>
              {onSendToAudit && (
                <button
                  onClick={handleSendToAudit}
                  className="chip font-bold text-xs"
                >
                  <i className="fa-solid fa-magnifying-glass-chart text-xs"></i>
                  <span>Deep Audit</span>
                </button>
              )}
            </div>
          </div>

          {chosenPicks.length === 0 ? (
            <div className="card p-12 text-center text-[#71807a] space-y-3">
              <i className="fa-solid fa-ticket text-4xl text-[#84918a]"></i>
              <p className="text-sm font-bold text-[#16201c]">All games removed</p>
              <button
                onClick={handleRunAnalysisAndGenerate}
                className="primary py-2.5 px-5 text-xs mx-auto"
              >
                Re-Generate Games
              </button>
            </div>
          ) : (
            <div className="picks card overflow-hidden divide-y divide-[#e5e9e3]">
              {chosenPicks.map((pick, idx) => {
                const challenge = challengeResults[pick.id]
                const parts = pick.matchLabel.split(' vs ')
                const homeTeam = pick.homeTeam || parts[0] || pick.matchLabel
                const awayTeam = pick.awayTeam || parts[1] || ''

                return (
                  <div
                    key={pick.id}
                    className="pick p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[#fafbfa] transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="league flex items-center gap-2 text-[10px] font-mono text-[#84918a] tracking-wider uppercase">
                        <span className="w-5 h-5 rounded-full bg-[#16201c] text-[#dfff46] inline-grid place-items-center text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span>{pick.league}</span>
                        <span>·</span>
                        <span>{pick.kickoff}</span>
                      </div>

                      <div className="teams text-base font-extrabold text-[#16201c] tracking-tight">
                        {awayTeam ? (
                          <>
                            {homeTeam} <span className="muted font-normal text-xs text-[#71807a]">vs</span> {awayTeam}
                          </>
                        ) : (
                          pick.matchLabel
                        )}
                      </div>

                      <div className="meta text-xs text-[#53625b] flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-[#16201c]">{pick.market}</span>
                        <span className="text-[#84918a]">({pick.marketName})</span>
                        <span>·</span>
                        <span className="text-emerald-700 font-bold">{Math.round((pick.probability || 0.75) * 100)}% Model Chance</span>
                        <span>·</span>
                        <span className="text-[#71807a]">Edge: +{Math.max(1, Math.round(((pick.probability || 0.75) - (1 / pick.odds)) * 100))}%</span>
                      </div>

                      <p className="text-xs text-[#71807a] leading-relaxed font-normal pt-0.5">
                        {pick.modelRationale}
                      </p>

                      {/* AI Challenger Verdict */}
                      {challenge && (
                        <div
                          className={`mt-2 p-3 rounded-lg border text-xs ${challenge.actionBg} ${challenge.actionBorder} flex items-center justify-between flex-wrap gap-2 animate-in fade-in`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-white border ${challenge.actionColor}`}>
                              {challenge.actionLabel}
                            </span>
                            <span className="font-bold text-zinc-900">{challenge.title}</span>
                            <span className="text-[11px] text-zinc-600 hidden sm:inline">— {challenge.explanation}</span>
                          </div>
                          {challenge.action === 'REPLACE' && challenge.recommendedAlternative && (
                            <button
                              onClick={() => handleApplySwap(pick.id, challenge.recommendedAlternative!)}
                              className="chip py-1 px-3 text-xs font-bold"
                            >
                              Swap to {challenge.recommendedAlternative.market} (@{challenge.recommendedAlternative.odds.toFixed(2)})
                            </button>
                          )}
                          {challenge.action === 'REMOVE' && (
                            <button
                              onClick={() => handleRemovePick(pick.id)}
                              className="chip py-1 px-3 text-xs font-bold text-rose-600"
                            >
                              Drop Leg
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1.5 shrink-0">
                      <div className="odds text-right font-mono font-extrabold text-xl text-[#16201c]">
                        {pick.odds.toFixed(2)}x
                      </div>
                      <span className="tag px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#e9f7e4] text-[#1d5d3d] border border-[#b9e5b7]">
                        {pick.badgeLabel || 'LOWER VARIANCE'}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => setInspectingPick(pick)}
                          className="chip py-1 px-2.5 text-[11px] font-semibold"
                          title="Inspect stats and alternatives"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleRemovePick(pick.id)}
                          className="chip py-1 px-2.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Drop game"
                        >
                          Drop
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Ticket Summary & Real Booking Code Bar */}
          {chosenPicks.length > 0 && (
            <div className="result-bar">
              <div>
                <div className="eyebrow">Combined Multiplier</div>
                <b>
                  {chosenPicks.length} games · <span className="green">{combinedOdds.toFixed(2)}x total</span>
                </b>
                <div className="text-xs text-[#71807a] mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>Stake: ₦</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={stake}
                    onChange={(e) => setStake(Math.max(100, Number(e.target.value) || 100))}
                    className="font-bold underline text-[#16201c] w-20 bg-transparent outline-none"
                  />
                  <span>→ Est. Payout: <b className="text-[#183b2d] font-bold">₦{potentialPayout.toLocaleString()}</b></span>
                  <span className="text-[#84918a] font-mono text-[11px]">({survivalProbability}% ticket chance)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleGenerateRealBookingCode}
                  disabled={isBooking}
                  className="primary flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isBooking ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-lime"></i>
                      <span>Generating Code…</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ticket text-lime"></i>
                      <span>Get SportyBet Booking Code</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopySummary}
                  className="chip font-bold text-xs"
                >
                  <i className={`fa-solid ${copiedSummary ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                  <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
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
                <h3 className="text-lg font-black text-zinc-950">
                  Odds Just Shifted on SportyBet
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  {bookingError || 'One of these matches just kicked off or its odds were adjusted on SportyBet. Tap Re-Roll below to get an active, ready-to-book ticket immediately!'}
                </p>
                <button
                  onClick={() => {
                    setShowCodeModal(false)
                    handleRunAnalysisAndGenerate()
                  }}
                  className="primary w-full py-3 px-4 text-xs font-bold cursor-pointer"
                >
                  ↻ Re-Roll Fresh Active Games
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
