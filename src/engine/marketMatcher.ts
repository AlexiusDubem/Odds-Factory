/**
 * SportyMarketMatcher
 * ───────────────────
 * Resolves a human-readable market name (e.g. "Over 2.5", "Home or Draw")
 * against raw SportyBet market data using:
 *   1. Exact numeric MarketID  (e.g. id=18 for Over/Under)
 *   2. Regex specifier parsing (e.g. "2.5" from "Over 2.5")
 *   3. Outcome pattern matching (regex, not .includes)
 */

// ─── Shared raw market shape ──────────────────────────────────────────────────

export interface RawOutcome {
  id: string | number
  desc?: string
  name?: string
  odds?: string | number
  odd?: string | number
  oddsDecimal?: string | number
}

export interface RawMarket {
  id?: string | number
  marketId?: string | number
  desc?: string
  name?: string
  specifier?: string
  outcomes?: RawOutcome[]
}

export interface ResolvedMarket {
  marketId: string
  outcomeId: string
  odds: number
  specifier: string
  label: string  // human-readable label for the UI
}

// ─── Schema ───────────────────────────────────────────────────────────────────

interface OutcomeConfig {
  id: string       // SportyBet numeric outcome ID as string
  pattern: RegExp
}

interface MarketConfigFixed {
  type: 'fixed'
  id: string       // SportyBet numeric market ID as string
  outcomes: Record<string, OutcomeConfig>
}

interface MarketConfigSpecifier {
  type: 'specifier'
  id: string
  specifierPattern: RegExp   // extracts the number e.g. 2.5 from "Over 2.5"
  overOutcomeId: string
  underOutcomeId: string
}

type MarketConfig = MarketConfigFixed | MarketConfigSpecifier

const MARKET_SCHEMA: Record<string, MarketConfig> = {
  // ── 1X2 ──────────────────────────────────────────────────────────────────
  '1X2': {
    type: 'fixed',
    id: '1',
    outcomes: {
      home:  { id: '1', pattern: /^(home|1|h)$/i },
      draw:  { id: '2', pattern: /^(draw|x|d)$/i },
      away:  { id: '3', pattern: /^(away|2|a)$/i },
    },
  },

  // ── Over / Under Goals ───────────────────────────────────────────────────
  'Over 0.5':  { type: 'specifier', id: '18', specifierPattern: /over[\s(]*0\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Under 0.5': { type: 'specifier', id: '18', specifierPattern: /under[\s(]*0\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Over 1.5':  { type: 'specifier', id: '18', specifierPattern: /over[\s(]*1\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Under 1.5': { type: 'specifier', id: '18', specifierPattern: /under[\s(]*1\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Over 2.5':  { type: 'specifier', id: '18', specifierPattern: /over[\s(]*2\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Under 2.5': { type: 'specifier', id: '18', specifierPattern: /under[\s(]*2\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Over 3.5':  { type: 'specifier', id: '18', specifierPattern: /over[\s(]*3\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Under 3.5': { type: 'specifier', id: '18', specifierPattern: /under[\s(]*3\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Over 4.5':  { type: 'specifier', id: '18', specifierPattern: /over[\s(]*4\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Under 4.5': { type: 'specifier', id: '18', specifierPattern: /under[\s(]*4\.5/i, overOutcomeId: '12', underOutcomeId: '13' },

  // ── Double Chance ─────────────────────────────────────────────────────────
  'Double Chance': {
    type: 'fixed',
    id: '29',
    outcomes: {
      home_draw: { id: '1', pattern: /1x|home\s*or\s*draw/i },
      home_away: { id: '2', pattern: /12|home\s*or\s*away/i },
      draw_away: { id: '3', pattern: /x2|draw\s*or\s*away/i },
    },
  },
  'Home or Draw':  { type: 'fixed', id: '29', outcomes: { home_draw: { id: '1', pattern: /1x|home/i } } },
  'Away or Draw':  { type: 'fixed', id: '29', outcomes: { draw_away: { id: '3', pattern: /x2|away/i } } },

  // ── Draw No Bet ───────────────────────────────────────────────────────────
  'Draw No Bet': {
    type: 'fixed',
    id: '258',
    outcomes: {
      home: { id: '1', pattern: /^(home|1|h)$/i },
      away: { id: '2', pattern: /^(away|2|a)$/i },
    },
  },

  // ── Both Teams to Score ───────────────────────────────────────────────────
  'BTTS Yes': { type: 'fixed', id: '36', outcomes: { yes: { id: '1', pattern: /yes|gg/i } } },
  'BTTS No':  { type: 'fixed', id: '36', outcomes: { no:  { id: '2', pattern: /no|ng/i } } },

  // ── Asian Handicap ────────────────────────────────────────────────────────
  'Asian Handicap +0.5': { type: 'specifier', id: '12', specifierPattern: /\+0\.5/i, overOutcomeId: '1', underOutcomeId: '2' },
  'Asian Handicap -0.5': { type: 'specifier', id: '12', specifierPattern: /-0\.5/i, overOutcomeId: '1', underOutcomeId: '2' },

  // ── Half-Time 1X2 ─────────────────────────────────────────────────────────
  'Half-Time 1X2': {
    type: 'fixed',
    id: '2',
    outcomes: {
      home:  { id: '1', pattern: /home|1/i },
      draw:  { id: '2', pattern: /draw|x/i },
      away:  { id: '3', pattern: /away|2/i },
    },
  },

  // ── HT Over/Under ─────────────────────────────────────────────────────────
  'HT Over 0.5':  { type: 'specifier', id: '19', specifierPattern: /over[\s(]*0\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'HT Under 0.5': { type: 'specifier', id: '19', specifierPattern: /under[\s(]*0\.5/i, overOutcomeId: '12', underOutcomeId: '13' },

  // ── Corners ───────────────────────────────────────────────────────────────
  'Corners Over 8.5':  { type: 'specifier', id: '42', specifierPattern: /over[\s(]*8\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Corners Under 8.5': { type: 'specifier', id: '42', specifierPattern: /under[\s(]*8\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Corners Over 9.5':  { type: 'specifier', id: '42', specifierPattern: /over[\s(]*9\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Corners Under 9.5': { type: 'specifier', id: '42', specifierPattern: /under[\s(]*9\.5/i, overOutcomeId: '12', underOutcomeId: '13' },

  // ── Cards ─────────────────────────────────────────────────────────────────
  'Cards Over 3.5':  { type: 'specifier', id: '45', specifierPattern: /over[\s(]*3\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
  'Cards Under 3.5': { type: 'specifier', id: '45', specifierPattern: /under[\s(]*3\.5/i, overOutcomeId: '12', underOutcomeId: '13' },
}

// ─── Both Halves Under 1.5 ───────────────────────────────────────────────────
// SportyBet markets this under a specialised ID; we try to find it by label match.
const LABEL_MATCH_MARKETS: Record<string, RegExp> = {
  'Both Halves Under 1.5 Yes': /both halves.*under.*1\.5.*yes|both h.*u.*1\.5/i,
}

// ─── Core class ───────────────────────────────────────────────────────────────

export class SportyMarketMatcher {

  /**
   * Primary entry point. Given a desired market name (e.g. "Over 2.5"),
   * a direction hint (for 1X2: "home"|"draw"|"away"), and an array of raw
   * SportyBet market objects, returns the exact market/outcome IDs + odds.
   */
  resolve(
    marketName: string,
    selectionHint: string,
    rawMarkets: RawMarket[]
  ): ResolvedMarket {
    // 1. Try schema-based resolution
    const config = MARKET_SCHEMA[marketName]
    if (config) {
      const result = this._resolveBySchema(config, marketName, selectionHint, rawMarkets)
      if (result) return result
    }

    // 2. Try dynamic Over/Under extraction (e.g. "Over 1.75" not in schema)
    const ouResult = this._resolveDynamicOverUnder(marketName, rawMarkets)
    if (ouResult) return ouResult

    // 3. Try label match (e.g. "Both Halves Under 1.5 Yes")
    const labelResult = this._resolveLabelMatch(marketName, rawMarkets)
    if (labelResult) return labelResult

    // 4. Strict regex word-boundary search — better than .includes()
    const regexResult = this._resolveByWordBoundary(marketName, rawMarkets)
    if (regexResult) return regexResult

    throw new Error(`Cannot resolve market "${marketName}" / selection "${selectionHint}" from SportyBet data.`)
  }

  // ─── Schema resolver ───────────────────────────────────────────────────────

  private _resolveBySchema(
    config: MarketConfig,
    marketName: string,
    selectionHint: string,
    rawMarkets: RawMarket[]
  ): ResolvedMarket | null {
    const candidates = rawMarkets.filter(m => String(m.id ?? m.marketId) === config.id)
    if (candidates.length === 0) return null

    if (config.type === 'fixed') {
      // For each outcome group in schema, test selection hint
      for (const [, outcomeConfig] of Object.entries(config.outcomes)) {
        if (outcomeConfig.pattern.test(selectionHint) || outcomeConfig.pattern.test(marketName)) {
          for (const raw of candidates) {
            const o = (raw.outcomes ?? []).find(o => String(o.id) === outcomeConfig.id)
            if (o) return this._build(raw, o, marketName)
          }
        }
      }
      // Fallback: return first valid outcome in the market group
      const raw = candidates[0]
      const o = (raw.outcomes ?? [])[0]
      if (o) return this._build(raw, o, marketName)
    }

    if (config.type === 'specifier') {
      const isOver = /^over|^o\s/i.test(marketName) || /^over|^o\s/i.test(selectionHint)
      const targetOutcomeId = isOver ? config.overOutcomeId : config.underOutcomeId
      // Match by specifier number
      const specifierNum = this._extractNumber(marketName)
      for (const raw of candidates) {
        const specMatches = specifierNum === null || this._extractNumber(raw.specifier ?? '') === specifierNum
        if (!specMatches) continue
        const o = (raw.outcomes ?? []).find(o => String(o.id) === targetOutcomeId)
        if (o) return this._build(raw, o, marketName)
      }
    }

    return null
  }

  // ─── Dynamic Over/Under (e.g. "Over 1.75") ─────────────────────────────────

  private _resolveDynamicOverUnder(marketName: string, rawMarkets: RawMarket[]): ResolvedMarket | null {
    const ouMatch = marketName.match(/^(over|under)\s+([\d.]+)$/i)
    if (!ouMatch) return null

    const isOver = /^over/i.test(ouMatch[1])
    const targetNum = parseFloat(ouMatch[2])

    // Over/Under markets are normally id=18 but search all
    for (const raw of rawMarkets) {
      const rawNum = this._extractNumber(raw.specifier ?? raw.desc ?? '')
      if (rawNum !== targetNum) continue
      const outcomes = raw.outcomes ?? []
      const o = isOver
        ? outcomes.find(o => /over|o$/i.test(o.desc ?? o.name ?? ''))
        : outcomes.find(o => /under|u$/i.test(o.desc ?? o.name ?? ''))
      if (o) return this._build(raw, o, marketName)
    }
    return null
  }

  // ─── Label match ───────────────────────────────────────────────────────────

  private _resolveLabelMatch(marketName: string, rawMarkets: RawMarket[]): ResolvedMarket | null {
    const pattern = LABEL_MATCH_MARKETS[marketName]
    if (!pattern) return null

    for (const raw of rawMarkets) {
      const label = `${raw.desc ?? ''} ${raw.name ?? ''}`.toLowerCase()
      if (pattern.test(label)) {
        const o = (raw.outcomes ?? []).find(o => /yes|gg/i.test(o.desc ?? o.name ?? ''))
          ?? (raw.outcomes ?? [])[0]
        if (o) return this._build(raw, o, marketName)
      }
    }
    return null
  }

  // ─── Word-boundary regex fallback ──────────────────────────────────────────

  private _resolveByWordBoundary(marketName: string, rawMarkets: RawMarket[]): ResolvedMarket | null {
    const escaped = marketName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i')

    for (const raw of rawMarkets) {
      for (const o of raw.outcomes ?? []) {
        const full = `${raw.desc ?? raw.name ?? ''} ${o.desc ?? o.name ?? ''}`
        if (pattern.test(full)) return this._build(raw, o, marketName)
      }
    }
    return null
  }

  // ─── Build result ──────────────────────────────────────────────────────────

  private _build(raw: RawMarket, o: RawOutcome, _label?: string): ResolvedMarket {
    return {
      marketId: String(raw.id ?? raw.marketId ?? ''),
      outcomeId: String(o.id ?? ''),
      odds: Number(o.odds ?? o.odd ?? o.oddsDecimal ?? 1.5),
      specifier: raw.specifier ?? '',
      label: raw.specifier ? `${raw.desc ?? raw.name} (${raw.specifier}) — ${o.desc ?? o.name}` : `${raw.desc ?? raw.name} — ${o.desc ?? o.name}`,
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private _extractNumber(str: string): number | null {
    const m = str.match(/(\d+\.?\d*)/)
    return m ? parseFloat(m[1]) : null
  }
}

// Singleton for shared use
export const sportyMatcher = new SportyMarketMatcher()
