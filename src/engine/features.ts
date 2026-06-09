import type { ComputedFeatures, Match } from '../types'

export function computeFootballFeatures(match: Match): ComputedFeatures {
  const stats = match.football!
  const attackIndex = Math.min(
    100,
    (stats.goalsFor * 12 + stats.xG * 15 + stats.homeGoalsFor * 0.3) / 2
  )
  const defenseIndex = Math.min(
    100,
    100 - (stats.goalsAgainst * 10 + stats.xGA * 12) / 2 + stats.cleanSheetRate * 20
  )
  const goalEnvironment = Math.min(
    100,
    (stats.goalsFor + stats.goalsAgainst) * 8 +
      stats.bttsRate * 30 +
      stats.tempo * 0.5
  )
  const volatility = Math.min(
    100,
    (100 - defenseIndex) * 0.4 +
      (match.context.includes('youth') || match.context.includes('reserves') ? 30 : 0) +
      (match.context.includes('friendly') ? 25 : 0) +
      (100 - Math.abs(attackIndex - defenseIndex)) * 0.2
  )
  const fatigueIndex = Math.min(
    100,
    match.fatigue * 20 +
      (match.context.includes('fixture_congestion') ? 25 : 0) +
      (match.context.includes('back_to_back') ? 15 : 0)
  )
  const motivationScore = Math.min(100, match.motivation * 20 + (match.isHome ? 10 : 0))

  // NEW ANALYTICAL LOGIC
  const h2hAdvantage = match.h2hWinRate ?? 50
  const formMomentum = match.formScore ?? 50
  
  // Extract odds for under25 and BTTS to gauge market sentiment
  const under25Odds = match.availableMarkets.find(m => m.market.includes('Under 2.5'))?.odds ?? 2.0
  const bttsGGOdds = match.availableMarkets.find(m => m.market.includes('BTTS Yes') || m.market.includes('GG'))?.odds ?? 2.0
  
  // Under 2.5 Logic: If under 2.5 odds are very low (e.g. < 1.6), signals a tight defensive game (high chance of draw/low score)
  let under25Signal = 50
  if (under25Odds < 1.6) under25Signal = 85
  else if (under25Odds > 2.1) under25Signal = 20

  // BTTS Logic: Focus on games with strong attacking/defensive records (goal spread)
  let bttsSignal = 50
  if (bttsGGOdds < 1.7 && attackIndex > 60 && defenseIndex < 40) bttsSignal = 80
  else if (bttsGGOdds > 2.0 && defenseIndex > 70) bttsSignal = 30

  let dynamicMarketProb = undefined;
  const noveltyMarket = match.availableMarkets.find(m => m.market.toLowerCase().includes('special') || m.market.toLowerCase().includes('novelty'));
  if (noveltyMarket) {
    const implied = 1 / noveltyMarket.odds;
    dynamicMarketProb = (implied - (implied * 0.064)) * 100;
  }

  return {
    attackIndex,
    defenseIndex,
    goalEnvironment,
    volatility,
    fatigueIndex,
    motivationScore,
    h2hAdvantage,
    formMomentum,
    under25Signal,
    bttsSignal,
    dynamicMarketProb
  }
}

export function computeBasketballFeatures(match: Match): ComputedFeatures {
  const stats = match.basketball!
  const paceScore = Math.min(100, stats.pace * 2.2)
  const offensiveEfficiency = stats.offensiveRating
  const defensiveEfficiency = stats.defensiveRating
  const totalPointsEnvironment = Math.min(
    100,
    (stats.avgTotalPoints / 2.5) * 0.8 + stats.overUnderHitRate * 40
  )
  const starPlayerImpact = stats.starPlayerImpact
  const backToBackFatigue = Math.min(
    100,
    stats.backToBackGames * 30 + (match.context.includes('back_to_back') ? 25 : 0)
  )
  const fatigueIndex = backToBackFatigue
  const motivationScore = Math.min(
    100,
    match.motivation * 20 +
      (match.context.includes('playoffs') ? 15 : 0) +
      (match.isHome ? 8 : 0)
  )

  // NEW ANALYTICAL LOGIC
  const h2hAdvantage = match.h2hWinRate ?? 50
  const formMomentum = match.formScore ?? 50

  return {
    paceScore,
    offensiveEfficiency,
    defensiveEfficiency,
    totalPointsEnvironment,
    starPlayerImpact,
    backToBackFatigue,
    fatigueIndex,
    motivationScore,
    h2hAdvantage,
    formMomentum
  }
}

export function computeFeatures(match: Match): ComputedFeatures {
  return match.sport === 'football'
    ? computeFootballFeatures(match)
    : computeBasketballFeatures(match)
}