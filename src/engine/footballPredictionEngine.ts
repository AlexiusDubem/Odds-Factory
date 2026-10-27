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

/** SportyBet labels often look like "Over/Under — Over". Use the outcome side, not the market title. */
function outcomeSide(line: MarketLine): string {
  const selection = (line.selection || '').trim()
  if (selection.includes('—')) return selection.split('—').pop()!.trim()
  if (selection.includes(' - ')) return selection.split(' - ').pop()!.trim()
  return selection
}

function isUnderSelection(line: MarketLine): boolean {
  const outcome = outcomeSide(line).toLowerCase()
  const title = (line.marketName || '').toLowerCase()
  if (/\bunder\b/.test(outcome) && !/\bover\b/.test(outcome)) return true
  if (/\bover\b/.test(outcome) && !/\bunder\b/.test(outcome)) return false
  const tokens = outcome.split(/[\s/]+/).filter(Boolean)
  const last = tokens[tokens.length - 1]
  if (last === 'under') return true
  if (last === 'over') return false
  return /\bunder\b/.test(title) && !/\bover\b/.test(title)
}

function marketGroup(line: MarketLine): string | null {
  const text = `${line.marketName} ${line.selection}`.toLowerCase()
  const name = (line.marketName || '').toLowerCase()
  if (name.includes('1x2') || name.includes('match result') || name.includes('full time')) return '1x2'
  if (text.includes('over') || text.includes('under') || text.includes('total=')) {
    const total = text.match(/(?:total=|over\s*|under\s*)(\d+(?:\.\d+)?)/)?.[1]
    return total ? `goals:${total}` : null
  }
  if (text.includes('both teams') || text.includes('btts') || /\bgg\b|\bng\b/.test(text)) return 'btts'
  return null
}

function lineProbability(line: MarketLine, p: PoissonMarketProbabilities): number | null {
  const text = `${line.marketName} ${line.selection}`.toLowerCase()
  const name = (line.marketName || '').toLowerCase()
  const outcome = outcomeSide(line).toLowerCase()
  const isUnder = isUnderSelection(line)
  const goalLine = text.match(/(?:total=|over\s*|under\s*)(\d+(?:\.\d+)?)/)?.[1]

  if (goalLine) {
    const lineNumber = Number(goalLine)
    const probabilityForOver: Record<number, number> = { 0.5: p.over0_5, 1.5: p.over1_5, 2.5: p.over2_5, 3.5: p.over3_5 }
    const over = probabilityForOver[lineNumber]
    return over === undefined ? null : isUnder ? 1 - over : over
  }
  if (text.includes('both teams') || text.includes('btts') || /\bgg\b|\bng\b/.test(text)) {
    return /\bno\b|\bng\b/.test(outcome) ? p.bttsNo : p.bttsYes
  }
  if (name.includes('1x2') || name.includes('match result') || name.includes('full time') || name.includes('winner')) {
    if (/draw|^x$/.test(outcome)) return p.draw
    if (/away|\b2\b/.test(outcome)) return p.awayWin
    return p.homeWin
  }
  if (text.includes('double chance')) {
    if (/\b1x\b|home or draw|1 or x|or draw/.test(outcome) && !/away or draw|x2|x or 2/.test(outcome)) return p.homeOrDraw
    if (/\bx2\b|away or draw|x or 2|draw or away/.test(outcome)) return p.awayOrDraw
    if (/\b12\b|home or away|1 or 2/.test(outcome)) return p.homeOrAway
    if (outcome.includes('1x')) return p.homeOrDraw
    if (outcome.includes('x2')) return p.awayOrDraw
    if (outcome.includes('12')) return p.homeOrAway
  }
  if (text.includes('draw no bet') || text.includes('dnb')) {
    return /away|\b2\b/.test(outcome) ? p.dnbAway : p.dnbHome
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
  if (usableGroups.length === 0) {
    const probabilities = calculatePoissonProbabilities(1.4, 1.1)
    return {
      lambdaHome: probabilities.lambdaHome,
      lambdaAway: probabilities.muAway,
      expectedGoals: probabilities.expectedTotalGoals,
      probabilities,
      marketCoverage: 0,
      fitError: 1,
    }
  }
  let best = { home: 1.4, away: 1.1, error: Number.POSITIVE_INFINITY }

  // Coarse grid search is intentionally bounded: it runs in the browser for
  // every fixture, so responsiveness matters more than false precision.
  for (let home = 0.5; home <= 3.2; home += 0.15) {
    for (let away = 0.35; away <= 2.75; away += 0.15) {
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
  if (line.odds <= 1) return null

  const supplied = line.probability && line.probability > 0
    ? clamp(line.probability > 1 ? line.probability / 100 : line.probability, 0.02, 0.98)
    : undefined
  const implied = clamp(1 / line.odds, 0.02, 0.98)
  const poissonProbability = lineProbability(line, model.probabilities)

  // Corners, handicaps, and other unmapped SportyBet lines still need a score.
  // Use the supplied feed probability, then implied odds, rather than dropping the pick.
  const estimated = poissonProbability ?? supplied ?? implied

  const key = marketGroup(line)
  const siblings = key ? allLines.filter(item => marketGroup(item) === key && item.odds > 1) : []
  const siblingIndex = siblings.findIndex(item => item === line || (
    item.marketName === line.marketName && item.selection === line.selection && item.odds === line.odds
  ))
  const fair = siblings.length > 1 && siblingIndex >= 0
    ? normalizedImplied(siblings)[siblingIndex]
    : implied
  const hasIndependentSignal = supplied !== undefined
  const poissonOrEstimate = poissonProbability ?? estimated
  const base = supplied === undefined ? poissonOrEstimate : poissonOrEstimate * 0.55 + supplied * 0.45
  const modelProbability = clamp(base * 0.70 + fair * 0.30, 0.02, 0.98)
  // An unfitted default model (coverage 0, fitError 1) is not 30% of extra
  // uncertainty — that haircut was rejecting every banker on thin books.
  const fitPenalty = model.marketCoverage > 0
    ? Math.sqrt(Math.min(model.fitError, 0.25)) * 1.1
    : 0.03
  const coveragePenalty = model.marketCoverage < 2 ? 0.03 : 0
  const signalPenalty = hasIndependentSignal ? 0 : 0.03
  const uncertainty = clamp(0.05 + fitPenalty + coveragePenalty + signalPenalty, 0.04, 0.18)
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
