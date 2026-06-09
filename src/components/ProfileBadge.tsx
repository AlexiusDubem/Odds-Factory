import type { MatchProfile, Sport } from '../types'

const PROFILE_COLORS: Record<string, string> = {
  high_goal: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  low_goal: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  controlled: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  chaos: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  balanced: 'bg-slate-500/20 text-slate-700 border-slate-500/30',
  high_scoring: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  low_scoring: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  controlled_favorite: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  volatile: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  even_matchup: 'bg-slate-500/20 text-slate-700 border-slate-500/30',
  generic_favorite: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  generic_underdog: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  generic_balanced: 'bg-slate-500/20 text-slate-700 border-slate-500/30',
  generic_volatile: 'bg-red-500/20 text-red-600 border-red-500/30',
}

interface Props {
  profile: MatchProfile
  label: string
  sport: Sport
}

function getSportIcon(sport: string) {
  const lower = sport.toLowerCase()
  if (lower.includes('football') || lower.includes('soccer')) return 'fa-regular fa-futbol'
  if (lower.includes('basketball')) return 'fa-solid fa-basketball'
  if (lower.includes('tennis') && !lower.includes('table')) return 'fa-solid fa-table-tennis-paddle-ball' // using this as a stand-in, FA free doesn't have a perfect free tennis ball always
  if (lower.includes('table tennis')) return 'fa-solid fa-table-tennis-paddle-ball'
  if (lower.includes('ice hockey') || lower.includes('hockey')) return 'fa-solid fa-hockey-puck'
  if (lower.includes('volleyball')) return 'fa-solid fa-volleyball'
  if (lower.includes('baseball')) return 'fa-solid fa-baseball-bat-ball'
  if (lower.includes('mma') || lower.includes('boxing')) return 'fa-solid fa-hand-fist'
  return 'fa-solid fa-trophy'
}

export function ProfileBadge({ profile, label, sport }: Props) {
  const color = PROFILE_COLORS[profile] ?? PROFILE_COLORS.generic_balanced
  const iconClass = getSportIcon(sport)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}
    >
      <i className={`${iconClass} text-[10px]`}></i>
      {label}
    </span>
  )
}