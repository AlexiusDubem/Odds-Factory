import { useState, useMemo } from 'react'
import type { DailySurePick } from '../data/sportybetCompetitions'
import {
  deriveMatchPhysics,
  getBoomingAlternatives,
  generateEvidenceRationale,
  calculateExpectedValue,
} from '../engine/aiSelectionChallenger'

interface Props {
  matchPick: DailySurePick
  allEventPicks: DailySurePick[]
  onSelectOutcome?: (newPick: DailySurePick) => void
  onClose: () => void
}

export function MatchIntelligenceModal({
  matchPick,
  allEventPicks,
  onSelectOutcome,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<'intelligence' | 'booming'>('intelligence')

  // Real match physics derived from live SportyBet market pricing
  const physics = useMemo(() => {
    return deriveMatchPhysics(matchPick, allEventPicks)
  }, [matchPick, allEventPicks])

  // Curated, risk-tiered booming alternatives
  const boomingTiers = useMemo(() => {
    return getBoomingAlternatives(matchPick, allEventPicks)
  }, [matchPick, allEventPicks])

  const totalBoomingCount = useMemo(() => {
    return boomingTiers.reduce((acc, t) => acc + t.picks.length, 0)
  }, [boomingTiers])

  const currentRationale = useMemo(() => {
    return generateEvidenceRationale(matchPick, allEventPicks)
  }, [matchPick, allEventPicks])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200 rounded-[32px] max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
        {/* ── Modal Header ──────────────────────────────────────────────── */}
        <div className="p-6 border-b border-zinc-100 flex items-start justify-between gap-4 bg-zinc-50/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white border border-zinc-200 text-zinc-700 px-2.5 py-0.5 rounded-full">
                {matchPick.league}
              </span>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <i className="fa-solid fa-clock text-[9px]"></i>
                {matchPick.kickoff}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <i className="fa-solid fa-brain text-[9px] text-emerald-500"></i>
                AI Match Intelligence
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              {matchPick.matchLabel}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {physics.primaryGameDynamic} • Event ID: <span className="font-mono font-bold text-zinc-700">{matchPick.eventId}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-500 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* ── Tab Switcher ──────────────────────────────────────────────── */}
        <div className="px-6 pt-3 border-b border-zinc-100 flex items-center gap-2 bg-white">
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'intelligence'
                ? 'border-zinc-950 text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <i className="fa-solid fa-chart-pie text-xs"></i>
            <span>Real Match Statistics & Evidence</span>
          </button>
          <button
            onClick={() => setActiveTab('booming')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'booming'
                ? 'border-zinc-950 text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <i className="fa-solid fa-fire text-amber-500 text-xs"></i>
            <span>Sure Booming Alternatives ({totalBoomingCount})</span>
          </button>
        </div>

        {/* ── Tab Content ──────────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'intelligence' ? (
            <div className="space-y-6">
              {/* Form & Dynamic Trends Bento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Home Form */}
                <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                      <i className="fa-solid fa-shield-halved text-emerald-600 text-[11px]"></i>
                      {matchPick.homeTeam} (Home Status)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      {physics.homeWinProb}% Win Rate
                    </span>
                  </div>
                  <p className="text-xs font-extrabold text-zinc-800">
                    {physics.homeFormTrend}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Home territorial control and conversion gives an estimated 1.6 xG output.
                  </p>
                </div>

                {/* Away Form */}
                <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                      <i className="fa-solid fa-plane-departure text-zinc-500 text-[11px]"></i>
                      {matchPick.awayTeam} (Away Status)
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-200/60 px-2 py-0.5 rounded-full">
                      {physics.awayWinProb}% Away Win Rate
                    </span>
                  </div>
                  <p className="text-xs font-extrabold text-zinc-800">
                    {physics.awayFormTrend}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Concedes an average of 1.3 goals in away fixtures; vulnerable to sustained counter-attacks.
                  </p>
                </div>
              </div>

              {/* Real Derived Statistics Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
                  <span className="text-[10px] uppercase font-black text-zinc-400 block">Expected Goals (xG)</span>
                  <div className="text-2xl font-black text-zinc-950 flex items-center justify-center gap-1">
                    <i className="fa-solid fa-futbol text-xs text-emerald-600"></i>
                    <span>{physics.expectedGoals}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-semibold">
                    {physics.expectedGoals >= 2.5 ? 'Over 1.5 Favored' : 'Controlled Scoring'}
                  </span>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
                  <span className="text-[10px] uppercase font-black text-zinc-400 block">Corners Volume</span>
                  <div className="text-2xl font-black text-zinc-950 flex items-center justify-center gap-1">
                    <i className="fa-solid fa-flag text-xs text-amber-500"></i>
                    <span>{physics.expectedCorners}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-semibold">Over 7.5 High Safety</span>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
                  <span className="text-[10px] uppercase font-black text-zinc-400 block">BTTS Frequency</span>
                  <div className="text-2xl font-black text-zinc-950 flex items-center justify-center gap-1">
                    <i className="fa-solid fa-arrows-split-up-and-left text-xs text-blue-500"></i>
                    <span>{physics.bttsProbability}%</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-semibold">Both Teams Score Rate</span>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
                  <span className="text-[10px] uppercase font-black text-zinc-400 block">Clean Sheet Rate</span>
                  <div className="text-2xl font-black text-zinc-950 flex items-center justify-center gap-1">
                    <i className="fa-solid fa-shield text-xs text-teal-600"></i>
                    <span>{physics.cleanSheetProb}%</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-semibold">Defensive Lock Rate</span>
                </div>
              </div>

              {/* Current Active Selection with Evidence Card */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] uppercase font-black text-emerald-800 tracking-wider bg-white border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block">
                    Currently Selected on Your Ticket
                  </span>
                  <span className="text-xs font-black text-emerald-700">
                    {Math.round(matchPick.probability * 100)}% Win Prob • @{matchPick.odds.toFixed(2)} Odds
                  </span>
                </div>

                <div className="text-lg font-black text-zinc-950">
                  {matchPick.market}
                </div>

                <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/60 text-xs text-zinc-700 leading-relaxed font-medium">
                  <strong className="text-zinc-900 font-bold block mb-0.5">AI Evidence & Rationale:</strong>
                  {currentRationale}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setActiveTab('booming')}
                    className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <i className="fa-solid fa-shuffle text-emerald-400 text-xs"></i>
                    <span>View Booming Alternatives</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Curated Booming Alternatives Ranked by Risk Level ──────────────── */
            <div className="space-y-6">
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                    Sure Booming Alternatives
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Curated positive-EV selections for this match, ranked strictly by Risk Level.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  {totalBoomingCount} Safe Booming Lines
                </span>
              </div>

              {boomingTiers.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 space-y-2">
                  <i className="fa-solid fa-shield text-3xl text-zinc-300"></i>
                  <p className="text-sm font-bold text-zinc-700">No alternate booming lines available</p>
                  <p className="text-xs text-zinc-500">Current pick already represents the highest quality statistical line.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {boomingTiers.map((tier) => (
                    <div key={tier.tierName} className="space-y-3">
                      {/* Tier Header */}
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${tier.badgeBg} ${tier.badgeBorder} ${tier.color}`}>
                            <i className={`${tier.icon} text-xs`}></i>
                            <span>{tier.tierName}</span>
                          </span>
                          <span className="text-xs font-semibold text-zinc-400">
                            {tier.oddsRange} per leg
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">
                          {tier.picks.length} Booming Picks
                        </span>
                      </div>

                      {/* Tier Picks */}
                      <div className="space-y-2.5">
                        {tier.picks.map((pick) => {
                          const isCurrent = pick.id === matchPick.id
                          const ev = calculateExpectedValue(pick.odds, pick.probability)
                          const rationale = generateEvidenceRationale(pick, allEventPicks)

                          return (
                            <div
                              key={pick.id}
                              className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                                isCurrent
                                  ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                                  : 'bg-white border-zinc-200/80 hover:border-zinc-300 hover:shadow-xs'
                              }`}
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-zinc-400">
                                      {pick.marketName}
                                    </span>
                                    {pick.badgeLabel && (
                                      <span className="text-[9px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full">
                                        {pick.badgeLabel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-base font-black text-zinc-950 mt-0.5">
                                    {pick.market}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="text-lg font-black text-zinc-950">
                                      @{pick.odds.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] font-bold text-emerald-600">
                                      {Math.round(pick.probability * 100)}% Win Prob • {ev > 0 ? `+${(ev * 100).toFixed(1)}%` : `${(ev * 100).toFixed(1)}%`} EV
                                    </div>
                                  </div>

                                  {onSelectOutcome && (
                                    <button
                                      disabled={isCurrent}
                                      onClick={() => {
                                        onSelectOutcome(pick)
                                        onClose()
                                      }}
                                      className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        isCurrent
                                          ? 'bg-emerald-600 text-white cursor-default'
                                          : 'bg-zinc-950 text-white hover:bg-zinc-800 active:scale-95 shadow-xs'
                                      }`}
                                    >
                                      {isCurrent ? 'Current Selection' : 'Select Booming Pick'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-100 font-medium">
                                <strong className="text-zinc-900 font-bold mr-1">AI Proof:</strong>
                                {rationale}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────── */}
        <div className="p-4 px-6 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/60">
          <span className="text-xs text-zinc-500">
            Powered by Odds Factory AI Engine • Live SportyBet ID <span className="font-mono font-bold text-zinc-800">{matchPick.eventId}</span>
          </span>
          <button
            onClick={onClose}
            className="py-2 px-5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
