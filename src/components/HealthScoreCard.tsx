import type { SlipHealth } from '../engine/smartDropping'

interface Props {
  health: SlipHealth;
}

export function HealthScoreCard({ health }: Props) {
  const getScoreColor = (score: number, inverse = false) => {
    if (inverse) {
      if (score > 80) return 'text-red-500 bg-red-500/10 border-red-500/20';
      if (score > 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
    if (score > 70) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score > 40) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
      
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Slip Health Score™</h2>
          <p className="text-sm text-slate-400">AI analysis of your ticket's viability.</p>
        </div>
        <div className={`text-3xl font-black rounded-xl px-4 py-2 border ${getScoreColor(health.overallScore)}`}>
          {health.overallScore}<span className="text-sm font-bold opacity-60">/100</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
            <i className="fa-solid fa-triangle-exclamation"></i> Risk
          </span>
          <span className={`text-lg font-bold ${getScoreColor(health.riskScore, true).split(' ')[0]}`}>
            {health.riskScore > 80 ? 'High ⚠️' : health.riskScore > 50 ? 'Medium' : 'Low'}
          </span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
            <i className="fa-solid fa-scale-balanced"></i> Stability
          </span>
          <span className={`text-lg font-bold ${getScoreColor(health.stabilityScore).split(' ')[0]}`}>
            {health.stabilityScore}%
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
            <i className="fa-solid fa-bullseye"></i> Confidence
          </span>
          <span className={`text-lg font-bold ${getScoreColor(health.confidenceScore).split(' ')[0]}`}>
            {health.confidenceScore}%
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
            <i className="fa-solid fa-sack-dollar"></i> Value (EV)
          </span>
          <span className={`text-lg font-bold ${getScoreColor(health.valueScore).split(' ')[0]}`}>
            {health.valueScore}%
          </span>
        </div>
      </div>
    </div>
  )
}
