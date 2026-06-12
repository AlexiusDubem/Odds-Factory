import React, { useState, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import Swal from 'sweetalert2'
import type { Match, OptimizationGoal, OptimizationMode, Slip, SlipLeg, MarketOdds } from '../types'
import { analyzeMatch } from '../engine/markets'
import { SlipLegRow } from './SlipLegRow'
import { ToastContainer, useToast } from './Toast'
import { TicketPreviewModal } from './TicketPreviewModal'
import { HealthScoreCard } from './HealthScoreCard'
import { WeakLinkDetector } from './WeakLinkDetector'
import type { EditResult } from '../engine/slipEditor'
import { analyzeSmartDrops, calculateSlipHealth, type SmartDropResult } from '../engine/smartDropping'
import { auth, db } from '../config/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  matches: Match[]
  slips: Slip[]
  setSlips: (slips: Slip[]) => void
  onSlipUpdated: (slip: Slip) => void
}

// ─── Optimization mode metadata ───────────────────────────────────────────────

const GOAL_OPTIONS: {
  mode: OptimizationMode
  label: string
  icon: string
  description: string
}[] = [
  { mode: 'balanced',        label: 'Smart Drop',       icon: 'fa-solid fa-scissors',      description: 'AI Flags and removes toxic picks to maximize survival.' },
  { mode: 'target_odds',     label: 'Target Odds',      icon: 'fa-solid fa-bullseye',      description: 'Swap risky markets to hit a combined odds payout goal.' },
]

// ─── SportyBet market resolution helpers ─────────────────────────────────────

interface RawSportyMarket {
  id: string | number
  desc?: string
  name?: string
  specifier?: string
  outcomes: Array<{ id: string | number; desc?: string; name?: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcCombinedOdds(legs: SlipLeg[]) { return legs.reduce((a, l) => a * l.odds, 1) }
function calcSurvival(legs: SlipLeg[])      { return legs.reduce((a, l) => a * (l.probability / 100), 1) * 100 }

function parseRawSelection(pick: any) {
  const fm: any = pick.markets?.[0]
  const outcome = pick.outcome || (pick.outcomes && pick.outcomes[0]) || fm?.outcomes?.[0] || pick
  return {
    eventId:  pick.eventId  != null ? String(pick.eventId)  : pick.event_id != null ? String(pick.event_id)  : pick.matchId != null ? String(pick.matchId) : fm?.eventId != null ? String(fm.eventId) : undefined,
    marketId: pick.marketId != null ? String(pick.marketId) : pick.market_id != null ? String(pick.market_id): fm?.marketId != null ? String(fm.marketId) : fm?.id != null ? String(fm.id) : outcome?.marketId != null ? String(outcome.marketId) : undefined,
    outcomeId: pick.outcomeId != null ? String(pick.outcomeId) : pick.outcome_id != null ? String(pick.outcome_id) : pick.selectionId != null ? String(pick.selectionId) : outcome?.id != null ? String(outcome.id) : outcome?.outcomeId != null ? String(outcome.outcomeId) : outcome?.outcome_id != null ? String(outcome.outcome_id) : undefined,
    specifier: pick.specifier != null ? String(pick.specifier) : fm?.specifier != null ? String(fm.specifier) : outcome?.specifier != null ? String(outcome.specifier) : '',
  }
}

function extractRawMarkets(pick: any): RawSportyMarket[] {
  if (!Array.isArray(pick.markets)) return []
  return pick.markets.map((m: any) => ({
    id: m.id ?? m.marketId ?? '',
    desc: m.desc ?? m.name ?? m.marketName ?? '',
    specifier: m.specifier ?? '',
    outcomes: Array.isArray(m.outcomes) ? m.outcomes.map((o: any) => ({ id: o.id ?? o.outcomeId ?? '', desc: o.desc ?? o.name ?? '', odds: o.odds ?? o.odd ?? o.oddsDecimal ?? '2.0' })) : [],
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SlipEditorPanel({ matches, slips, setSlips, onSlipUpdated }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [bookingCode, setBookingCode]     = useState('')
  const [isLoading, setIsLoading]         = useState(false)
  const [goalMode, setGoalMode] = useState<OptimizationMode>('balanced')
  const [targetOdds, setTargetOdds] = useState<number | ''>(20)
  const [targetSurvival, setTargetSurvival] = useState<number | ''>(60)

  // Auto-booking state
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [showGoalPanel, setShowGoalPanel] = useState(false)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [editLog, setEditLog]             = useState<EditResult[]>([])
  const [hasOptimized, setHasOptimized]   = useState(false)
  const [smartDropResult, setSmartDropResult] = useState<SmartDropResult | null>(null)
  const [aiAnalysis, setAiAnalysis]       = useState<string | null>(null)
  const [localMatchMap, setLocalMatchMap] = useState<Map<string, Match>>(
    new Map(matches.map((m) => [m.id, m]))
  )
  const eventMarketsCache = useRef<Map<string, RawSportyMarket[]>>(new Map())

  const selectedSlip = slips[0]
  const currentHealth = selectedSlip ? calculateSlipHealth(selectedSlip.legs, selectedSlip.combinedOdds) : null;



  // ── Load Booking Code ──────────────────────────────────────────────────────

  const handleLoadBookingCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingCode.trim()) return
    setIsLoading(true)
    setEditLog([])
    setHasOptimized(false)
    eventMarketsCache.current.clear()

    try {
      const response = await fetch(`/api/sportybet/orders/share/${bookingCode.toUpperCase()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      if (json.bizCode === 19000 || json.message?.toLowerCase().includes('invalid')) {
        throw new Error(json.message ?? 'Invalid booking code')
      }

      const data = json.data ?? json
      let scrapedPicks: any[] = []
      if (Array.isArray(data))           scrapedPicks = data
      else if (data.outcomes)            scrapedPicks = data.outcomes
      else if (data.selections)          scrapedPicks = data.selections
      else if (data.ticket?.selections)  scrapedPicks = data.ticket.selections
      else if (data.legs)                scrapedPicks = data.legs
      if (!scrapedPicks.length && data.markets) scrapedPicks = data.markets

      if (!scrapedPicks || scrapedPicks.length === 0) {
        throw new Error('No picks found in this booking code or format unsupported')
      }
      const legsToUse = scrapedPicks
      const updatedMap = new Map(localMatchMap)

      const parsedLegs: SlipLeg[] = legsToUse.map((pick: any, i: number) => {
        const pHome: string = pick.homeTeamName ?? pick.homeTeam ?? pick.home ?? ''
        const pAway: string = pick.awayTeamName ?? pick.awayTeam ?? pick.away ?? ''
        let pMarket: string = pick.outcomeName ?? pick.outcome_name ?? pick.marketName ?? pick.market_name ?? ''
        let pOdds: number   = parseFloat(pick.odds ?? pick.odd ?? pick.oddsDecimal ?? '0')

        if (!pMarket && pick.markets?.length > 0) {
          const fm = pick.markets[0]
          const selOut = fm.outcomes?.find((o: any) => o.id != null && String(o.id) === String(pick.outcomeId ?? '')) ?? fm.outcomes?.[0]
          pMarket = selOut ? `${fm.desc ?? ''} — ${selOut.desc ?? ''}`.trim().replace(/^—\s*/, '') : fm.desc ?? ''
          if (!isNaN(parseFloat(selOut?.odds))) pOdds = parseFloat(selOut.odds)
        }

        const rawSelection = parseRawSelection(pick)
        const rawMarkets   = extractRawMarkets(pick)
        if (rawSelection.eventId && rawMarkets.length > 0) {
          eventMarketsCache.current.set(rawSelection.eventId, rawMarkets)
        }

        let matchedGame = matches.find((m) => {
          if (!pHome && !pAway) return false
          return (pHome && m.homeTeam.toLowerCase().includes(pHome.toLowerCase())) ||
                 (pAway && m.awayTeam.toLowerCase().includes(pAway.toLowerCase()))
        })

        if (!matchedGame) {
          const sport = (pick.sport?.name ?? pick.sportName ?? 'football').toLowerCase()
          matchedGame = {
            id: `match-${Date.now()}-${i}`,
            sport: sport,
            homeTeam: pHome || 'Home',
            awayTeam: pAway || 'Away',
            kickoff: pick.date || pick.startTime || new Date().toISOString(),
            isHome: true,
            context: [],
            motivation: 50,
            fatigue: 50,
            injuries: [],
            availableMarkets: [],
            football: sport === 'football' || sport === 'soccer' ? {
              goalsFor: 1.5,
              goalsAgainst: 1.5,
              homeGoalsFor: 1.5,
              homeGoalsAgainst: 1.5,
              awayGoalsFor: 1.5,
              awayGoalsAgainst: 1.5,
              xG: 1.5,
              xGA: 1.5,
              cornersPerGame: 5,
              cleanSheetRate: 0.3,
              bttsRate: 0.5,
              tempo: 50
            } : undefined,
            basketball: sport === 'basketball' ? {
              league: 'other',
              avgTotalPoints: 200,
              pace: 100,
              offensiveRating: 110,
              defensiveRating: 110,
              pointsPerGame: 100,
              reboundsPerGame: 40,
              assistsPerGame: 20,
              homePPG: 100,
              awayPPG: 100,
              starPlayerImpact: 10,
              backToBackGames: 0,
              overUnderHitRate: 0.5
            } : undefined
          }
        }

        const realAvailableMarkets: MarketOdds[] = []
        for (const rm of rawMarkets) {
          if (!rm.desc || !rm.outcomes) continue
          for (const ro of rm.outcomes) {
            const mktName = `${rm.desc} — ${ro.desc}`.replace(/^—\s*/, '')
            const oOdds = parseFloat((ro as any).odds)
            realAvailableMarkets.push({
              market: mktName,
              odds: isNaN(oOdds) ? 2.0 : oOdds,
              marketId: String(rm.id),
              outcomeId: String(ro.id),
              specifier: rm.specifier || ''
            })
          }
        }

        if (!realAvailableMarkets.find(m => m.market === pMarket) && pMarket) {
          realAvailableMarkets.push({ market: pMarket, odds: isNaN(pOdds) ? 2.0 : pOdds })
        }

        const uniqueId = `${matchedGame?.id || 'm'}-${Date.now()}-${i}`

        const enhancedMatch: Match = {
          ...(matchedGame as Match),
          id: uniqueId,
          h2hWinRate:     50,
          formScore:      50,
          learningWeight: 50,
          availableMarkets: realAvailableMarkets.length > 0 ? realAvailableMarkets : (matchedGame?.availableMarkets || []),
        }

        updatedMap.set(uniqueId, enhancedMatch)

        const analysis    = analyzeMatch(enhancedMatch)
        const displayMkt  = pMarket || enhancedMatch.availableMarkets.at(-1)?.market || '1X2'
        const displayOdds = isNaN(pOdds) ? (enhancedMatch.availableMarkets.at(-1)?.odds ?? 2.0) : pOdds

        return {
          id: `leg-${Date.now()}-${i}`,
          matchId: uniqueId,
          matchLabel: pHome && pAway ? `${pHome} vs ${pAway}` : `${enhancedMatch.homeTeam} vs ${enhancedMatch.awayTeam}`,
          sport:   pick.sport?.name ?? pick.sportName ?? enhancedMatch.sport,
          profile: analysis.profile,
          market:  displayMkt,
          odds:    displayOdds,
          probability: Math.max(1, Math.min(95, Math.round((1 / displayOdds) * 100 * 0.90))),
          ev: 0.8,
          tier: 3 as const,
          rationale: 'Analyzed live. Run AI Optimization to reveal insights.',
          isOriginal: true,
          rawSelection,
        }
      })

      const newSlip = {
        id: `slip-${Date.now()}`,
        name: `Code: ${bookingCode.toUpperCase()}`,
        mode: 'single_acca' as const,
        legs: parsedLegs,
        combinedOdds: calcCombinedOdds(parsedLegs),
        survivalProbability: calcSurvival(parsedLegs),
        createdAt: new Date().toISOString(),
        stakePercent: 10,
      }
      setLocalMatchMap(updatedMap)
      setSlips([newSlip])
      setBookingCode('')
      toast('success', 'Slip Loaded', `${parsedLegs.length} leg${parsedLegs.length !== 1 ? 's' : ''} imported. Auto-saving...`)
      
      // Auto-save slip to dashboard and log global matches
      if (auth.currentUser) {
        try {
          const slipsRef = collection(db, 'users', auth.currentUser.uid, 'slips')
          await addDoc(slipsRef, {
            name: newSlip.name,
            combinedOdds: newSlip.combinedOdds,
            survivalProbability: newSlip.survivalProbability,
            legs: newSlip.legs,
            status: 'active',
            createdAt: serverTimestamp()
          })

          const globalMatchesRef = collection(db, 'processed_matches')
          for (const leg of parsedLegs) {
            await addDoc(globalMatchesRef, {
              matchLabel: leg.matchLabel,
              sport: leg.sport,
              market: leg.market,
              odds: leg.odds,
              probability: leg.probability,
              processedAt: serverTimestamp(),
              processedBy: auth.currentUser.uid
            })
          }
        } catch (e) {
          console.error("Failed to auto-save to Firestore:", e)
        }
      }
    } catch (err: any) {
      console.error('Load failed:', err)
      toast('error', 'Load Failed', err.message ?? 'Could not load the booking code.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Save Slip to Firestore ────────────────────────────────────────────────

  const handleSaveSlip = async () => {
    if (!selectedSlip) return
    if (!auth.currentUser) {
      toast('error', 'Not Logged In', 'You must be logged in to save slips.')
      return
    }

    setIsSaving(true)
    try {
      const slipsRef = collection(db, 'users', auth.currentUser.uid, 'slips')
      await addDoc(slipsRef, {
        name: selectedSlip.name,
        combinedOdds: selectedSlip.combinedOdds,
        survivalProbability: selectedSlip.survivalProbability,
        legs: selectedSlip.legs,
        createdAt: serverTimestamp(),
        status: 'active'
      })
      toast('success', 'Slip Saved!', 'Check My Slips to view it anytime.')
    } catch (err: any) {
      console.error('Save error:', err)
      toast('error', 'Save Failed', err.message || 'Could not save slip.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Auto-Booking ──────────────────────────────────────────────────────────

  const handleGenerateCode = async () => {
    if (!selectedSlip) return
    setIsGenerating(true)
    setGeneratedCode(null)

    const selections = selectedSlip.legs.map(l => l.rawSelection).filter(Boolean)
    
    if (selections.length === 0) {
      toast('error', 'Generation Failed', 'No valid market data available to book.')
      setIsGenerating(false)
      return
    }

    try {
      // Connects to local Playwright server (must be running on localhost:3001)
      const res = await fetch('/api/local/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections })
      })
      if (!res.ok) throw new Error('Failed to connect to local booking server.')
      const data = await res.json()
      if (data.success && data.shareCode) {
        setGeneratedCode(data.shareCode)
        Swal.fire({
          title: 'Code Generated!',
          html: `<p>Your fresh SportyBet code is:</p><h1 class="text-4xl font-black text-slate-900 tracking-[0.2em] my-4">${data.shareCode}</h1>`,
          icon: 'success',
          confirmButtonColor: '#16a34a'
        })
      } else {
        throw new Error(data.message || 'Unknown error from server')
      }
    } catch (err: any) {
      console.error(err)
      Swal.fire({
        title: 'Auto-Booker Unavailable',
        text: 'To generate codes, you must be running the local Odds Factory booking server (npm run server). Make sure it is active!',
        icon: 'error',
        confirmButtonColor: '#16a34a'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Optimize ───────────────────────────────────────────────────────────────

  const handleOptimize = useCallback(async () => {
    if (!selectedSlip) return
    const goal: OptimizationGoal = {
      mode: goalMode,
      targetOdds:     goalMode === 'target_odds'     ? Number(targetOdds) || 20     : undefined,
      targetSurvival: goalMode === 'target_survival' ? Number(targetSurvival) || 60 : undefined,
    }

    setIsOptimizing(true)
    try {
      const result = await analyzeSmartDrops(selectedSlip, goal);
      setSmartDropResult(result);
      setShowGoalPanel(false);
      
      if (result.droppedLegs.length > 0) {
        toast('info', 'AI Analysis Complete', 'Weak links detected. Review the recommendations to optimize your ticket.');
      } else {
        toast('success', 'Perfect Slip!', 'Your ticket is mathematically sound. No drops recommended.');
      }
    } catch (err: any) {
      toast('error', 'Analysis Failed', err.message || 'The AI could not analyze your slip right now.')
      console.error(err)
    } finally {
      setIsOptimizing(false)
    }
  }, [selectedSlip, goalMode, targetOdds, targetSurvival])

  const handleApplyDrops = (legIdsToDrop: string[]) => {
    if (!selectedSlip) return;
    
    // Log dropped picks to analytics database
    if (auth.currentUser && smartDropResult) {
      const droppedPicksRef = collection(db, 'dropped_picks')
      for (const droppedLeg of smartDropResult.droppedLegs) {
        if (legIdsToDrop.includes(droppedLeg.legId)) {
          const legDetail = selectedSlip.legs.find(l => l.id === droppedLeg.legId)
          if (legDetail) {
             addDoc(droppedPicksRef, {
               matchLabel: legDetail.matchLabel,
               market: legDetail.market,
               odds: legDetail.odds,
               ev: droppedLeg.ev,
               rationale: droppedLeg.rationale,
               userId: auth.currentUser.uid,
               droppedAt: serverTimestamp()
             }).catch(console.error)
          }
        }
      }
    }

    const newLegs = selectedSlip.legs.filter(l => !legIdsToDrop.includes(l.id));
    const optimizedSlipData = { 
      ...selectedSlip, 
      legs: newLegs, 
      combinedOdds: calcCombinedOdds(newLegs), 
      survivalProbability: calcSurvival(newLegs) 
    };

    onSlipUpdated(optimizedSlipData);
    setSmartDropResult(null);
    toast('success', 'Slip Optimized', 'Weak links successfully dropped.');

    // Log the final slip to recent_optimizations for the dashboard feed
    if (auth.currentUser) {
      addDoc(collection(db, 'users', auth.currentUser.uid, 'recent_optimizations'), {
        ...optimizedSlipData,
        createdAt: serverTimestamp()
      }).catch(console.error);
    }
  };

  // ── Remove / Clear ─────────────────────────────────────────────────────────

  const handleRemoveLeg = (legId: string) => {
    if (!selectedSlip) return
    const newLegs = selectedSlip.legs.filter((l) => l.id !== legId)
    onSlipUpdated({ ...selectedSlip, legs: newLegs, combinedOdds: calcCombinedOdds(newLegs), survivalProbability: calcSurvival(newLegs) })
  }

  const handleClear = () => {
    setSlips([])
    setEditLog([])
    setHasOptimized(false)
    eventMarketsCache.current.clear()
  }

  // ─── RENDER — empty state ─────────────────────────────────────────────────

  if (slips.length === 0) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-4xl text-accent mb-8 shadow-sm">
            <i className="fa-solid fa-cloud-arrow-down" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Import Booking Code</h2>
          <p className="text-sm text-slate-500 mb-10 max-w-sm text-center leading-relaxed">
            Paste your SportyBet booking code. The engine analyses every pick and helps you optimise for better survival rates.
          </p>
          <form onSubmit={handleLoadBookingCode} className="w-full max-w-md flex flex-col gap-3">
            <input
              id="booking-code-input"
              type="text"
              placeholder="e.g. X60VQ9"
              value={bookingCode}
              onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
              disabled={isLoading}
              className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-2xl bg-white border-2 border-border focus:border-accent/60 text-slate-900 placeholder:text-slate-400 focus:outline-none text-center font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-base sm:text-lg shadow-sm transition-colors"
            />
            <div className="relative group w-full">
              <button
                id="load-code-btn"
                type="submit"
                disabled={isLoading || !bookingCode.trim()}
                className="relative inline-block w-full p-px font-semibold leading-6 text-slate-900 bg-white shadow-xl cursor-pointer rounded-2xl transition-transform duration-300 ease-in-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-400 via-blue-500 to-purple-500 p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative z-10 block px-4 sm:px-5 py-3 sm:py-4 rounded-2xl bg-slate-950 border border-slate-800 group-hover:border-transparent transition-colors">
                  <div className="relative z-10 flex items-center justify-center space-x-2 text-white">
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-download transition-transform duration-500 group-hover:-translate-y-1" />}
                    <span className="transition-all duration-500 group-hover:translate-x-1 text-sm sm:text-base">{isLoading ? 'Loading picks…' : 'Load Booking Code'}</span>
                  </div>
                </span>
              </button>
            </div>
          </form>
        </div>
      </>
    )
  }

  // ─── RENDER — slip loaded ─────────────────────────────────────────────────

  const survivalColor = selectedSlip.survivalProbability >= 60 ? 'text-emerald-600' : selectedSlip.survivalProbability >= 40 ? 'text-amber-500' : 'text-red-500'

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="space-y-5 max-w-4xl mx-auto w-full overflow-x-hidden">

        {/* ── Header bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-white border border-border shadow-sm gap-4 w-full">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200 tracking-wide break-all max-w-[200px] truncate">{selectedSlip.name}</span>
              <span className="text-sm text-slate-500 font-medium whitespace-nowrap">{selectedSlip.legs.length} {selectedSlip.legs.length === 1 ? 'leg' : 'legs'}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 break-words">
              Survival: <strong className={survivalColor}>{selectedSlip.survivalProbability < 0.1 ? '<0.1' : selectedSlip.survivalProbability.toFixed(1)}%</strong>
              {' · '}Combined Odds: <strong className="text-accent">{selectedSlip.combinedOdds.toFixed(2)}</strong>
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 w-full sm:w-auto">
            <button id="save-slip-btn" onClick={handleSaveSlip} disabled={isSaving || !selectedSlip} className="w-full sm:w-auto px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-semibold text-sm border border-slate-200 shadow-sm disabled:opacity-50 flex items-center justify-center whitespace-nowrap">
              {isSaving ? <i className="fa-solid fa-circle-notch fa-spin mr-2" /> : <i className="fa-regular fa-bookmark mr-2" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button id="clear-slip-btn" onClick={handleClear} className="w-full sm:w-auto px-4 sm:px-4 py-3 sm:py-2.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold text-sm border border-transparent flex items-center justify-center whitespace-nowrap">
              <i className="fa-solid fa-times mr-1.5" />Clear
            </button>
            <button id="optimize-btn" onClick={() => setShowGoalPanel((v) => !v)} className="w-full sm:w-auto px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-700 font-bold transition-all shadow-sm border border-violet-200 flex items-center justify-center gap-2 whitespace-nowrap">
              <i className="fa-solid fa-wand-magic-sparkles" />AI Optimize
            </button>
            <div className="relative group w-full sm:w-auto sm:ml-2">
              <button id="generate-code-btn" onClick={handleGenerateCode} disabled={isGenerating} className="relative flex w-full p-px font-black leading-6 text-white bg-accent shadow-xl cursor-pointer rounded-xl transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center">
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-500 to-green-500 p-[2px] opacity-100" />
                <span className="relative z-10 flex w-full items-center justify-center px-4 sm:px-6 py-3 sm:py-2.5 rounded-xl bg-accent border border-transparent transition-colors shadow-inner">
                  <div className="relative z-10 flex items-center justify-center space-x-2 text-white">
                    {isGenerating ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-bolt" />}
                    <span className="tracking-wide text-[10px] sm:text-sm">{isGenerating ? 'GENERATING...' : 'GENERATE SPORTYBET CODE'}</span>
                  </div>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Dashboard Health Score & Weak Links ──────────────────────────── */}
        {currentHealth && (
          <div className="mt-6 mb-8 w-full overflow-hidden">
            <HealthScoreCard health={currentHealth} />
          </div>
        )}

        <WeakLinkDetector 
          smartDropResult={smartDropResult} 
          onApplyDrops={handleApplyDrops} 
          onCancel={() => setSmartDropResult(null)} 
        />

        {generatedCode && (
          <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm animate-in zoom-in duration-300 gap-4">
            <div className="w-full">
              <p className="text-[10px] sm:text-xs text-emerald-600 font-bold tracking-widest uppercase mb-1 flex items-center gap-2">
                <i className="fa-solid fa-check-circle"></i> Booking Code Generated
              </p>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-[0.1em] sm:tracking-[0.25em] drop-shadow-sm break-all">{generatedCode}</h1>
            </div>
            <button 
              onClick={() => { navigator.clipboard.writeText(generatedCode); toast('success', 'Copied!', 'Code copied to clipboard') }}
              className="w-full sm:w-14 h-12 sm:h-14 rounded-xl bg-white border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-600 hover:text-white hover:bg-emerald-500 hover:border-transparent transition-all hover:scale-105 active:scale-95 group shrink-0"
            >
              <i className="fa-regular fa-copy text-2xl group-hover:scale-110 transition-transform"></i>
            </button>
          </div>
        )}

        {/* ── AI Analysis Panel ────────────────────────────────────────────── */}
        {aiAnalysis && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 space-y-4 shadow-sm backdrop-blur-md relative overflow-hidden transition-all">
            <div className="absolute top-0 right-0 p-4">
              <button onClick={() => setAiAnalysis(null)} className="text-violet-400 hover:text-violet-600 transition-colors">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <h3 className="text-base font-bold text-violet-900 flex items-center gap-2">
              <i className="fa-solid fa-brain text-violet-600 animate-pulse" /> Gemini AI Match Deep Research
            </h3>
            <div className="text-slate-700 text-sm leading-relaxed font-sans">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-6 mb-3 text-violet-950" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-5 mb-2 text-violet-950" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-md font-bold mt-4 mb-2 text-violet-900" {...props} />,
                  h4: ({node, ...props}) => <h4 className="text-base font-bold mt-3 mb-1 text-violet-900" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1.5" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1.5" {...props} />,
                  li: ({node, ...props}) => <li className="pl-1" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-violet-950" {...props} />,
                  em: ({node, ...props}) => <em className="italic text-violet-800" {...props} />,
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* ── Goal panel ────────────────────────────────────────────────────── */}
        {showGoalPanel && (
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-accent" />Optimization Goal
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {GOAL_OPTIONS.map((opt) => (
                <button key={opt.mode} onClick={() => setGoalMode(opt.mode)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium text-center transition-all ${goalMode === opt.mode ? 'bg-accent text-white border-accent shadow-sm' : 'bg-white text-slate-600 border-border hover:border-accent/40'}`}>
                  <i className={`${opt.icon} text-base`} /><span>{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{GOAL_OPTIONS.find((o) => o.mode === goalMode)?.description}</p>
            {goalMode === 'target_odds' && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Max Combined Odds</label>
                <input id="target-odds-input" type="number" min={2} max={10000} step={0.5} value={targetOdds}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setTargetOdds(isNaN(val) ? '' : val)
                  }}
                  className="w-28 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
            )}
            {goalMode === 'target_survival' && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Min Survival Rate (%)</label>
                <input id="target-survival-input" type="number" min={10} max={99} step={1} value={targetSurvival}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setTargetSurvival(isNaN(val) ? '' : val)
                  }}
                  className="w-28 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
            )}
            <div className="relative group w-full">
              <button id="apply-optimize-btn" onClick={handleOptimize} disabled={isOptimizing} className="relative inline-block w-full p-px font-semibold leading-6 text-slate-900 bg-white shadow-md cursor-pointer rounded-xl transition-transform duration-300 ease-in-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400 via-blue-500 to-purple-500 p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative z-10 block py-3 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-transparent transition-colors">
                  <div className="relative z-10 flex items-center justify-center space-x-2 text-white">
                    {isOptimizing ? <i className="fa-solid fa-circle-notch fa-spin text-accent" /> : <i className="fa-solid fa-wand-magic-sparkles transition-transform duration-500 group-hover:rotate-12 text-accent" />}
                    <span className="transition-all duration-500 group-hover:translate-x-1">{isOptimizing ? 'AI is Optimizing...' : 'Apply Optimization'}</span>
                  </div>
                </span>
              </button>
            </div>
          </div>
        )}



        {/* ── Legs ─────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {selectedSlip.legs.map((leg, i) => (
            <SlipLegRow key={leg.id} leg={leg} index={i} onRemove={() => handleRemoveLeg(leg.id)} />
          ))}
        </div>

        {/* ── Optimization log ─────────────────────────────────────────────── */}
        {hasOptimized && editLog.length > 0 && (
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-clipboard-list text-accent" />Optimization Log
            </h4>
            <ul className="space-y-2">
              {editLog.map((entry, i) => (
                <li key={i} className={`flex items-start gap-3 text-sm ${entry.changed ? (entry.dropped ? 'text-red-500 font-medium' : 'text-slate-700') : 'text-slate-400'}`}>
                  <i className={`mt-0.5 shrink-0 ${entry.changed ? (entry.dropped ? 'fa-solid fa-trash' : 'fa-solid fa-arrow-right-arrow-left text-accent') : 'fa-solid fa-check text-slate-300'}`} />
                  {entry.message}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-border">
              {editLog.filter((e) => e.changed).length} change{editLog.filter((e) => e.changed).length !== 1 ? 's' : ''} made · {editLog.filter((e) => !e.changed).length} kept as-is
            </p>
          </div>
        )}
      </div>

      {showTicketPreview && <TicketPreviewModal slip={selectedSlip} onClose={() => setShowTicketPreview(false)} />}
    </>
  )
}
