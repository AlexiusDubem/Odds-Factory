/**
 * AIOrchestrator
 * ──────────────
 * Gemini acts as an intelligent multi-step agent:
 *   1. Receives slip data + action type
 *   2. Plans which sports API endpoints to call (Bzzoiro API)
 *   3. Executes those calls in parallel or sequence
 *   4. If API data is empty/missing, activates Gemini Web Research Mode
 *   5. Returns final structured JSON analysis for the UI
 */

import { fetchBzzoiroSportsData } from './sportmonks'

const GEMINI_MODEL = 'gemini-1.5-flash'
const BZZOIRO_API_KEY = import.meta.env.VITE_BZZOIRO_API_KEY || '44f7f68bac9c7ed68631979a69ba1d855448b7fb'
const BZZOIRO_BASE = 'https://sports.bzzoiro.com'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrchestratorAction =
  | 'analyze_slip'
  | 'find_alternatives'
  | 'remove_leg'
  | 'weight_of_money'
  | 'multi_sport'

export interface LegInput {
  id: string
  matchLabel: string
  homeTeam: string
  awayTeam: string
  sport: string
  market: string
  odds: number
  probability: number
  tier?: number
  rationale?: string
  matchId?: string
}

export interface SlipInput {
  legs: LegInput[]
  combinedOdds?: number
  survivalProbability?: number
  goal?: { mode: string; targetOdds?: number; targetSurvival?: number }
}

export interface OrchestratorResult {
  success: boolean
  action: OrchestratorAction
  analysis?: string         // Markdown analysis for display
  edits?: EditDirective[]   // For optimize actions
  healthScore?: number
  judaLegs?: string[]
  dataSource: 'live_api' | 'gemini_research' | 'hybrid'
  error?: string
}

export interface EditDirective {
  legId: string
  changed: boolean
  dropped: boolean
  market: string
  message: string
}

// ─── Available API endpoint registry ─────────────────────────────────────────

const ENDPOINTS_REGISTRY = `
Football (free):
  search_matches, get_match_detail (lineups+incidents+stats+odds+prediction+h2h+AI preview),
  get_match_h2h, get_match_lineups, get_match_shotmap (per-shot xG), get_match_incidents,
  get_live_scores, search_teams, get_team_detail, get_team_fixtures, get_team_squad,
  search_players, get_player_detail, get_player_stats, list_leagues, get_standings,
  list_seasons, compare_odds, get_best_odds, list_bookmakers, get_polymarket_odds, get_predictions.

Weight of Money (subscription required — returns 402 without it):
  get_money, get_money_history, list_money_movers.

Tennis: list_tournaments, list_players, search_players, list_matches, get_match,
  get_match_h2h, get_predictions, get_rankings (ATP/WTA).

CS2: list_tournaments, list_teams, search_teams, search_players, list_matches, get_match,
  get_predictions, get_team (ELO+form+map pool), get_player (KD+damage+clutches).

Darts: list_tournaments, list_players, search_players, list_matches, get_match,
  get_predictions, get_rankings (PDC/ProTour).

Hockey: list_leagues, list_teams, search_teams, list_matches, get_match, get_predictions.

Basketball: list_leagues, list_teams, search_teams, list_events, get_event, get_predictions,
  search_players, get_player, get_box_score, get_team_stats, get_pregame, get_standings.

Horse Racing: list_meetings, list_races, get_race, list_runners, get_runner, compare_odds,
  search_horses, search_jockeys, search_trainers, get_horse, get_jockey.
`

// ─── Main orchestrator class ──────────────────────────────────────────────────

export class AIOrchestrator {
  private geminiKey: string

  constructor(geminiKey: string) {
    this.geminiKey = geminiKey
  }

  async run(slipData: SlipInput, action: OrchestratorAction): Promise<OrchestratorResult> {
    // ── Step 1: Ask Gemini which endpoints to call ─────────────────────────
    let plan: ExecutionPlan
    try {
      plan = await this._buildPlan(slipData, action)
    } catch (err) {
      console.warn('[AIOrchestrator] Plan generation failed, using research mode:', err)
      plan = { endpoints: [], parallelExecution: true, requiresResearch: true }
    }

    // ── Step 2: Execute API calls ──────────────────────────────────────────
    let apiData: Record<string, unknown> = {}
    let dataSource: OrchestratorResult['dataSource'] = 'gemini_research'

    if (plan.endpoints.length > 0) {
      apiData = await this._executeEndpoints(plan.endpoints, slipData.legs, plan.parallelExecution)
      const hasData = Object.values(apiData).some(v => v !== null && v !== undefined)
      dataSource = hasData ? 'live_api' : 'gemini_research'
    }

    // ── Step 3: Gemini analysis (with data or pure web research) ────────────
    return await this._getGeminiAnalysis(slipData, action, apiData, dataSource)
  }

  // ─── Step 1: Build execution plan ─────────────────────────────────────────

  private async _buildPlan(slipData: SlipInput, action: OrchestratorAction): Promise<ExecutionPlan> {
    const sports = [...new Set(slipData.legs.map(l => l.sport.toLowerCase()))]
    const planPrompt = `
You are the OddsFactory API Orchestrator. You must decide which API endpoints to call to analyze this betting slip.

Action: ${action}

Slip summary:
- ${slipData.legs.length} legs
- Sports: ${sports.join(', ')}
- Combined Odds: ${slipData.combinedOdds ?? 'unknown'}
- Legs: ${slipData.legs.map(l => `${l.matchLabel} | ${l.market} @${l.odds}`).join('; ')}

Available API endpoints:
${ENDPOINTS_REGISTRY}

Instructions:
1. Select the minimum set of endpoints needed to analyze this slip.
2. For "analyze_slip" call get_match_detail and get_predictions for every leg.
3. For "find_alternatives" or "remove_leg" also add get_match_h2h and get_match_shotmap.
4. For "weight_of_money" include get_money and get_money_history.
5. For multi-sport slips, use sport-specific endpoints.

Return ONLY valid JSON in this exact format:
{
  "endpoints": [
    { "name": "get_match_detail", "sport": "football", "params": { "teams": "HomeTeam vs AwayTeam" } }
  ],
  "parallelExecution": true,
  "requiresResearch": false
}
`
    const resp = await this._gemini(planPrompt, true)
    return JSON.parse(resp) as ExecutionPlan
  }

  // ─── Step 2: Execute API calls ─────────────────────────────────────────────

  private async _executeEndpoints(
    endpoints: PlannedEndpoint[],
    legs: LegInput[],
    parallel: boolean
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {}

    const call = async (ep: PlannedEndpoint, leg?: LegInput) => {
      const key = `${ep.name}_${leg?.id ?? 'all'}`
      try {
        // Build URL based on endpoint name and sport
        const data = await this._callBzzoiro(ep, leg)
        results[key] = data
      } catch {
        results[key] = null
      }
    }

    if (parallel) {
      // For per-leg endpoints, fire for every leg
      const perLegEndpoints = ['get_match_detail', 'get_predictions', 'get_match_h2h', 'get_match_shotmap', 'get_match_incidents']
      const promises: Promise<void>[] = []
      for (const ep of endpoints) {
        if (perLegEndpoints.includes(ep.name)) {
          for (const leg of legs) promises.push(call(ep, leg))
        } else {
          promises.push(call(ep))
        }
      }
      await Promise.all(promises)
    } else {
      for (const ep of endpoints) {
        await call(ep)
      }
    }

    return results
  }

  private async _callBzzoiro(ep: PlannedEndpoint, leg?: LegInput): Promise<unknown> {
    const sport = ep.sport ?? leg?.sport ?? 'football'
    const sportLower = sport.toLowerCase()

    // Map endpoint names to Bzzoiro URL paths
    const pathMap: Record<string, string> = {
      get_match_detail:    `/${sportLower}/api/v2/matches/${leg?.matchId ?? 'search'}/`,
      search_matches:      `/${sportLower}/api/v2/matches/`,
      get_predictions:     `/${sportLower}/api/v2/predictions/`,
      get_match_h2h:       `/${sportLower}/api/v2/h2h/`,
      get_match_shotmap:   `/${sportLower}/api/v2/shotmap/`,
      get_match_incidents: `/${sportLower}/api/v2/incidents/`,
      get_live_scores:     `/${sportLower}/api/v2/matches/live/`,
      get_standings:       `/${sportLower}/api/v2/standings/`,
      get_team_detail:     `/${sportLower}/api/v2/teams/`,
      search_teams:        `/${sportLower}/api/v2/teams/search/`,
      get_money:           `/${sportLower}/api/v2/money/`,
      get_money_history:   `/${sportLower}/api/v2/money/history/`,
      list_money_movers:   `/${sportLower}/api/v2/money/movers/`,
    }

    const path = pathMap[ep.name] ?? `/${sportLower}/api/v2/${ep.name}/`
    const url = `${BZZOIRO_BASE}${path}`

    let searchParam = ''
    if (leg) {
      const teamQuery = `${leg.homeTeam} ${leg.awayTeam}`.trim()
      searchParam = `?search=${encodeURIComponent(teamQuery)}`
    }

    const res = await fetch(`${url}${searchParam}`, {
      headers: {
        Authorization: `Token ${BZZOIRO_API_KEY}`,
        Accept: 'application/json',
      },
    })

    if (res.status === 402) return { error: 'subscription_required', endpoint: ep.name }
    if (!res.ok) return null
    return res.json()
  }

  // ─── Step 3: Gemini final analysis ────────────────────────────────────────

  private async _getGeminiAnalysis(
    slipData: SlipInput,
    action: OrchestratorAction,
    apiData: Record<string, unknown>,
    dataSource: OrchestratorResult['dataSource']
  ): Promise<OrchestratorResult> {
    const hasLiveData = dataSource === 'live_api'

    const analysisPrompt = this._buildAnalysisPrompt(slipData, action, apiData, hasLiveData)

    try {
      const raw = await this._gemini(analysisPrompt, action !== 'analyze_slip')

      // For analyze_slip, response is markdown
      if (action === 'analyze_slip') {
        return {
          success: true,
          action,
          analysis: raw,
          dataSource: hasLiveData ? 'live_api' : 'gemini_research',
        }
      }

      // For optimize actions, response should be JSON edits array or structured JSON
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return {
          success: true,
          action,
          analysis: raw,
          dataSource: hasLiveData ? 'live_api' : 'gemini_research',
        }
      }

      if (Array.isArray(parsed)) {
        return {
          success: true,
          action,
          edits: parsed as EditDirective[],
          dataSource: hasLiveData ? 'live_api' : 'gemini_research',
        }
      }

      const obj = parsed as Record<string, unknown>
      return {
        success: true,
        action,
        analysis: typeof obj.analysis === 'string' ? obj.analysis : undefined,
        edits: Array.isArray(obj.edits) ? obj.edits as EditDirective[] : undefined,
        healthScore: typeof obj.health_score === 'number' ? obj.health_score : undefined,
        judaLegs: Array.isArray(obj.judas_legs) ? (obj.judas_legs as unknown[]).map(String) : undefined,
        dataSource: hasLiveData ? 'live_api' : 'gemini_research',
      }
    } catch (err) {
      return {
        success: false,
        action,
        error: String(err),
        dataSource,
      }
    }
  }

  // ─── Prompt builder ────────────────────────────────────────────────────────

  private _buildAnalysisPrompt(
    slipData: SlipInput,
    action: OrchestratorAction,
    apiData: Record<string, unknown>,
    hasLiveData: boolean
  ): string {
    const legsText = slipData.legs.map((l, i) =>
      `${i + 1}. ${l.matchLabel} | Pick: ${l.market} @${l.odds} | Sport: ${l.sport}`
    ).join('\n')

    const goal = slipData.goal
      ? `Mode: ${slipData.goal.mode}${slipData.goal.targetOdds ? ` | Target Odds: ${slipData.goal.targetOdds}` : ''}${slipData.goal.targetSurvival ? ` | Target Survival: ${slipData.goal.targetSurvival}%` : ''}`
      : 'Mode: balanced'

    const dataSection = hasLiveData
      ? `\n[LIVE API DATA]\n${JSON.stringify(apiData, null, 2)}\n`
      : `\n[NOTE] Live API data was unavailable. Use your own knowledge of current football form, recent results, team news, injuries, head-to-head records, and statistical databases to conduct your own research for each match below.\n`

    const actionInstructions: Record<OrchestratorAction, string> = {
      analyze_slip: `
Analyze every leg of this slip comprehensively. Return a detailed Markdown report with:
1. 🛡️ **Overall Ticket Risk Assessment** — health score /100, survival estimate.
2. 📊 **Leg-by-Leg Analysis** — confidence, EV, volatility (derby? cup?), verdict (KEEP/CUT/SWAP).
3. 🚨 **Judas Legs** — list the most dangerous legs and why.
4. 💡 **Recommended Optimizations** — specific swaps with reasoning.
Use emojis. Be brutally honest. Format beautifully.`,

      find_alternatives: `
For each leg, find exactly 3 safer market alternatives. Return a raw JSON array where each element is an EditDirective:
[{ "legId": "...", "changed": true, "dropped": false, "market": "Safe Market Name", "message": "Reason backed by data" }]
Use ONLY these exact safe market strings: "Over 0.5", "Over 1.5", "Under 3.5", "Under 4.5", "Home or Draw", "Away or Draw", "Draw No Bet", "BTTS Yes", "BTTS No".`,

      remove_leg: `
For each leg, decide: REMOVE or KEEP. Return a raw JSON array of EditDirective objects:
[{ "legId": "...", "changed": true/false, "dropped": true/false, "market": "...", "message": "Reason" }]
Drop legs with: negative EV, high volatility (derby/cup), odds movement against the pick, or injury-affected team.`,

      weight_of_money: `
Analyze sharp money movement for each leg. If Weight of Money data was available, report discrepancies between public money % and implied odds probability. If not, use your knowledge of betting market dynamics.
Return a Markdown report with ✅ KEEP / ❌ CUT verdicts for each leg.`,

      multi_sport: `
Analyze each leg using sport-specific context:
- Football: xG, recent form, defensive record
- Tennis: surface, H2H, recent form
- Basketball: off/def rating, rest days, injuries
- CS2: map pool, team ELO, player KD
- Darts: leg averages, checkout %, ranking
Return a Markdown report with sport-specific confidence scores and verdicts.`,
    }

    return `You are OddsFactory's Elite Sports Analyst and Betting Optimizer.

[SLIP]
${legsText}

[GOAL]
${goal}

[DATA SOURCE]
${hasLiveData ? '✅ Live API data loaded' : '🔍 No live data — conduct your own research for each fixture'}
${dataSection}

[ACTION: ${action.toUpperCase()}]
${actionInstructions[action]}

Valid Safe Market Strings (use EXACTLY):
Football: "Over 0.5", "Over 1.5", "Under 2.5", "Under 3.5", "Under 4.5", "Home or Draw", "Away or Draw", "Draw No Bet", "BTTS Yes", "Both Halves Under 1.5 Yes"
Basketball: "Over Total Points", "Under Total Points", "Spread on Favorite", "Moneyline"
`
  }

  // ─── Gemini helper ────────────────────────────────────────────────────────

  private async _gemini(prompt: string, expectJson: boolean): Promise<string> {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        ...(expectJson ? { responseMimeType: 'application/json' } : {}),
      },
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${errText}`)
    }

    const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) throw new Error('Gemini returned empty response')
    return text
  }
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface PlannedEndpoint {
  name: string
  sport?: string
  params?: Record<string, unknown>
}

interface ExecutionPlan {
  endpoints: PlannedEndpoint[]
  parallelExecution: boolean
  requiresResearch: boolean
}

// Re-export fetchBzzoiroSportsData so consumers can use it directly
export { fetchBzzoiroSportsData }
