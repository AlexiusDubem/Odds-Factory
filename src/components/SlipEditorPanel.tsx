import React, { useState, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import Swal from 'sweetalert2'
import type { Match, OptimizationGoal, OptimizationMode, Slip, SlipLeg, MarketOdds } from '../types'
import { optimizeSlipWithGoal } from '../engine/slipEditor'
import { analyzeMatch } from '../engine/markets'
import { SlipLegRow } from './SlipLegRow'
import { ToastContainer, useToast } from './Toast'
import { TicketPreviewModal } from './TicketPreviewModal'
import type { EditResult } from '../engine/slipEditor'

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
  { mode: 'target_odds',     label: 'Target Odds',     icon: 'fa-solid fa-bullseye',      description: 'Swap risky markets to bring combined odds within your target' },
  { mode: 'target_survival', label: 'Target Survival',  icon: 'fa-solid fa-shield-halved', description: 'Upgrade markets until your slip hits a minimum survival rate' },
  { mode: 'best_ev',         label: 'Best EV',          icon: 'fa-solid fa-chart-line',    description: 'Swap each leg to the highest expected-value market available' },
  { mode: 'safe_mode',       label: 'Safe Mode',        icon: 'fa-solid fa-lock',          description: 'Replace every leg with its safest Tier-1 qualifying market' },
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
  const [goalMode, setGoalMode]           = useState<OptimizationMode>('safe_mode')
  const [targetOdds, setTargetOdds]       = useState<number | ''>(20)
  const [targetSurvival, setTargetSurvival] = useState<number | ''>(60)
  const [showGoalPanel, setShowGoalPanel] = useState(false)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [editLog, setEditLog]             = useState<EditResult[]>([])
  const [hasOptimized, setHasOptimized]   = useState(false)
  const [isAnalyzing, setIsAnalyzing]     = useState(false)
  const [aiAnalysis, setAiAnalysis]       = useState<string | null>(null)
  const [localMatchMap, setLocalMatchMap] = useState<Map<string, Match>>(
    new Map(matches.map((m) => [m.id, m]))
  )
  const eventMarketsCache = useRef<Map<string, RawSportyMarket[]>>(new Map())

  const selectedSlip = slips[0]

  // ── AI Analysis (Direct via Gemini API) ────────────────────────────────────

  const handleGetAIAnalysis = async () => {
    if (!selectedSlip || selectedSlip.legs.length === 0) return
    setIsAnalyzing(true)
    setAiAnalysis(null)
    try {
      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
      const prompt = `You are Odds Factory's Advanced Sports Analyst. Analyze the following betting slip selections. Provide a premium, highly professional match overview, security evaluation, and recommendations for each match. Format the output in Markdown with elegant headers and structured lists. Use emojis to make it look visually stunning.

Slip details:
${selectedSlip.legs.map((l, i) => `
${i + 1}. Match: ${l.matchLabel}
   - Chosen Market: ${l.market} (Odds: ${l.odds.toFixed(2)})
   - Confidence Tier: Tier ${l.tier || '3'}
   - Rationale: ${l.rationale}
`).join('\n')}

Please return:
1. 🛡️ **Overall Ticket Risk Assessment**: Brief summary of the ticket's safety and expected value.
2. 📊 **Leg-by-Leg Detailed Analysis**: Detailed tactical/statistical context for each matchup.
3. 💡 **Suggested Optimization/Tweaks**: Specific recommendations to further reduce risk or improve odds.`

      let res: Response | null = null;
      let attempt = 0;
      const maxRetries = 3;

      while (attempt < maxRetries) {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        })

        if (res.ok) break;
        if (res.status === 503) {
          attempt++;
          if (attempt >= maxRetries) break;
          await new Promise(r => setTimeout(r, 2000 * attempt)); // wait 2s, 4s...
        } else {
          break;
        }
      }

      if (!res || !res.ok) {
        let errMsg = `API Error ${res?.status}`;
        try {
          const errJson = await res?.json()
          if (errJson?.error?.message) {
            errMsg = errJson.error.message;
          }
        } catch {
           try { errMsg = await res?.text() || errMsg } catch {}
        }
        if (res?.status === 503) {
          throw new Error('AI is currently experiencing high demand. Please wait a moment and try again.')
        }
        throw new Error(errMsg)
      }

      const resJson = await res.json()
      const markdown = resJson.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.'

      setAiAnalysis(markdown)
      toast('success', 'AI Analysis Ready', 'Gemini AI has completed deep research on your slip.')
    } catch (err: any) {
      console.error('AI Analysis error:', err)
      toast('error', 'Analysis Failed', err.message || 'Could not fetch AI analysis.')
    } finally {
      setIsAnalyzing(false)
    }
  }



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

        const matchedGame = matches.find((m) => {
          if (!pHome && !pAway) return false
          return (pHome && m.homeTeam.toLowerCase().includes(pHome.toLowerCase())) ||
                 (pAway && m.awayTeam.toLowerCase().includes(pAway.toLowerCase()))
        }) ?? matches[i % matches.length]

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

        const enhancedMatch: Match = {
          ...matchedGame,
          h2hWinRate:     50,
          formScore:      50,
          learningWeight: 50,
          availableMarkets: realAvailableMarkets.length > 0 ? realAvailableMarkets : matchedGame.availableMarkets,
        }

        const uniqueId = `${enhancedMatch.id}-${Date.now()}-${i}`
        enhancedMatch.id = uniqueId
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
          rationale: 'Scraped from SportyBet — optimize to improve this pick.',
          isOriginal: true,
          rawSelection,
        }
      })

      setLocalMatchMap(updatedMap)
      setSlips([{
        id: `slip-${Date.now()}`,
        name: `Code: ${bookingCode.toUpperCase()}`,
        mode: 'single_acca',
        legs: parsedLegs,
        combinedOdds:       calcCombinedOdds(parsedLegs),
        survivalProbability: calcSurvival(parsedLegs),
        createdAt:   new Date().toISOString(),
        stakePercent: 10,
      }])
      setBookingCode('')
      toast('success', 'Slip Loaded', `${parsedLegs.length} leg${parsedLegs.length !== 1 ? 's' : ''} imported. Set your goal and click Optimize.`)
    } catch (err: any) {
      console.error('Load failed:', err)
      toast('error', 'Load Failed', err.message ?? 'Could not load the booking code.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Optimize ───────────────────────────────────────────────────────────────

  const handleOptimize = useCallback(() => {
    if (!selectedSlip) return
    const goal: OptimizationGoal = {
      mode: goalMode,
      targetOdds:     goalMode === 'target_odds'     ? Number(targetOdds) || 20     : undefined,
      targetSurvival: goalMode === 'target_survival' ? Number(targetSurvival) || 60 : undefined,
    }
    const { slip, edits } = optimizeSlipWithGoal(selectedSlip, localMatchMap, goal)
    onSlipUpdated(slip)
    setEditLog(edits)
    setHasOptimized(true)
    setShowGoalPanel(false)
    const changed = edits.filter((e) => e.changed).length
    const droppedLegs = edits.filter((e) => e.dropped)

    if (droppedLegs.length > 0) {
      const messages = droppedLegs.map(e => `• ${e.leg.matchLabel} (${e.leg.market})`).join('\n')
      Swal.fire({
        title: 'Risky Legs Removed!',
        text: `To meet your optimization goal, the engine removed the following extremely high-risk legs entirely:\n\n${messages}`,
        icon: 'warning',
        confirmButtonColor: '#16a34a'
      })
    }

    if (changed > 0) {
      toast('success', `${changed} leg${changed > 1 ? 's' : ''} optimized`, 'Review below, then View Optimized Ticket.')
    } else {
      toast('info', 'Already Optimal', 'No swaps needed for this goal.')
    }
  }, [selectedSlip, localMatchMap, goalMode, targetOdds, targetSurvival, onSlipUpdated])

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
              className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-border focus:border-accent/60 text-slate-900 placeholder:text-slate-400 focus:outline-none text-center font-bold tracking-[0.3em] uppercase text-lg shadow-sm transition-colors"
            />
            <div className="relative group w-full">
              <button
                id="load-code-btn"
                type="submit"
                disabled={isLoading || !bookingCode.trim()}
                className="relative inline-block w-full p-px font-semibold leading-6 text-slate-900 bg-white shadow-xl cursor-pointer rounded-2xl transition-transform duration-300 ease-in-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-400 via-blue-500 to-purple-500 p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative z-10 block px-5 py-4 rounded-2xl bg-slate-950 border border-slate-800 group-hover:border-transparent transition-colors">
                  <div className="relative z-10 flex items-center justify-center space-x-2 text-white">
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-download transition-transform duration-500 group-hover:-translate-y-1" />}
                    <span className="transition-all duration-500 group-hover:translate-x-1">{isLoading ? 'Loading picks…' : 'Load Booking Code'}</span>
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
      <div className="space-y-5 max-w-4xl mx-auto">

        {/* ── Header bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-5 rounded-2xl bg-white border border-border shadow-sm gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200 tracking-wide">{selectedSlip.name}</span>
              <span className="text-sm text-slate-500 font-medium">{selectedSlip.legs.length} {selectedSlip.legs.length === 1 ? 'leg' : 'legs'}</span>
            </div>
            <p className="text-sm text-slate-600">
              Survival: <strong className={survivalColor}>{selectedSlip.survivalProbability < 0.1 ? '<0.1' : selectedSlip.survivalProbability.toFixed(1)}%</strong>
              {' · '}Combined Odds: <strong className="text-accent">{selectedSlip.combinedOdds.toFixed(2)}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button id="clear-slip-btn" onClick={handleClear} className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium text-sm border border-transparent hover:border-border">
              <i className="fa-solid fa-times mr-2" />Clear
            </button>
            <button id="ai-analysis-btn" onClick={handleGetAIAnalysis} disabled={isAnalyzing} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-all shadow-sm shadow-violet-200 flex items-center gap-2 disabled:opacity-50">
              {isAnalyzing ? <i className="fa-solid fa-circle-notch fa-spin animate-spin" /> : <i className="fa-solid fa-brain" />}
              {isAnalyzing ? 'Analyzing…' : 'AI Analysis'}
            </button>
            <button id="optimize-btn" onClick={() => setShowGoalPanel((v) => !v)} className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-muted text-white font-semibold transition-all shadow-sm shadow-accent/20 flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles" />Optimize
            </button>
            <div className="relative group">
              <button id="view-ticket-btn" onClick={() => setShowTicketPreview(true)} className="relative inline-block p-px font-semibold leading-6 text-slate-900 bg-white shadow-md cursor-pointer rounded-xl transition-transform duration-300 ease-in-out hover:scale-105 active:scale-95">
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400 via-blue-500 to-purple-500 p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative z-10 block px-5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-transparent transition-colors">
                  <div className="relative z-10 flex items-center justify-center space-x-2 text-white">
                    <i className="fa-solid fa-receipt transition-transform duration-500 group-hover:-translate-y-1 text-accent" />
                    <span className="transition-all duration-500 group-hover:translate-x-1">View Optimized Ticket</span>
                  </div>
                </span>
              </button>
            </div>
          </div>
        </div>

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              <button id="apply-optimize-btn" onClick={handleOptimize} className="relative inline-block w-full p-px font-semibold leading-6 text-slate-900 bg-white shadow-md cursor-pointer rounded-xl transition-transform duration-300 ease-in-out hover:scale-[1.02] active:scale-[0.98]">
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400 via-blue-500 to-purple-500 p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative z-10 block py-3 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-transparent transition-colors">
                  <div className="relative z-10 flex items-center justify-center space-x-2 text-white">
                    <i className="fa-solid fa-wand-magic-sparkles transition-transform duration-500 group-hover:rotate-12 text-accent" />
                    <span className="transition-all duration-500 group-hover:translate-x-1">Apply Optimization</span>
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
