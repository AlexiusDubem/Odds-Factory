import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  DAILY_SURE_PICKS,
  type DailySurePick,
  type DiscoveredCompetition,
} from '../data/sportybetCompetitions'
import type { Slip, SlipLeg } from '../types'
import { MatchIntelligenceModal } from './MatchIntelligenceModal'
import {
  challengeSelection,
  generateEvidenceRationale,
  type ChallengeResult,
} from '../engine/aiSelectionChallenger'
import {
  analyzeFixtureIndependently,
  assembleTargetOddsTicket,
  type FixtureAnalysisResult,
  type TargetOddsAssemblyResult
} from '../engine/fixtureAnalyzer'

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


const MARKET_FAMILY_OPTIONS = [
  { id: 'ALL', label: 'All Markets', icon: 'fa-solid fa-layer-group' },
  { id: 'goals', label: 'Goals (Over/Under)', icon: 'fa-solid fa-futbol' },
  { id: 'btts', label: 'BTTS / GG-NG', icon: 'fa-solid fa-handshake' },
  { id: 'match_result', label: '1X2 Match Winner', icon: 'fa-solid fa-trophy' },
  { id: 'double_chance', label: 'Double Chance', icon: 'fa-solid fa-shield' },
  { id: 'dnb', label: 'Draw No Bet', icon: 'fa-solid fa-crosshairs' },
  { id: 'handicap', label: 'Handicap', icon: 'fa-solid fa-scale-balanced' },
  { id: 'team_goals', label: 'Team Goals', icon: 'fa-solid fa-bullseye' },
  { id: 'cleansheet', label: 'Clean Sheet', icon: 'fa-solid fa-hands' },
  { id: 'corners', label: 'Corners', icon: 'fa-solid fa-flag' },
  { id: 'cards_bookings', label: 'Cards & Bookings', icon: 'fa-solid fa-square' },
  { id: 'intervals_halves', label: 'Halves & Intervals', icon: 'fa-solid fa-stopwatch' },
] as const

export function AccaBuilderPanel({ onSendToAudit }: Props) {
  // Real live picks from SportyBet
  const [allLivePicks, setAllLivePicks] = useState<DailySurePick[]>(DAILY_SURE_PICKS)
  const [discoveredCompetitions, setDiscoveredCompetitions] = useState<DiscoveredCompetition[]>([])
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true)
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false)
  const [lastFeedTime, setLastFeedTime] = useState<string | null>(null)

  // ── User Conditions ────────────────────────────────────────────────────────
  const [duration, setDuration] = useState<MatchDuration>('today')
  const [leagueScope, setLeagueScope] = useState<LeagueScope>('all')
  const [selectedMarketFamilies, setSelectedMarketFamilies] = useState<string[]>(['ALL'])
  const [analyzedFixtures, setAnalyzedFixtures] = useState<FixtureAnalysisResult[]>([])
  const [assemblyResult, setAssemblyResult] = useState<TargetOddsAssemblyResult | null>(null)
  const [expandedRationales, setExpandedRationales] = useState<Record<string, boolean>>({})
  const [showNonQualifying, setShowNonQualifying] = useState<boolean>(false)
  const [numGames, setNumGames] = useState<number>(6)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(2)
  const [useTargetOdds, setUseTargetOdds] = useState<boolean>(false)
  const [targetOdds, setTargetOdds] = useState<number>(10.0)
  const [customOddsInput, setCustomOddsInput] = useState<string>('10.0')
  const [stake, setStake] = useState<number>(1000)

  // ── Generation State ───────────────────────────────────────────────────────
  const [hasGenerated, setHasGenerated] = useState<boolean>(false)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number } | null>(null)
  const [chosenPicks, setChosenPicks] = useState<DailySurePick[]>([])

  // ── Match Intelligence & AI Challenger State ────────────────────────────────
  const [inspectingPick, setInspectingPick] = useState<DailySurePick | null>(null)
  const [isChallenging, setIsChallenging] = useState<boolean>(false)
  const [challengeResults, setChallengeResults] = useState<Record<string, ChallengeResult>>({})
  const [geminiEnrichingIds, setGeminiEnrichingIds] = useState<Set<string>>(new Set())

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
            if (data.fetchedAt) setLastFeedTime(data.fetchedAt)
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


  const handleToggleMarketFamily = (familyId: string) => {
    if (familyId === 'ALL') {
      setSelectedMarketFamilies(['ALL'])
      return
    }

    let updated = selectedMarketFamilies.filter(f => f !== 'ALL')
    if (updated.includes(familyId)) {
      updated = updated.filter(f => f !== familyId)
    } else {
      updated.push(familyId)
    }

    if (updated.length === 0) {
      setSelectedMarketFamilies(['ALL'])
    } else {
      setSelectedMarketFamilies(updated)
    }
  }

  const handleDurationChange = (newDur: MatchDuration) => {
    setDuration(newDur)
    setHasGenerated(false)
    fetchLiveSportyBetMatches(newDur)
  }

  // ── Independent Fixture Analysis & Assembly Algorithm ─────────────────────
  // Core Principle:
  // 1. Analyze every fixture independently across user-permitted SportyBet markets.
  // 2. Select the single strongest market per fixture (or NO_QUALIFYING_SELECTION).
  // 3. Assemble ticket to match requested target odds or top N qualified games.

  const handleRunAnalysisAndGenerate = async () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)
    setAnalysisProgress(null)

    // Let React render the loading state before the CPU-heavy scoring begins.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    try {
      const risk = RISK_CONFIG[riskLevel]

      // Step 1: Group all live picks by fixture (eventId)
      const fixtureMap = new Map<string, DailySurePick[]>()
      for (const p of allLivePicks) {
        if (!fixtureMap.has(p.eventId)) {
          fixtureMap.set(p.eventId, [])
        }
        fixtureMap.get(p.eventId)!.push(p)
      }

      // Step 2: Independently analyze every fixture
      const evaluatedFixtures: FixtureAnalysisResult[] = []

      // A ticket needs a high-quality pool, not every market in a 100-fixture
      // bookmaker response. This bounded pool keeps generation fast on phones.
      const fixtureGroups = [...fixtureMap.values()]
      const poolLimit = Math.max(30, Math.min(60, numGames * 4))
      const fixturePool = fixtureGroups.slice(0, poolLimit)
      let processedFixtures = 0
      setAnalysisProgress({ current: 0, total: fixturePool.length })
      for (const markets of fixturePool) {
        const first = markets[0]

        // Duration / Timing filter
        if (first.hoursFromNow !== undefined) {
          if (first.hoursFromNow < 0.05) continue // Skip started games
          if (duration === 'today' && first.hoursFromNow > 24) continue
          if (duration === '3days' && first.hoursFromNow > 72) continue
          if (duration === 'midnight') {
            if (first.estimateStartTime) {
              const d = new Date(first.estimateStartTime)
              const watHour = (d.getUTCHours() + 1) % 24
              if (watHour < 22 && watHour >= 6) continue
            }
          }
        }

        // League scope filter
        if (leagueScope === 'major' && first.leagueScope && first.leagueScope !== 'major') continue
        if (leagueScope === 'small' && first.leagueScope && first.leagueScope === 'major') continue

        // Independent fixture analysis across user-permitted market families
        const analysis = analyzeFixtureIndependently(
          markets,
          selectedMarketFamilies,
          risk.minOdds,
          risk.maxOdds,
          risk.minProb
        )

        evaluatedFixtures.push(analysis)
        processedFixtures++
        setAnalysisProgress({ current: processedFixtures, total: fixturePool.length })

        // Yield regularly so mobile browsers can paint and handle taps while a
        // large live fixture feed is being evaluated.
        if (processedFixtures % 2 === 0) {
          await new Promise<void>(resolve => setTimeout(resolve, 0))
        }
      }

      setAnalyzedFixtures(evaluatedFixtures)

      // Step 3: Assemble combination matching Target Multiplier or Top N Games
      const target = useTargetOdds ? targetOdds : undefined
      const assembly = assembleTargetOddsTicket(evaluatedFixtures, target, numGames)
      setAssemblyResult(assembly)

      // Step 4: Map qualified fixture selections to DailySurePick format
      const finalPicks: DailySurePick[] = assembly.selectedFixtures
        .filter(f => f.chosenMarket?.rawPick)
        .map(f => {
          const raw = f.chosenMarket!.rawPick
          return {
            ...raw,
            market: f.chosenMarket!.selection,
            marketName: f.chosenMarket!.sportyBetMarketName,
            odds: f.chosenMarket!.decimalOdds,
            probability: f.chosenMarket!.modelProbability,
            confidenceScore: Math.round(f.chosenMarket!.modelProbability * 100),
            ev: f.chosenMarket!.ev,
            edge: f.chosenMarket!.edge,
            modelRationale: f.reason,
          }
        })

      setChosenPicks(finalPicks)
      setHasGenerated(true)
    } catch (error) {
      console.error('Fixture generation failed:', error)
      setChosenPicks([])
      setHasGenerated(true)
    } finally {
      setAnalysisProgress(null)
      setIsAnalyzing(false)
    }
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

  // ── Optional Gemini Rationale Generation (On Demand) ──────────────────────
  // Available on user request after the statistical fixture analysis completes.
  const [isEnrichingGemini, setIsEnrichingGemini] = useState<boolean>(false)

  const handleEnrichWithGemini = async () => {
    if (chosenPicks.length === 0 || isEnrichingGemini) return
    setIsEnrichingGemini(true)

    for (const pick of chosenPicks) {
      const analysis = analyzedFixtures.find(f => f.fixtureId === pick.eventId)
      if (!analysis || !analysis.chosenMarket) continue

      setGeminiEnrichingIds(prev => new Set(prev).add(pick.id))

      try {
        const payload = {
          fixture: {
            id: pick.eventId,
            home: pick.homeTeam,
            away: pick.awayTeam,
            league: pick.league,
            kickoff: pick.estimateStartTime,
          },
          allowedMarketFamilies: selectedMarketFamilies,
          availableMarkets: analysis.alternativesConsidered?.map(a => ({
            name: a.market,
            selection: a.selection,
            odds: a.decimalOdds,
            family: a.marketFamily,
          })) || [],
          stats: {
            chosenMarket: analysis.chosenMarket.sportyBetMarketName,
            chosenSelection: analysis.chosenMarket.selection,
            chosenOdds: analysis.chosenMarket.decimalOdds,
            modelProbability: analysis.chosenMarket.modelProbability,
            ev: analysis.chosenMarket.ev,
            edge: analysis.chosenMarket.edge,
            confidence: analysis.chosenMarket.confidence,
            evidence: analysis.evidence,
            riskFlags: analysis.riskFlags,
          },
        }

        let res = await fetch('/api/fixture-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => null)

        if (!res || !res.ok) {
          res = await fetch('/api/local/fixture-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => null)
        }

        if (!res || !res.ok) {
          res = await fetch('http://localhost:3001/fixture-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => null)
        }

        if (res && res.ok) {
          const data = await res.json()
          if (data.success && data.result?.reason) {
            setChosenPicks(prev =>
              prev.map(p =>
                p.id === pick.id
                  ? { ...p, modelRationale: data.result.reason }
                  : p
              )
            )
          }
        }
      } catch {
        // Fall back to Poisson model evidence
      } finally {
        setGeminiEnrichingIds(prev => {
          const next = new Set(prev)
          next.delete(pick.id)
          return next
        })
      }
    }

    setIsEnrichingGemini(false)
  }

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
        (p, i) => `${i + 1}. ${p.matchLabel} (${p.league})\n   Selection: ${p.marketName ? `${p.marketName} — ` : ''}${p.market} @${p.odds.toFixed(2)} (${p.kickoff})`
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
              ? `${discoveredCompetitions.length || 36} leagues • ${allLivePicks.length} markets audited${lastFeedTime ? ` · synced ${new Date(lastFeedTime).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}` : ''}`
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

        {/* 3. Multi-Select Market Families */}
        <div className="option-group">
          <label>
            <span>Allowed market families (Multi-Select)</span>
            <span className="text-emerald-700 font-mono text-[10px] font-bold">
              {selectedMarketFamilies.includes('ALL') ? 'All Production Markets' : `${selectedMarketFamilies.length} Families Permitted`}
            </span>
          </label>
          <div className="chips flex flex-wrap gap-1.5">
            {MARKET_FAMILY_OPTIONS.map((opt) => {
              const isSelected = selectedMarketFamilies.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToggleMarketFamily(opt.id)}
                  className={`chip flex items-center gap-1.5 ${isSelected ? 'on' : ''}`}
                >
                  <i className={`${opt.icon} text-[10px]`} />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
          {/* Active selection preview */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 mt-1 border-t border-zinc-100">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Permitted for analysis:</span>
            {selectedMarketFamilies.map((fam) => (
              <span key={fam} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e9f7e4] text-[#15966a] border border-[#a3e0be] text-[10px] font-mono font-bold uppercase">
                <i className="fa-solid fa-check text-[8px]" /> {fam}
              </span>
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

          {/* Rejected Fixtures (No Qualifying Selection) Accordion */}
          {analyzedFixtures.filter(f => f.status === 'NO_QUALIFYING_SELECTION').length > 0 && (
            <div className="card p-4 mt-4">
              <button
                type="button"
                onClick={() => setShowNonQualifying(!showNonQualifying)}
                className="w-full flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-zinc-100 text-zinc-500 inline-grid place-items-center text-xs">
                    <i className="fa-solid fa-filter-circle-xmark" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-800">
                      {analyzedFixtures.filter(f => f.status === 'NO_QUALIFYING_SELECTION').length} Fixtures Rejected (No Qualifying Selection)
                    </span>
                    <span className="block text-[10px] text-zinc-500">
                      Matches evaluated where offered markets failed evidence or EV threshold.
                    </span>
                  </div>
                </div>
                <i className={`fa-solid ${showNonQualifying ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs text-zinc-400`} />
              </button>

              {showNonQualifying && (
                <div className="mt-3 pt-3 border-t border-zinc-100 divide-y divide-zinc-100 text-xs text-zinc-600 animate-in fade-in duration-200">
                  {analyzedFixtures.filter(f => f.status === 'NO_QUALIFYING_SELECTION').map((f) => (
                    <div key={f.fixtureId} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="font-bold text-zinc-800">{f.fixture}</span>
                        <span className="text-[10px] text-zinc-400 ml-2 font-mono">({f.league})</span>
                      </div>
                      <span className="text-[11px] text-amber-700 font-mono">{f.reason}</span>
                    </div>
                  ))}
                </div>
              )}
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
              {[5, 10, 20, 50, 100].map((v) => (
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
                <span>{analysisProgress ? `Auditing ${analysisProgress.current}/${analysisProgress.total} fixtures…` : 'Preparing live lines…'}</span>
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
                onClick={handleEnrichWithGemini}
                disabled={isEnrichingGemini}
                className="chip font-bold text-xs"
                title="Generate narrative AI reasoning for selections"
              >
                <i className={`fa-solid fa-brain text-emerald-600 text-xs ${isEnrichingGemini ? 'animate-pulse' : ''}`}></i>
                <span>{isEnrichingGemini ? 'Enriching…' : 'AI Explanations'}</span>
              </button>
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

          {/* Target Multiplier Assembly Banner */}
          {assemblyResult && useTargetOdds && (
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in ${
              assemblyResult.targetStatus === 'EXACT'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-white border">
                    {assemblyResult.targetStatus === 'EXACT' ? 'Target Matched' : 'Target Nearest Assembly'}
                  </span>
                  <span className="font-bold text-xs sm:text-sm">
                    Target: {assemblyResult.targetOdds}× • Achieved: {assemblyResult.achievedOdds}×
                  </span>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed max-w-xl">{assemblyResult.explanation}</p>
              </div>
              <div className="font-mono text-left sm:text-right shrink-0">
                <span className="text-2xl font-extrabold text-zinc-950">{assemblyResult.achievedOdds}×</span>
                <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Combined Multiplier</span>
              </div>
            </div>
          )}

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
                        {geminiEnrichingIds.has(pick.id) && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-600 font-mono animate-pulse">
                            <i className="fa-solid fa-brain text-[9px]" />
                            Gemini analysing…
                          </span>
                        )}
                      </p>

                      {/* Analysis Rationale & Alternatives Expander */}
                      {(() => {
                        const analysis = analyzedFixtures.find(f => f.fixtureId === pick.eventId)
                        const isExpanded = !!expandedRationales[pick.id]
                        return (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedRationales(prev => ({ ...prev, [pick.id]: !prev[pick.id] }))}
                              className="text-[11px] font-mono font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 cursor-pointer"
                            >
                              <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[9px]`} />
                              <span>{isExpanded ? 'Hide Analysis Rationale' : 'View Analysis Rationale & Alternatives'}</span>
                            </button>

                            {isExpanded && analysis && (
                              <div className="mt-2.5 p-3.5 bg-zinc-50 border border-zinc-200/90 rounded-xl space-y-2.5 text-xs animate-in fade-in duration-200">
                                <div>
                                  <span className="font-mono font-bold text-[10px] uppercase text-zinc-500 tracking-wider block mb-1">
                                    Primary Statistical Evidence:
                                  </span>
                                  <ul className="list-disc list-inside text-zinc-700 space-y-1 text-[11px] leading-relaxed">
                                    {analysis.evidence.map((ev: string, i: number) => (
                                      <li key={i}>{ev}</li>
                                    ))}
                                  </ul>
                                </div>

                                {analysis.alternativesConsidered && analysis.alternativesConsidered.length > 0 && (
                                  <div className="pt-2 border-t border-zinc-200/70">
                                    <span className="font-mono font-bold text-[10px] uppercase text-zinc-500 tracking-wider block mb-1">
                                      Alternatives Considered & Excluded:
                                    </span>
                                    <div className="space-y-1 mt-1">
                                      {analysis.alternativesConsidered.map((alt: any, i: number) => (
                                        <div key={i} className="text-[11px] text-zinc-600 flex items-start gap-1.5">
                                          <span className="font-mono font-bold text-zinc-800 shrink-0">{alt.market} (@{alt.decimalOdds.toFixed(2)}):</span>
                                          <span className="text-zinc-600">{alt.reasonNotChosen}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {analysis.riskFlags && analysis.riskFlags.length > 0 && (
                                  <div className="pt-1 text-[11px] text-amber-800 font-mono flex items-center gap-1.5">
                                    <i className="fa-solid fa-triangle-exclamation text-amber-600" />
                                    <span>Risk Advisory: {analysis.riskFlags.join(' • ')}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

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
