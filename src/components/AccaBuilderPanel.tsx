import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  DAILY_SURE_PICKS,
  generateTargetOddsAcca,
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
  isMarketFamilyAllowed,
  type FixtureAnalysisResult,
  type TargetOddsAssemblyResult
} from '../engine/fixtureAnalyzer'
import { batchGenerateEvidenceRationales } from '../engine/geminiService'
import { PunterKycModal, DEFAULT_PUNTER_DNA, type PunterDna } from './PunterKycModal'
import { EliteSinglesExplorer } from './EliteSinglesExplorer'

interface Props {
  onSendToAudit?: (slip: Slip) => void
}

export type MatchDuration = 'today' | 'tomorrow' | 'today_tomorrow' | '3days' | 'weekend' | '1week'
export type RiskLevel = 1 | 2 | 3

export interface RiskConfig {
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

export const RISK_CONFIG: Record<RiskLevel, RiskConfig> = {
  1: {
    label: 'Safe Bankers',
    tag: 'BANKER ACCA',
    icon: 'fa-solid fa-shield-halved',
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/60',
    badgeBorder: 'border-emerald-500/30',
    trackColor: '#10B981',
    tiers: [1],
    minOdds: 1.18,
    maxOdds: 1.42,
    minProb: 0.68,
    desc: 'Highest probability locks: Double Chance 1X/X2, Over 1.5 Goals, Home to Score, 2UP Heavy Favorites.',
  },
  2: {
    label: 'Balanced Play',
    tag: 'STEADY ACCA',
    icon: 'fa-solid fa-scale-balanced',
    color: 'text-blue-400',
    badgeBg: 'bg-blue-950/60',
    badgeBorder: 'border-blue-500/30',
    trackColor: '#3B82F6',
    tiers: [1, 2],
    minOdds: 1.38,
    maxOdds: 1.80,
    minProb: 0.54,
    desc: 'The punter sweet spot: 1X2 Straight Wins, Over 2.5 Goals, Both Teams To Score (GG), Corners Over.',
  },
  3: {
    label: 'High Reward',
    tag: 'MAX MULTIPLIER',
    icon: 'fa-solid fa-fire',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-950/60',
    badgeBorder: 'border-amber-500/30',
    trackColor: '#F59E0B',
    tiers: [2, 3],
    minOdds: 1.80,
    maxOdds: 2.75,
    minProb: 0.42,
    desc: 'Audacious selections: Straight Win + Over 2.5, Away Win Bankers, High Yield Value Plays.',
  },
}

export interface CompOption {
  id: string
  label: string
  icon: string
}

export const COMPETITION_FILTERS: CompOption[] = [
  { id: 'ALL', label: 'All Elite Leagues', icon: '🌍' },
  { id: 'ucl', label: 'Champions League', icon: '🏆' },
  { id: 'uel', label: 'Europa League', icon: '🥈' },
  { id: 'uecl', label: 'Conference League', icon: '🥉' },
  { id: 'epl', label: 'Premier League', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'laliga', label: 'La Liga', icon: '🇪🇸' },
  { id: 'seriea', label: 'Serie A', icon: '🇮🇹' },
  { id: 'bundesliga', label: 'Bundesliga', icon: '🇩🇪' },
  { id: 'ligue1', label: 'Ligue 1', icon: '🇫🇷' },
  { id: 'npfl', label: 'NPFL (Nigeria)', icon: '🇳🇬' },
  { id: 'cups', label: 'Top European Cups', icon: '🏆' },
]

export const MARKET_FAMILY_OPTIONS = [
  { id: 'ALL', label: 'All Punter Markets', icon: 'fa-solid fa-layer-group' },
  { id: 'match_result', label: '1X2 & 2UP Early Payout', icon: 'fa-solid fa-bolt' },
  { id: 'double_chance', label: 'Double Chance (1X / X2)', icon: 'fa-solid fa-shield-halved' },
  { id: 'goals', label: 'Over 1.5 & 2.5 Goals', icon: 'fa-solid fa-futbol' },
  { id: 'btts', label: 'BTTS / Both Teams to Score (GG)', icon: 'fa-solid fa-handshake' },
  { id: 'corners', label: 'Corners Over (Over 7.5 / 8.5)', icon: 'fa-solid fa-flag' },
  { id: 'team_goals', label: 'Team Goals (Home/Away Over)', icon: 'fa-solid fa-bullseye' },
] as const

export function AccaBuilderPanel({ onSendToAudit }: Props) {
  // ── Tab & Navigation State ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'builder' | 'singles'>('builder')
  const [showPunterKycModal, setShowPunterKycModal] = useState<boolean>(false)
  const [punterDna, setPunterDna] = useState<PunterDna>(() => {
    try {
      const saved = localStorage.getItem('odds_factory_punter_dna')
      return saved ? JSON.parse(saved) : DEFAULT_PUNTER_DNA
    } catch {
      return DEFAULT_PUNTER_DNA
    }
  })

  // ── Live Feed State ───────────────────────────────────────────────────────
  const [allLivePicks, setAllLivePicks] = useState<DailySurePick[]>(DAILY_SURE_PICKS)
  const [discoveredCompetitions, setDiscoveredCompetitions] = useState<DiscoveredCompetition[]>([])
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true)
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false)
  const [lastFeedTime, setLastFeedTime] = useState<string | null>(null)

  const todayDateString = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }, [])

  // ── User Selection Criteria ───────────────────────────────────────────────
  const [duration, setDuration] = useState<MatchDuration>('today')
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>(['ALL'])
  const [selectedMarketFamilies, setSelectedMarketFamilies] = useState<string[]>(['ALL'])
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(1)
  const [useTargetOdds, setUseTargetOdds] = useState<boolean>(false)
  const [targetOdds, setTargetOdds] = useState<number>(10.0)
  const [customOddsInput, setCustomOddsInput] = useState<string>('10.0')
  const [numGames, setNumGames] = useState<number>(6)
  const [stake, setStake] = useState<number>(1000)

  // ── Generated Ticket & Analysis State ─────────────────────────────────────
  const [hasGenerated, setHasGenerated] = useState<boolean>(false)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number } | null>(null)
  const [chosenPicks, setChosenPicks] = useState<DailySurePick[]>([])
  const [analyzedFixtures, setAnalyzedFixtures] = useState<FixtureAnalysisResult[]>([])
  const [assemblyResult, setAssemblyResult] = useState<TargetOddsAssemblyResult | null>(null)
  const [expandedRationales, setExpandedRationales] = useState<Record<string, boolean>>({})
  const [challengeResults, setChallengeResults] = useState<Record<string, ChallengeResult>>({})
  const [inspectingPick, setInspectingPick] = useState<DailySurePick | null>(null)

  // ── Booking Code State ────────────────────────────────────────────────────
  const [isBooking, setIsBooking] = useState(false)
  const [bookingCode, setBookingCode] = useState<string | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  // ── Dynamic Date Helpers ──────────────────────────────────────────────────
  const dateOptions = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const tomorrow = new Date(now.getTime() + 86400000)
    const tmrwStr = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    return [
      { id: 'today', label: `⚡ Today (${todayStr})`, sub: '<24 hrs kickoff' },
      { id: 'tomorrow', label: `🌅 Tomorrow (${tmrwStr})`, sub: 'Next calendar day' },
      { id: 'today_tomorrow', label: `📅 Today & Tomorrow`, sub: '48h slate' },
      { id: '3days', label: `🎯 Next 3 Days`, sub: 'Midweek & Weekend' },
      { id: 'weekend', label: `🏆 Weekend Slate`, sub: 'Fri – Sun European action' },
      { id: '1week', label: `🗓️ 7-Day Longshot`, sub: 'Full week accumulator' },
    ] as const
  }, [])

  const currentRisk = RISK_CONFIG[riskLevel]

  const estimatedOdds = useMemo(() => {
    const midOdd = (currentRisk.minOdds + currentRisk.maxOdds) / 2
    return Math.pow(midOdd, numGames)
  }, [numGames, currentRisk])

  // ── Helper: Check if match belongs to user-selected competitions ─────────
  const isMatchInSelectedCompetitions = useCallback(
    (leagueName: string) => {
      if (selectedCompetitions.includes('ALL') || selectedCompetitions.length === 0) return true
      const l = (leagueName || '').toLowerCase()

      for (const c of selectedCompetitions) {
        if (c === 'ucl' && (l.includes('champions league') || l.includes('ucl'))) return true
        if (c === 'uel' && l.includes('europa league')) return true
        if (c === 'uecl' && l.includes('conference league')) return true
        if (c === 'epl' && l.includes('premier league') && !l.includes('northern') && !l.includes('southern')) return true
        if (c === 'laliga' && (l.includes('la liga') || l.includes('laliga'))) return true
        if (c === 'seriea' && l.includes('serie a')) return true
        if (c === 'bundesliga' && l.includes('bundesliga') && !l.includes('2.')) return true
        if (c === 'ligue1' && l.includes('ligue 1')) return true
        if (c === 'npfl' && (l.includes('npfl') || l.includes('nigeria'))) return true
        if (c === 'cups' && (l.includes('copa del rey') || l.includes('fa cup') || l.includes('dfb pokal') || l.includes('coppa italia'))) return true
      }
      return false
    },
    [selectedCompetitions]
  )

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

  const handleDurationChange = (val: MatchDuration) => {
    setDuration(val)
    fetchLiveSportyBetMatches(val)
  }

  const handleToggleCompetition = (compId: string) => {
    if (compId === 'ALL') {
      setSelectedCompetitions(['ALL'])
      return
    }
    let next = selectedCompetitions.filter(c => c !== 'ALL')
    if (next.includes(compId)) {
      next = next.filter(c => c !== compId)
      if (next.length === 0) next = ['ALL']
    } else {
      next.push(compId)
    }
    setSelectedCompetitions(next)
  }

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

  // ── 1-Click "Surprise Me" Banker Generator ─────────────────────────────────
  const handleSurpriseMe = () => {
    if (allLivePicks.length === 0) return
    setIsAnalyzing(true)
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)

    const fixtureMap = new Map<string, DailySurePick[]>()
    for (const p of allLivePicks) {
      if (!isMatchInSelectedCompetitions(p.league)) continue
      if (!fixtureMap.has(p.eventId)) fixtureMap.set(p.eventId, [])
      fixtureMap.get(p.eventId)!.push(p)
    }

    const getCompPriority = (p?: DailySurePick) => {
      if (!p) return 0
      const l = (p.league || '').toLowerCase()
      if (l.includes('champions league') || l.includes('ucl')) return 1000
      if (l.includes('europa league')) return 900
      if (l.includes('conference league')) return 850
      if (l.includes('premier league')) return 800
      if (l.includes('la liga') || l.includes('serie a') || l.includes('bundesliga')) return 750
      return 100
    }

    const sortedGroups = [...fixtureMap.values()].sort((a, b) => {
      const pA = getCompPriority(a[0])
      const pB = getCompPriority(b[0])
      if (pA !== pB) return pB - pA
      return (a[0]?.hoursFromNow ?? 48) - (b[0]?.hoursFromNow ?? 48)
    })

    const surprisePicks: DailySurePick[] = []
    const legCount = punterDna.targetProfile === 'safe' ? 4 : punterDna.targetProfile === 'daring' ? 8 : 5

    for (const group of sortedGroups) {
      if (surprisePicks.length >= legCount) break
      const candidate =
        group.find(p => p.marketId === '60100' && p.odds <= 1.85) ||
        group.find(p => p.marketId === '10' && p.odds >= 1.22 && p.odds <= 1.65) ||
        group.find(p => p.market.includes('Over 1.5') && p.odds >= 1.20) ||
        group.find(p => p.marketFamily === 'corners' && p.odds >= 1.25 && p.odds <= 1.70) ||
        group.find(p => p.marketFamily === 'btts' && p.odds >= 1.35 && p.odds <= 1.80) ||
        group.find(p => p.marketId === '1' && p.odds >= 1.25 && p.odds <= 1.75) ||
        group[0]

      if (candidate && !surprisePicks.some(sp => sp.eventId === candidate.eventId)) {
        surprisePicks.push(candidate)
      }
    }

    if (surprisePicks.length > 0) {
      const results: Record<string, ChallengeResult> = {}
      for (const pick of surprisePicks) {
        results[pick.id] = challengeSelection(pick, allLivePicks)
      }
      setChallengeResults(results)
      setChosenPicks(surprisePicks)
      setHasGenerated(true)
      setActiveTab('builder')
    }
    setIsAnalyzing(false)
  }

  // ── Toggle Pick from Singles Explorer ─────────────────────────────────────
  const handleTogglePickFromExplorer = (pick: DailySurePick) => {
    setChosenPicks((prev) => {
      const exists = prev.some((p) => p.id === pick.id)
      if (exists) {
        return prev.filter((p) => p.id !== pick.id)
      } else {
        const withoutEvent = prev.filter((p) => p.eventId !== pick.eventId)
        return [...withoutEvent, pick]
      }
    })
    setChallengeResults((prev) => ({
      ...prev,
      [pick.id]: challengeSelection(pick, allLivePicks),
    }))
    setHasGenerated(true)
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)
  }

  // ── Core Fixture Analysis & Slip Generation ──────────────────────────────
  const handleRunAnalysisAndGenerate = async () => {
    setIsAnalyzing(true)
    setHasGenerated(false)
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)
    setAssemblyResult(null)
    setAnalysisProgress({ current: 0, total: 0 })

    try {
      // Step 1: Filter and group live SportyBet markets by fixture
      const fixtureMap = new Map<string, DailySurePick[]>()

      for (const pick of allLivePicks) {
        // Timeframe filter
        if (pick.hoursFromNow !== undefined) {
          if (pick.hoursFromNow < 0.05) continue
          if (duration === 'today' && pick.hoursFromNow > 24) continue
          if (duration === 'tomorrow') {
            if (pick.hoursFromNow < 12 || pick.hoursFromNow > 48) continue
          }
          if (duration === 'today_tomorrow' && pick.hoursFromNow > 48) continue
          if (duration === '3days' && pick.hoursFromNow > 72) continue
          if (duration === 'weekend' && pick.hoursFromNow > 120) continue
          if (duration === '1week' && pick.hoursFromNow > 168) continue
        }

        // Competition filter
        if (!isMatchInSelectedCompetitions(pick.league)) continue

        if (!fixtureMap.has(pick.eventId)) {
          fixtureMap.set(pick.eventId, [])
        }
        fixtureMap.get(pick.eventId)!.push(pick)
      }

      // Sort fixture groups: Champions League & Elite First
      const getCompPriority = (picks: DailySurePick[]) => {
        if (!picks || picks.length === 0) return 0
        const l = (picks[0].league || '').toLowerCase()
        if (l.includes('champions league') || l.includes('ucl')) return 1000
        if (l.includes('europa league')) return 900
        if (l.includes('conference league')) return 850
        if (l.includes('premier league')) return 800
        if (l.includes('la liga') || l.includes('serie a') || l.includes('bundesliga')) return 750
        return 100
      }

      const fixturePool = Array.from(fixtureMap.values()).sort((a, b) => {
        const pA = getCompPriority(a)
        const pB = getCompPriority(b)
        if (pA !== pB) return pB - pA
        return (a[0]?.hoursFromNow ?? 48) - (b[0]?.hoursFromNow ?? 48)
      })

      if (fixturePool.length === 0) {
        setChosenPicks([])
        setHasGenerated(true)
        setIsAnalyzing(false)
        return
      }

      setAnalysisProgress({ current: 0, total: fixturePool.length })

      // Step 2: Independently analyze each fixture
      const evaluatedFixtures: FixtureAnalysisResult[] = []
      let processedFixtures = 0
      const risk = currentRisk

      for (const marketsForFixture of fixturePool) {
        const analysis = analyzeFixtureIndependently(
          marketsForFixture,
          selectedMarketFamilies,
          risk.minOdds,
          risk.maxOdds,
          risk.minProb
        )

        evaluatedFixtures.push(analysis)
        processedFixtures++
        setAnalysisProgress({ current: processedFixtures, total: fixturePool.length })

        if (processedFixtures % 2 === 0) {
          await new Promise<void>(resolve => setTimeout(resolve, 0))
        }
      }

      setAnalyzedFixtures(evaluatedFixtures)

      // Step 3: Assemble combination matching Target Multiplier or Top N Games
      const target = useTargetOdds ? targetOdds : undefined
      const gamesLimit = useTargetOdds ? undefined : numGames
      const assembly = assembleTargetOddsTicket(evaluatedFixtures, target, gamesLimit)
      setAssemblyResult(assembly)

      // Step 4: Map qualified fixture selections to DailySurePick format
      let finalPicks: DailySurePick[] = assembly.selectedFixtures
        .filter(f => f.chosenMarket?.rawPick)
        .map(f => {
          const raw = f.chosenMarket!.rawPick
          let badge = raw.badgeLabel || 'LOWER VARIANCE'
          if (raw.marketId === '60100') badge = '⚡ 2UP Early Payout'
          else if (raw.marketId === '10') badge = '🛡️ Double Chance Lock'
          else if (raw.marketFamily === 'corners') badge = '🚩 Corner Play'
          else if (raw.marketFamily === 'btts') badge = '🔥 BTTS / GG Signal'
          else if (f.chosenMarket?.selection.includes('Over 1.5')) badge = '⚽ Over 1.5 Goals'
          else if (f.chosenMarket?.selection.includes('Over 2.5')) badge = '⚽ Over 2.5 Goals'
          else if (raw.marketId === '1') badge = '🎯 Match Winner'

          return {
            ...raw,
            market: f.chosenMarket!.selection,
            marketName: f.chosenMarket!.sportyBetMarketName,
            odds: f.chosenMarket!.decimalOdds,
            probability: f.chosenMarket!.modelProbability,
            confidenceScore: Math.round(f.chosenMarket!.modelProbability * 100),
            ev: f.chosenMarket!.ev,
            edge: f.chosenMarket!.edge,
            badgeLabel: badge,
            modelRationale: f.reason,
          }
        })

      if (finalPicks.length === 0) {
        const eligible: DailySurePick[] = []
        const seenEvents = new Set<string>()
        for (const pick of allLivePicks) {
          if (seenEvents.has(pick.eventId)) continue
          if (!isMatchInSelectedCompetitions(pick.league)) continue
          if (pick.hoursFromNow !== undefined) {
            if (pick.hoursFromNow < 0.05) continue
            if (duration === 'today' && pick.hoursFromNow > 24) continue
            if (duration === 'tomorrow' && (pick.hoursFromNow < 12 || pick.hoursFromNow > 48)) continue
            if (duration === 'today_tomorrow' && pick.hoursFromNow > 48) continue
            if (duration === '3days' && pick.hoursFromNow > 72) continue
            if (duration === 'weekend' && pick.hoursFromNow > 120) continue
            if (duration === '1week' && pick.hoursFromNow > 168) continue
          }
          if (!isMarketFamilyAllowed(pick.marketFamily || '', `${pick.marketName} ${pick.market}`, selectedMarketFamilies)) continue
          if (pick.odds < risk.minOdds * 0.9 || pick.odds > risk.maxOdds * 1.25) continue
          seenEvents.add(pick.eventId)
          eligible.push(pick)
        }
        const fallbackTarget = useTargetOdds ? targetOdds : Math.max(2, estimatedOdds)
        finalPicks = generateTargetOddsAcca(fallbackTarget, eligible, numGames)
        if (finalPicks.length > 0) {
          setAssemblyResult({
            targetOdds: fallbackTarget,
            achievedOdds: Number(finalPicks.reduce((acc, p) => acc * p.odds, 1).toFixed(2)),
            targetStatus: 'NEAREST_BELOW',
            selectedFixtures: evaluatedFixtures.filter(f => finalPicks.some(p => p.eventId === f.fixtureId)),
            explanation: `Assembled ${finalPicks.length} verified selections matching your parameters from the live book.`,
          })
        }
      }

      // Pre-compute AI evidence rationales before showing ticket
      if (finalPicks.length > 0) {
        try {
          const timeoutPromise = new Promise<Record<string, string>>((resolve) =>
            setTimeout(() => resolve({}), 4500)
          )
          const rationales = await Promise.race([
            batchGenerateEvidenceRationales(finalPicks),
            timeoutPromise,
          ])
          if (rationales && Object.keys(rationales).length > 0) {
            finalPicks = finalPicks.map(p => rationales[p.id] ? { ...p, modelRationale: rationales[p.id] } : p)
          }
        } catch {
          // Fallback to fixture analyzer pundit reasons
        }

        const challengeVerdicts: Record<string, ChallengeResult> = {}
        for (const pick of finalPicks) {
          challengeVerdicts[pick.id] = challengeSelection(pick, allLivePicks)
        }
        setChallengeResults(challengeVerdicts)
      }

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

  // ── Slip Calculations ─────────────────────────────────────────────────────
  const combinedOdds = useMemo(() => {
    if (chosenPicks.length === 0) return 0
    return Number(chosenPicks.reduce((acc, p) => acc * p.odds, 1).toFixed(2))
  }, [chosenPicks])

  const potentialReturn = useMemo(() => {
    return Math.round(stake * combinedOdds)
  }, [stake, combinedOdds])

  const survivalProbability = useMemo(() => {
    if (chosenPicks.length === 0) return 0
    const rawProb = chosenPicks.reduce((acc, p) => acc * (p.probability || 0.78), 1)
    return Math.max(0.1, Number((rawProb * 100).toFixed(1)))
  }, [chosenPicks])

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

  const handleToggleRationale = (pickId: string) => {
    setExpandedRationales(prev => ({
      ...prev,
      [pickId]: !prev[pickId]
    }))
  }

  const handleSelectOutcomeFromModal = (newPick: DailySurePick) => {
    const enriched = {
      ...newPick,
      modelRationale: generateEvidenceRationale(newPick, allLivePicks),
    }
    setChosenPicks((prev) => {
      const idx = prev.findIndex((p) => p.eventId === newPick.eventId)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = enriched
        return next
      }
      return [...prev, enriched]
    })
    setBookingCode(null)
    setBookingError(null)
    setShareUrl(null)
  }

  // ── SportyBet Booking Code API ────────────────────────────────────────────
  const handleGenerateRealBookingCode = async () => {
    if (chosenPicks.length === 0) return
    setIsBooking(true)
    setBookingError(null)
    setBookingCode(null)
    setShareUrl(null)
    setShowCodeModal(true)

    const outcomes = chosenPicks.map((p) => {
      let specifier = p.specifier || ''
      if (!specifier) {
        const full = (p.marketName + ' ' + p.market).toLowerCase()
        const m = full.match(/(\d+\.\d+)/)
        if (m) {
          specifier = `total=${m[1]}`
        }
      }
      return {
        eventId: p.eventId,
        marketId: String(p.marketId),
        outcomeId: String(p.outcomeId),
        specifier: specifier || '',
      }
    })

    try {
      let res = await fetch('/api/local/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomes }),
      }).catch(() => null)

      if (!res || !res.ok) {
        res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcomes }),
        }).catch(() => null)
      }

      if (!res || !res.ok) {
        res = await fetch('http://localhost:3001/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcomes }),
        }).catch(() => null)
      }

      if (res && res.ok) {
        const data = await res.json()
        if (data.success && data.shareCode) {
          setBookingCode(data.shareCode)
          setShareUrl(data.shareUrl || `https://www.sportybet.com/ng/m/sport/football?shareCode=${data.shareCode}`)
          return
        } else {
          setBookingError(data.error || 'Failed to generate real SportyBet booking code')
        }
      } else {
        setBookingError('SportyBet booking service temporarily unreachable. Try again.')
      }
    } catch (err: any) {
      setBookingError(err?.message || 'Error communicating with booking service')
    } finally {
      setIsBooking(false)
    }
  }

  const handleCopyCode = async () => {
    if (!bookingCode) return
    try {
      await navigator.clipboard.writeText(bookingCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleCopySummary = async () => {
    const lines = [
      `ODDS FACTORY BANKER ACCA (${todayDateString.toUpperCase()})`,
      `Total Odds: ${combinedOdds.toFixed(2)}x • Model Survival: ${survivalProbability}%`,
      `Stake: ₦${stake.toLocaleString()} • Return: ₦${potentialReturn.toLocaleString()}`,
      bookingCode ? `SportyBet Booking Code: ${bookingCode}` : '',
      '',
      ...chosenPicks.map(
        (p, i) =>
          `${i + 1}. ${p.matchLabel} (${p.league})\n   Selection: ${p.market} @${p.odds.toFixed(2)} (${p.kickoff})\n   Why: ${p.modelRationale || 'Form and tactical superiority'}`
      ),
      '',
      'Generated with Odds Factory AI',
    ]
      .filter(Boolean)
      .join('\n')

    try {
      await navigator.clipboard.writeText(lines)
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleSendToAudit = () => {
    if (!onSendToAudit || chosenPicks.length === 0) return
    const legs: SlipLeg[] = chosenPicks.map((p) => ({
      id: p.id,
      matchId: p.eventId,
      matchLabel: p.matchLabel,
      sport: 'football',
      profile: 'balanced',
      market: p.market,
      odds: p.odds,
      probability: p.probability || 0.75,
      ev: p.ev || 0.05,
      tier: (p.confidenceTier === 1 ? 1 : p.confidenceTier === 2 ? 2 : 3) as 1 | 2 | 3,
      rationale: p.modelRationale || 'Form and tactical superiority',
      rawSelection: {
        eventId: p.eventId,
        marketId: p.marketId,
        outcomeId: p.outcomeId,
        specifier: p.specifier,
      },
    }))

    const slip: Slip = {
      id: `slip-${Date.now()}`,
      name: `Odds Factory Banker Multi (${combinedOdds.toFixed(2)}x)`,
      mode: 'single_acca',
      legs,
      combinedOdds,
      survivalProbability,
      createdAt: new Date().toISOString(),
      stakePercent: 10,
      stakeAmount: stake,
      status: 'pending',
    }

    onSendToAudit(slip)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-2 sm:px-4 font-sans">
      {/* ── Top Header & Mode Switcher ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0d1612] via-[#121c17] to-[#0d1612] border border-emerald-500/20 text-white shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live SportyBet Feed
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              {allLivePicks.length} markets active · {discoveredCompetitions.length || '35+'} leagues {isLiveConnected && lastFeedTime ? `· synced ${new Date(lastFeedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Odds Factory <span className="text-[#dfff46]">Punter Engine</span>
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed max-w-xl">
            Real football predictions for Nigerian punters. Straight wins, 2UP early payouts, double chance, over 1.5/2.5 goals, GG, and corners. No sterile math equations.
          </p>
        </div>

        {/* Quick Header Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPunterKycModal(true)}
            className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Configure your betting style DNA"
          >
            <i className="fa-solid fa-dna text-emerald-400" />
            <span>DNA: {punterDna.targetProfile.toUpperCase()}</span>
          </button>

          <button
            type="button"
            onClick={handleSurpriseMe}
            disabled={isAnalyzing}
            className="px-4 py-2 rounded-xl bg-[#dfff46] hover:bg-[#d4f63c] text-zinc-950 font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5"
            title="Instant optimal 4-game banker ticket from tonight's top matches"
          >
            <i className="fa-solid fa-dice text-[13px]" />
            <span>Surprise Me</span>
          </button>
        </div>
      </div>

      {/* ── Main Navigation Tabs ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'builder'
                ? 'bg-zinc-950 text-[#dfff46] shadow-sm'
                : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
            }`}
          >
            <i className="fa-solid fa-sliders" />
            <span>Acca Builder & Conditions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('singles')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 relative ${
              activeTab === 'singles'
                ? 'bg-zinc-950 text-[#dfff46] shadow-sm'
                : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
            }`}
          >
            <i className="fa-solid fa-futbol" />
            <span>Tonight's Matches & Singles</span>
            {chosenPicks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#dfff46] text-zinc-950 text-[10px] font-mono font-black ml-1">
                {chosenPicks.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-500 hidden sm:block">
          {chosenPicks.length > 0 ? (
            <span>Slip Active: <b className="text-emerald-700">{chosenPicks.length} games</b> (@{combinedOdds.toFixed(2)}x)</span>
          ) : (
            <span>Select conditions or browse fixtures</span>
          )}
        </div>
      </div>

      {/* ── View 1: Tonight's Matches & Singles Explorer ────────────────── */}
      {activeTab === 'singles' && (
        <div className="space-y-4">
          <EliteSinglesExplorer
            allLivePicks={allLivePicks}
            selectedPickIds={new Set(chosenPicks.map((p) => p.id))}
            onTogglePick={handleTogglePickFromExplorer}
            onInspectPick={(pick) => setInspectingPick(pick)}
          />

          {/* Sticky Floating Slip Bar */}
          {chosenPicks.length > 0 && (
            <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto z-40 p-4 rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-emerald-500/40 text-white shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#dfff46] text-zinc-950 flex items-center justify-center font-black text-sm shrink-0">
                  {chosenPicks.length}
                </span>
                <div>
                  <div className="text-xs font-black text-white">
                    {chosenPicks.length} Match Selections in Slip
                  </div>
                  <div className="text-[11px] text-zinc-300 font-mono">
                    Odds: <b className="text-[#dfff46]">@{combinedOdds.toFixed(2)}x</b> · Return: <b className="text-emerald-400">₦{potentialReturn.toLocaleString()}</b>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('builder')}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Review Slip
                </button>
                <button
                  type="button"
                  onClick={handleGenerateRealBookingCode}
                  disabled={isBooking}
                  className="px-4 py-2 rounded-xl bg-[#dfff46] hover:bg-[#d4f63c] text-zinc-950 font-black text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-ticket" />
                  <span>{isBooking ? 'Booking…' : 'Get SportyBet Code'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── View 2: Acca Builder & Conditions ────────────────────────────── */}
      {activeTab === 'builder' && (
        <>
          {/* ── Control Box: Condition Selectors ── */}
          <section className="card p-5 space-y-5 bg-white border border-zinc-200/90 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-zinc-950 text-[#dfff46] flex items-center justify-center font-mono font-black text-xs">
                  01
                </span>
                <h3 className="text-sm font-black text-zinc-900 tracking-tight">
                  Configure Your Match Conditions
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {isLoadingLive ? 'Syncing SportyBet live lines…' : 'Engine Ready · All Top Competitions Active'}
              </span>
            </div>

            {/* 1. Date & Timeframe Selector */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-zinc-700">
                <span>Match Timeframe & Slate</span>
                <span className="font-mono text-[10px] text-zinc-400 font-normal">Choose kickoff day</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {dateOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleDurationChange(opt.id as MatchDuration)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      duration === opt.id
                        ? 'bg-zinc-950 text-[#dfff46] border-zinc-950 shadow-xs'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200/80'
                    }`}
                  >
                    <div className="font-black text-xs leading-tight truncate">{opt.label}</div>
                    <div className={`text-[10px] font-mono mt-0.5 truncate ${duration === opt.id ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      {opt.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Multi-Select Competition Filter */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                <span>Select Competitions (Multi-Select)</span>
                <span className="font-mono text-[10px] text-emerald-700 font-bold">
                  {selectedCompetitions.includes('ALL') ? 'All Elite Leagues Active' : `${selectedCompetitions.length} Leagues Selected`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COMPETITION_FILTERS.map((comp) => {
                  const isSelected = selectedCompetitions.includes(comp.id)
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => handleToggleCompetition(comp.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs ring-1 ring-emerald-500/40'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      <span>{comp.icon}</span>
                      <span>{comp.label}</span>
                      {isSelected && comp.id !== 'ALL' && (
                        <i className="fa-solid fa-check text-[9px] text-[#dfff46] ml-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. Multi-Select Allowed Market Families */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                <span>Allowed Betting Markets (Multi-Select)</span>
                <span className="font-mono text-[10px] text-emerald-700 font-bold">
                  {selectedMarketFamilies.includes('ALL') ? 'All Punter Markets Active' : `${selectedMarketFamilies.length} Families Selected`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {MARKET_FAMILY_OPTIONS.map((opt) => {
                  const isSelected = selectedMarketFamilies.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleMarketFamily(opt.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-emerald-900 text-emerald-100 border-emerald-700 shadow-xs ring-1 ring-emerald-400/40'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      <i className={`${opt.icon} text-[10px]`} />
                      <span>{opt.label}</span>
                      {isSelected && opt.id !== 'ALL' && (
                        <i className="fa-solid fa-check text-[9px] text-emerald-300 ml-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 4. Ticket Mode: Target Multiplier vs Number of Games */}
            <div className="pt-2 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold text-zinc-700">Ticket Strategy Mode</div>
                <div className="flex items-center gap-1 p-0.5 bg-zinc-100 rounded-xl border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setUseTargetOdds(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !useTargetOdds ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Number of Games ({numGames} Legs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseTargetOdds(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      useTargetOdds ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Target Multiplier (~{targetOdds}x)
                  </button>
                </div>
              </div>

              {!useTargetOdds ? (
                /* Mode A: Number of Games */
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNumGames(n)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          numGames === n
                            ? 'bg-zinc-950 text-[#dfff46] border-zinc-950 shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {n} games
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Mode B: Target Multiplier */
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[2, 3, 5, 10, 15, 20, 30, 50, 100].map((multiplier) => (
                      <button
                        key={multiplier}
                        type="button"
                        onClick={() => {
                          setTargetOdds(multiplier)
                          setCustomOddsInput(String(multiplier))
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          targetOdds === multiplier
                            ? 'bg-zinc-950 text-[#dfff46] border-zinc-950 shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {multiplier}x Odds
                      </button>
                    ))}
                    <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1">
                      <span className="text-xs text-zinc-500 font-mono">Custom:</span>
                      <input
                        type="number"
                        min="1.5"
                        max="500"
                        step="0.5"
                        value={customOddsInput}
                        onChange={(e) => {
                          setCustomOddsInput(e.target.value)
                          const parsed = parseFloat(e.target.value)
                          if (!isNaN(parsed) && parsed >= 1.2) setTargetOdds(parsed)
                        }}
                        className="w-16 bg-transparent text-xs font-mono font-bold text-zinc-950 focus:outline-none"
                        placeholder="e.g. 25"
                      />
                      <span className="text-xs font-mono font-bold text-zinc-400">x</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Risk Strategy Profiles (3 Honest Punter Profiles) */}
            <div className="pt-2 border-t border-zinc-100 space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-zinc-700">
                <span>Risk & Odds Strategy</span>
                <span className="font-mono text-[10px] text-zinc-400 font-normal">
                  ~{currentRisk.minOdds.toFixed(2)}–{currentRisk.maxOdds.toFixed(2)}x per leg
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([1, 2, 3] as RiskLevel[]).map((lvl) => {
                  const r = RISK_CONFIG[lvl]
                  const isSelected = riskLevel === lvl
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setRiskLevel(lvl)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm ring-1 ring-emerald-500/50'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-zinc-800 text-[#dfff46]' : 'bg-zinc-200 text-zinc-700'
                        }`}>
                          {r.tag}
                        </span>
                        <i className={`${r.icon} ${r.color} text-sm`}></i>
                      </div>
                      <div className="font-black text-sm">{r.label}</div>
                      <p className={`text-[11px] leading-relaxed ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {r.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-zinc-500 font-mono">
                Est. Target Multiplier: <b className="text-zinc-950 font-bold">{useTargetOdds ? `~${targetOdds}x` : `~${estimatedOdds.toFixed(2)}x`}</b>
              </div>

              <button
                type="button"
                onClick={handleRunAnalysisAndGenerate}
                disabled={isAnalyzing}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-[#dfff46] font-black text-sm transition-transform active:scale-95 cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                    <span>Analyzing Fixtures ({analysisProgress ? `${analysisProgress.current}/${analysisProgress.total}` : 'Processing…'})</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                    <span>Generate Winning Accumulator</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* ── Generated Selections Slip ─────────────────────────────────── */}
          {hasGenerated && (
            <section className="space-y-4 animate-in fade-in duration-200">
              {/* Slip Summary Header Card */}
              <div className="p-5 rounded-2xl bg-zinc-950 text-white border border-emerald-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                        Analyzed Accumulator Slip
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      {chosenPicks.length} Leg Master Ticket
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <i className={`fa-solid ${copiedSummary ? 'fa-check text-emerald-400' : 'fa-copy'}`} />
                      <span>{copiedSummary ? 'Copied Slip!' : 'Copy Summary'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateRealBookingCode}
                      disabled={isBooking || chosenPicks.length === 0}
                      className="px-5 py-2 rounded-xl bg-[#dfff46] hover:bg-[#d4f63c] text-zinc-950 font-black text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-ticket" />
                      <span>{isBooking ? 'Booking…' : 'Get SportyBet Code'}</span>
                    </button>
                  </div>
                </div>

                {/* Key Numbers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80 space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Combined Multiplier</span>
                    <div className="text-xl sm:text-2xl font-mono font-black text-[#dfff46]">
                      @{combinedOdds.toFixed(2)}x
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80 space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Estimated Return</span>
                    <div className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                      ₦{potentialReturn.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80 space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Model Survival Rate</span>
                    <div className="text-xl sm:text-2xl font-mono font-black text-white">
                      {survivalProbability}%
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80 space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Stake Amount</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-400">₦</span>
                      <input
                        type="number"
                        min="100"
                        step="500"
                        value={stake}
                        onChange={(e) => setStake(Math.max(100, Number(e.target.value)))}
                        className="w-20 bg-transparent text-sm sm:text-base font-mono font-bold text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Assembly Explanation */}
                {assemblyResult && (
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                    <span className="font-bold text-[#dfff46] mr-1.5">Strategy Verdict:</span>
                    {assemblyResult.explanation}
                  </div>
                )}
              </div>

              {/* Individual Matches List */}
              <div className="space-y-3">
                {chosenPicks.map((pick, index) => {
                  const challenge = challengeResults[pick.id]
                  const isExpanded = !!expandedRationales[pick.id]
                  const analysis = analyzedFixtures.find(f => f.fixtureId === pick.eventId)

                  return (
                    <div
                      key={pick.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs hover:border-zinc-300 transition-all space-y-3"
                    >
                      {/* Top Match Info Row */}
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-zinc-800 truncate">
                            {pick.league}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                            • {pick.kickoff}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectingPick(pick)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-chart-simple mr-1 text-emerald-600" />
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePick(pick.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                            title="Remove game from ticket"
                          >
                            <i className="fa-solid fa-trash-can" />
                          </button>
                        </div>
                      </div>

                      {/* Teams & Chosen Market */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-base font-extrabold text-zinc-950 tracking-tight">
                            {pick.homeTeam} <span className="font-normal text-xs text-zinc-400">vs</span> {pick.awayTeam}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[11px]">
                              {pick.badgeLabel || 'Verified Play'}
                            </span>
                            <span className="text-zinc-600 font-semibold">
                              {pick.market}
                            </span>
                            <span className="text-zinc-400 text-[11px]">
                              ({pick.marketName})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center sm:flex-col items-end shrink-0">
                          <span className="text-xl sm:text-2xl font-mono font-black text-zinc-950">
                            @{pick.odds.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-700">
                            {Math.round((pick.probability || 0.75) * 100)}% Model Chance
                          </span>
                        </div>
                      </div>

                      {/* Football Pundit Rationale */}
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-700 leading-relaxed font-normal">
                        <span className="font-bold text-zinc-900 mr-1.5">Pundit Breakdown:</span>
                        {pick.modelRationale || 'Form and tactical superiority favor this selection.'}
                      </div>

                      {/* AI Selection Challenger Swap Alert (if alternative market recommended) */}
                      {challenge && challenge.action === 'REPLACE' && challenge.recommendedAlternative && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="font-bold flex items-center gap-1 text-amber-950">
                              <i className="fa-solid fa-triangle-exclamation text-amber-600" />
                              <span>Alternative Market Suggested:</span>
                            </div>
                            <div className="text-[11px] text-amber-800">
                              {challenge.explanation}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplySwap(pick.id, challenge.recommendedAlternative!)}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                          >
                            Swap to {challenge.recommendedAlternative.market} (@{challenge.recommendedAlternative.odds.toFixed(2)})
                          </button>
                        </div>
                      )}

                      {/* Alternatives Expander */}
                      {analysis && analysis.alternativesConsidered && analysis.alternativesConsidered.length > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleToggleRationale(pick.id)}
                            className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 flex items-center gap-1 cursor-pointer"
                          >
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[9px]`} />
                            <span>{isExpanded ? 'Hide' : 'View'} alternative markets for this game ({analysis.alternativesConsidered.length})</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 space-y-1.5 pl-2 border-l-2 border-zinc-200">
                              {analysis.alternativesConsidered.map((alt, aIdx) => (
                                <div key={aIdx} className="text-xs text-zinc-600 flex items-center justify-between gap-2">
                                  <span>{alt.market} — <b>{alt.selection}</b> (@{alt.decimalOdds.toFixed(2)})</span>
                                  <span className="text-[10px] text-zinc-400 font-mono truncate">{alt.reasonNotChosen}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── SportyBet Booking Code Modal ──────────────────────────────────── */}
      {showCodeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowCodeModal(false)}
        >
          <div
            className="card max-w-md w-full p-6 space-y-4 bg-white border border-zinc-200 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#dfff46] text-zinc-950 flex items-center justify-center text-sm font-black">
                  <i className="fa-solid fa-ticket" />
                </span>
                <div>
                  <h3 className="text-base font-black text-zinc-950">SportyBet Booking Code</h3>
                  <span className="text-[10px] font-mono text-zinc-400">Direct booking integration</span>
                </div>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isBooking ? (
              <div className="py-8 text-center space-y-3">
                <i className="fa-solid fa-circle-notch fa-spin text-3xl text-zinc-900" />
                <div className="text-sm font-bold text-zinc-900">
                  Booking selections with SportyBet…
                </div>
                <p className="text-xs text-zinc-500">
                  Connecting to SportyBet factsCenter to lock in your live code.
                </p>
              </div>
            ) : bookingCode ? (
              <div className="space-y-4">
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-center space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    Booking Code
                  </span>
                  <div className="text-4xl font-mono font-black tracking-widest text-zinc-950 select-all">
                    {bookingCode}
                  </div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">
                    Valid on SportyBet App & Web
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleCopyCode}
                    className="w-full py-3.5 px-4 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <i className={`fa-solid ${copiedCode ? 'fa-check text-emerald-400' : 'fa-copy'}`} />
                    <span>{copiedCode ? 'Copied Code!' : 'Copy Booking Code'}</span>
                  </button>

                  {shareUrl && (
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-[#dfff46] hover:bg-[#d4f63c] text-zinc-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 text-center shadow-xs"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                      <span>Open Direct on SportyBet</span>
                    </a>
                  )}

                  <button
                    onClick={handleSendToAudit}
                    className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-emerald-600" />
                    <span>Open in Slip Auditor & Editor</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed max-h-36 overflow-y-auto">
                  <span className="font-bold block mb-1">Notice:</span>
                  {bookingError
                    ? (bookingError.length > 200 ? bookingError.slice(0, 200) + '…' : bookingError)
                    : 'Odds shifted on SportyBet. Re-roll to get an instantly active slip.'}
                </div>
                <button
                  onClick={() => {
                    setShowCodeModal(false)
                    handleRunAnalysisAndGenerate()
                  }}
                  className="w-full py-3 px-4 bg-zinc-950 hover:bg-zinc-900 text-[#dfff46] font-bold text-xs rounded-xl cursor-pointer"
                >
                  ↻ Re-Roll Fresh Active Games
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Match Intelligence Modal ──────────────────────────────────────── */}
      {inspectingPick && (
        <MatchIntelligenceModal
          matchPick={inspectingPick}
          allEventPicks={allLivePicks}
          onSelectOutcome={handleSelectOutcomeFromModal}
          onClose={() => setInspectingPick(null)}
        />
      )}

      {/* ── Punter KYC DNA Modal ──────────────────────────────────────────── */}
      {showPunterKycModal && (
        <PunterKycModal
          isOpen={showPunterKycModal}
          onClose={() => setShowPunterKycModal(false)}
          currentDna={punterDna}
          onSave={(newDna: PunterDna) => setPunterDna(newDna)}
        />
      )}
    </div>
  )
}
