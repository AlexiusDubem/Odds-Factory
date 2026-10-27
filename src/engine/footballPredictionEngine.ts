/**
 * Market-calibrated football prediction engine.
 *
 * The bookmaker book is treated as an input, never as an edge by itself. We
 * first remove its margin, infer a coherent Dixon-Coles score distribution,
 * and then shrink every model estimate back toward the fair market. This makes
 * the engine deliberately conservative when team-level data is unavailable.
 */
import { calculatePoissonProbabilities, type PoissonMarketProbabilities } from './poissonModel'

export interface MarketLine {
  marketName: string
  selection: string
  odds: number
  probability?: number
}

export interface FootballModel {
  lambdaHome: number
  lambdaAway: number
  expectedGoals: number
  probabilities: PoissonMarketProbabilities
  marketCoverage: number
  fitError: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function normalizedImplied(lines: MarketLine[]): number[] {
  const raw = lines.map(line => line.odds > 1 ? 1 / line.odds : 0)
  const total = raw.reduce((sum, value) => sum + value, 0)
  return total > 0 ? raw.map(value => value / total) : raw
}

function marketGroup(line: MarketLine): string | null {
  const text = `${line.marketName} ${line.selection}`.toLowerCase()
  if (line.marketName.toLowerCase().includes('1x2')) return '1x2'
  if (text.includes('over') || text.includes('under')) {
    const total = text.match(/(?:total=|over\s*|under\s*)(\d+(?:\.\d+)?)/)?.[1]
    return total ? `goals:${total}` : null
  }
  if (text.includes('both teams') || text.includes('btts') || /\bgg\b|\bng\b/.test(text)) return 'btts'
  return null
}

function lineProbability(line: MarketLine, p: PoissonMarketProbabilities): number | null {
  const text = `${line.marketName} ${line.selection}`.toLowerCase()
  const selection = line.selection.toLowerCase()
  // The market title often reads "Over/Under 2.5" for both outcomes, so the
  // outcome selection—not the shared title—must decide which side is priced.
  const isUnder = /\bunder\b/.test(selection) || (!/\bover\b/.test(selection) && /\bunder\b/.test(text))
  const goalLine = text.match(/(?:total=|over\s*|under\s*)(\d+(?:\.\d+)?)/)?.[1]

  if (goalLine) {
    const lineNumber = Number(goalLine)
    const probabilityForOver: Record<number, number> = { 0.5: p.over0_5, 1.5: p.over1_5, 2.5: p.over2_5, 3.5: p.over3_5 }
    const over = probabilityForOver[lineNumber]
    return over === undefined ? null : isUnder ? 1 - over : over
  }
  if (text.includes('both teams') || text.includes('btts') || /\bgg\b|\bng\b/.test(text)) {
    return /\bno\b|\bng\b/.test(selection) ? p.bttsNo : p.bttsYes
  }
  if (line.marketName.toLowerCase().includes('1x2')) {
    if (/draw|^x$/.test(selection)) return p.draw
    if (/away|\b2\b/.test(selection)) return p.awayWin
    return p.homeWin
  }
  if (text.includes('double chance')) {
    if (selection.includes('1x')) return p.homeOrDraw
    if (selection.includes('x2')) return p.awayOrDraw
    if (selection.includes('12')) return p.homeOrAway
  }
  if (text.includes('draw no bet') || text.includes('dnb')) {
    return /away|\b2\b/.test(selection) ? p.dnbAway : p.dnbHome
  }
  return null
}

/** Fits goal rates against every complete, de-margined market group available. */
export function buildFootballModel(lines: MarketLine[]): FootballModel {
  const groups = new Map<string, MarketLine[]>()
  for (const line of lines.filter(line => line.odds > 1)) {
    const key = marketGroup(line)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), line])
  }
  const usableGroups = [...groups.values()].filter(group => group.length >= 2)
  let best = { home: 1.4, away: 1.1, error: Number.POSITIVE_INFINITY }

  // Coarse grid search is intentionally bounded: it runs in the browser for
  // every fixture, so responsiveness matters more than false precision.
  for (let home = 0.5; home <= 3.2; home += 0.1) {
    for (let away = 0.35; away <= 2.75; away += 0.1) {
      const probabilities = calculatePoissonProbabilities(home, away)
      let error = 0
      let observations = 0
      for (const group of usableGroups) {
        const fair = normalizedImplied(group)
        group.forEach((line, index) => {
          const predicted = lineProbability(line, probabilities)
          if (predicted !== null) {
            error += Math.pow(predicted - fair[index], 2)
            observations++
          }
        })
      }
      if (observations && error < best.error) best = { home, away, error: error / observations }
    }
  }
  const probabilities = calculatePoissonProbabilities(best.home, best.away)
  return {
    lambdaHome: probabilities.lambdaHome,
    lambdaAway: probabilities.muAway,
    expectedGoals: probabilities.expectedTotalGoals,
    probabilities,
    marketCoverage: usableGroups.length,
    fitError: Number.isFinite(best.error) ? Number(best.error.toFixed(5)) : 1,
  }
}

export interface CalibratedLineEvaluation {
  modelProbability: number
  fairMarketProbability: number
  edge: number
  expectedValue: number
  uncertainty: number
  hasIndependentSignal: boolean
}

export function evaluateCalibratedLine(line: MarketLine, allLines: MarketLine[], model: FootballModel): CalibratedLineEvaluation | null {
  const poissonProbability = lineProbability(line, model.probabilities)
  if (poissonProbability === null || line.odds <= 1) return null
  const key = marketGroup(line)
  const siblings = key ? allLines.filter(item => marketGroup(item) === key && item.odds > 1) : []
  const siblingIndex = siblings.findIndex(item => item === line || (
    item.marketName === line.marketName && item.selection === line.selection && item.odds === line.odds
  ))
  const fair = siblings.length > 1 && siblingIndex >= 0
    ? normalizedImplied(siblings)[siblingIndex]
    : 1 / line.odds
  const supplied = line.probability && line.probability > 0
    ? clamp(line.probability > 1 ? line.probability / 100 : line.probability, 0.02, 0.98)
    : undefined
  // Supplied empirical rate is an auxiliary signal; without it, do not pretend
  // an edge exists merely because we re-fitted the bookmaker's own odds.
  const hasIndependentSignal = supplied !== undefined
  const base = supplied === undefined ? poissonProbability : poissonProbability * 0.55 + supplied * 0.45
  const modelProbability = clamp(base * 0.70 + fair * 0.30, 0.02, 0.98)
  const uncertainty = clamp(0.07 + Math.sqrt(model.fitError) * 1.4 + (model.marketCoverage < 2 ? 0.06 : 0) + (!hasIndependentSignal ? 0.05 : 0), 0.05, 0.30)
  const conservativeProbability = clamp(modelProbability - uncertainty, 0.02, 0.98)
  return {
    modelProbability: Number(conservativeProbability.toFixed(4)),
    fairMarketProbability: Number(fair.toFixed(4)),
    edge: Number((conservativeProbability - fair).toFixed(4)),
    expectedValue: Number((conservativeProbability * line.odds - 1).toFixed(4)),
    uncertainty: Number(uncertainty.toFixed(3)),
    hasIndependentSignal,
  }
}
