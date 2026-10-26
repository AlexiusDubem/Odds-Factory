import type { SlipHealth } from '../engine/smartDropping'

interface Props {
  health: SlipHealth;
}

export function HealthScoreCard({ health }: Props) {
  const isHealthy = health.overallScore >= 70
  const isModerate = health.overallScore >= 50
  const deg = Math.round((health.overallScore / 100) * 360)

  return (
    <div className="card p-6 border border-[#e4e9e3] bg-white rounded-2xl shadow-xs space-y-5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e4e9e3] pb-4">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <i className="fa-solid fa-heart-pulse text-emerald-600"></i>
            <span>Ticket Health Analysis</span>
          </div>
          <h3 className="text-xl font-extrabold text-[#16201c] tracking-tight mt-0.5">
            Health Rating: <span className={isHealthy ? 'text-emerald-700' : isModerate ? 'text-amber-600' : 'text-rose-600'}>{health.overallScore}/100</span>
          </h3>
          <p className="fine">Mathematical assessment of ticket survival, confidence, and value edge.</p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 shadow-xs"
            style={{
              background: `conic-gradient(#dfff46 0deg ${deg}deg, #e4e9e3 ${deg}deg 360deg)`,
            }}
          >
            <div className="w-12 h-12 rounded-full bg-white flex flex-col items-center justify-center">
              <span className="font-extrabold text-sm text-[#16201c] leading-none">{health.overallScore}</span>
              <span className="text-[8px] font-mono text-[#84918a] uppercase">score</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-[#fbfcf9] border border-[#e4e9e3]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#84918a] block">Accumulator Risk</span>
          <b className={`text-base font-extrabold mt-1 block ${health.riskScore > 75 ? 'text-rose-600' : health.riskScore > 45 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {health.riskScore > 75 ? 'Elevated' : health.riskScore > 45 ? 'Moderate' : 'Low'}
          </b>
        </div>

        <div className="p-3 rounded-xl bg-[#fbfcf9] border border-[#e4e9e3]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#84918a] block">Stability Score</span>
          <b className="text-base font-mono font-extrabold text-[#16201c] mt-1 block">
            {health.stabilityScore}%
          </b>
        </div>

        <div className="p-3 rounded-xl bg-[#fbfcf9] border border-[#e4e9e3]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#84918a] block">Confidence Tier</span>
          <b className="text-base font-mono font-extrabold text-emerald-700 mt-1 block">
            {health.confidenceScore}%
          </b>
        </div>

        <div className="p-3 rounded-xl bg-[#fbfcf9] border border-[#e4e9e3]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#84918a] block">Estimated Value Edge</span>
          <b className="text-base font-mono font-extrabold text-emerald-700 mt-1 block">
            {health.valueScore}%
          </b>
        </div>
      </div>
    </div>
  )
}
