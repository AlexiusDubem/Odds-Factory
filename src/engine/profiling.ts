import type {
  BasketballProfile,
  ComputedFeatures,
  FootballProfile,
  GenericProfile,
  Match,
  MatchProfile,
} from '../types'
import { computeFeatures } from './features'

const FOOTBALL_LABELS: Record<FootballProfile, string> = {
  high_goal: 'High Goal Profile',
  low_goal: 'Low Goal / Defensive',
  controlled: 'Controlled / Dominant',
  chaos: 'Chaos / Volatile',
  balanced: 'Balanced',
}

const BASKETBALL_LABELS: Record<BasketballProfile, string> = {
  high_scoring: 'High Scoring Profile',
  low_scoring: 'Low Scoring / Defensive',
  controlled_favorite: 'Controlled / Favorite',
  volatile: 'Volatile Profile',
  even_matchup: 'Even Matchup',
}

const GENERIC_LABELS: Record<GenericProfile, string> = {
  generic_favorite: 'Clear Favorite',
  generic_underdog: 'Underdog Value',
  generic_balanced: 'Balanced Matchup',
  generic_volatile: 'Volatile / Unpredictable'
}

export function profileFootball(
  features: ComputedFeatures,
  match: Match
): FootballProfile {
  const isChaos =
    match.context.includes('youth') ||
    match.context.includes('reserves') ||
    match.context.includes('friendly') ||
    (features.volatility ?? 0) > 65

  if (isChaos) return 'chaos'

  if ((features.goalEnvironment ?? 0) > 60 && (features.attackIndex ?? 0) > 55) {
    return 'high_goal'
  }

  if (
    (features.defenseIndex ?? 0) > 60 &&
    (features.goalEnvironment ?? 0) < 45
  ) {
    return 'low_goal'
  }

  if (
    (features.motivationScore ?? 0) > 55 &&
    Math.abs((features.attackIndex ?? 50) - (features.defenseIndex ?? 50)) > 15 &&
    match.isHome
  ) {
    return 'controlled'
  }

  return 'balanced'
}

export function profileBasketball(
  features: ComputedFeatures,
  match: Match
): BasketballProfile {
  const stats = match.basketball
  if (!stats) return 'even_matchup'

  const highTotalThreshold =
    stats.league === 'nba' ? 220 : stats.league === 'euro' ? 170 : 160

  const isVolatile =
    match.context.includes('playoffs') ||
    match.injuries.length > 1 ||
    (features.backToBackFatigue ?? 0) > 50

  if (isVolatile && (features.totalPointsEnvironment ?? 0) > 55) {
    return 'volatile'
  }

  if (
    (features.totalPointsEnvironment ?? 0) > 60 ||
    (stats.avgTotalPoints > highTotalThreshold &&
      (features.paceScore ?? 0) > 55 &&
      (features.defensiveEfficiency ?? 110) > 108)
  ) {
    return 'high_scoring'
  }

  if (
    (features.totalPointsEnvironment ?? 0) < 40 ||
    ((features.paceScore ?? 0) < 45 &&
      (features.defensiveEfficiency ?? 110) < 105)
  ) {
    return 'low_scoring'
  }

  const ratingDiff = Math.abs(
    (features.offensiveEfficiency ?? 110) - (features.defensiveEfficiency ?? 110)
  )
  if (ratingDiff > 8 && match.isHome && (features.motivationScore ?? 0) > 50) {
    return 'controlled_favorite'
  }

  return 'even_matchup'
}

export function profileGeneric(features: ComputedFeatures, match: Match): GenericProfile {
  if (match.context.includes('friendly') || match.context.includes('youth') || (features.volatility ?? 0) > 60) {
    return 'generic_volatile'
  }
  
  const h2hAdvantage = features.h2hAdvantage ?? 50
  if (h2hAdvantage > 65) return 'generic_favorite'
  if (h2hAdvantage < 35) return 'generic_underdog'
  
  return 'generic_balanced'
}

export function profileMatch(match: Match): {
  profile: MatchProfile
  profileLabel: string
  features: ComputedFeatures
} {
  const features = computeFeatures(match)
  let profile: MatchProfile
  let profileLabel: string

  const sportLower = match.sport.toLowerCase()
  if (sportLower === 'football' || sportLower === 'soccer') {
    profile = profileFootball(features, match)
    profileLabel = FOOTBALL_LABELS[profile as FootballProfile]
  } else if (sportLower === 'basketball') {
    profile = profileBasketball(features, match)
    profileLabel = BASKETBALL_LABELS[profile as BasketballProfile]
  } else {
    profile = profileGeneric(features, match)
    profileLabel = GENERIC_LABELS[profile as GenericProfile]
  }

  return { profile, profileLabel, features }
}