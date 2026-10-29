export interface CompetitionItem {
  id: string
  name: string
  country?: string
  flag?: string
  tier?: 'major' | 'popular' | 'secondary' | 'international' | 'simulated'
}

export interface CompetitionCategory {
  id: string
  title: string
  shortLabel: string
  icon: string
  description: string
  countryCount: number
  competitions: {
    country: string
    flag: string
    leagues: string[]
  }[]
}

export const SPORTYBET_FOOTBALL_CATEGORIES: CompetitionCategory[] = [
  {
    id: 'major-europe',
    title: '1. Major Football Leagues and Competitions',
    shortLabel: 'Major Europe',
    icon: 'fa-solid fa-trophy',
    description: 'The premier European domestic leagues, second divisions, and national cups.',
    countryCount: 5,
    competitions: [
      {
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        leagues: [
          'Premier League',
          'Championship',
          'League One',
          'League Two',
          'National League',
          'FA Cup',
          'EFL Cup (Carabao Cup)',
        ],
      },
      {
        country: 'Spain',
        flag: '🇪🇸',
        leagues: [
          'La Liga',
          'Segunda División',
          'Primera Federación',
          'Copa del Rey',
        ],
      },
      {
        country: 'Italy',
        flag: '🇮🇹',
        leagues: [
          'Serie A',
          'Serie B',
          'Serie C',
          'Coppa Italia',
        ],
      },
      {
        country: 'Germany',
        flag: '🇩🇪',
        leagues: [
          'Bundesliga',
          '2. Bundesliga',
          '3. Liga',
          'DFB-Pokal',
        ],
      },
      {
        country: 'France',
        flag: '🇫🇷',
        leagues: [
          'Ligue 1',
          'Ligue 2',
          'National',
          'Coupe de France',
        ],
      },
    ],
  },
  {
    id: 'other-europe',
    title: '2. Other European Leagues',
    shortLabel: 'Other Europe',
    icon: 'fa-solid fa-earth-europe',
    description: 'Continental European leagues spanning top-tier and lower divisions.',
    countryCount: 21,
    competitions: [
      {
        country: 'Portugal',
        flag: '🇵🇹',
        leagues: ['Primeira Liga', 'Liga Portugal 2', 'Taça de Portugal'],
      },
      {
        country: 'Netherlands',
        flag: '🇳🇱',
        leagues: ['Eredivisie', 'Eerste Divisie'],
      },
      {
        country: 'Scotland',
        flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        leagues: ['Premiership', 'Championship', 'League One', 'League Two'],
      },
      {
        country: 'Belgium',
        flag: '🇧🇪',
        leagues: ['Pro League', 'Challenger Pro League'],
      },
      {
        country: 'Turkey',
        flag: '🇹🇷',
        leagues: ['Süper Lig', '1. Lig'],
      },
      {
        country: 'Greece',
        flag: '🇬🇷',
        leagues: ['Super League'],
      },
      {
        country: 'Austria',
        flag: '🇦🇹',
        leagues: ['Bundesliga', '2. Liga'],
      },
      {
        country: 'Switzerland',
        flag: '🇨🇭',
        leagues: ['Super League', 'Challenge League'],
      },
      {
        country: 'Denmark',
        flag: '🇩🇰',
        leagues: ['Superliga', '1st Division'],
      },
      {
        country: 'Sweden',
        flag: '🇸🇪',
        leagues: ['Allsvenskan', 'Superettan', 'Ettan'],
      },
      {
        country: 'Norway',
        flag: '🇳🇴',
        leagues: ['Eliteserien', 'OBOS-ligaen'],
      },
      {
        country: 'Poland',
        flag: '🇵🇱',
        leagues: ['Ekstraklasa', 'I Liga'],
      },
      {
        country: 'Czechia',
        flag: '🇨🇿',
        leagues: ['First League', 'National Football League'],
      },
      {
        country: 'Croatia',
        flag: '🇭🇷',
        leagues: ['HNL'],
      },
      {
        country: 'Serbia',
        flag: '🇷🇸',
        leagues: ['SuperLiga'],
      },
      {
        country: 'Romania',
        flag: '🇷🇴',
        leagues: ['Liga I'],
      },
      {
        country: 'Russia',
        flag: '🇷🇺',
        leagues: ['Premier League'],
      },
      {
        country: 'Ukraine',
        flag: '🇺🇦',
        leagues: ['Premier League'],
      },
      {
        country: 'Ireland',
        flag: '🇮🇪',
        leagues: ['Premier Division', 'First Division'],
      },
      {
        country: 'Northern Ireland',
        flag: '🇬🇧',
        leagues: ['Premiership'],
      },
      {
        country: 'Wales',
        flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
        leagues: ['Cymru Premier'],
      },
    ],
  },
  {
    id: 'international-clubs',
    title: '3. International Club Competitions',
    shortLabel: 'Club Tournaments',
    icon: 'fa-solid fa-shield-halved',
    description: 'Premier inter-club continental tournaments across UEFA, CONMEBOL, CONCACAF, and CAF.',
    countryCount: 4,
    competitions: [
      {
        country: 'Europe (UEFA)',
        flag: '🇪🇺',
        leagues: [
          'UEFA Champions League',
          'UEFA Europa League',
          'UEFA Conference League',
          'UEFA Super Cup',
        ],
      },
      {
        country: 'South America (CONMEBOL)',
        flag: '🌎',
        leagues: [
          'Copa Libertadores',
          'Copa Sudamericana',
        ],
      },
      {
        country: 'North & Central America (CONCACAF)',
        flag: '🌎',
        leagues: [
          'CONCACAF Champions Cup',
        ],
      },
      {
        country: 'Africa (CAF)',
        flag: '🌍',
        leagues: [
          'CAF Champions League',
          'CAF Confederation Cup',
        ],
      },
    ],
  },
  {
    id: 'africa',
    title: '4. Africa',
    shortLabel: 'Africa',
    icon: 'fa-solid fa-earth-africa',
    description: 'African domestic leagues featuring Nigeria NPFL, North African powerhouses, and sub-Saharan competitions.',
    countryCount: 13,
    competitions: [
      {
        country: 'Nigeria',
        flag: '🇳🇬',
        leagues: [
          'NPFL (Nigeria Premier Football League)',
          'President Federation Cup',
          'NNL (Nigeria National League)',
        ],
      },
      {
        country: 'South Africa',
        flag: '🇿🇦',
        leagues: ['Premiership (PSL)', 'National First Division', 'Nedbank Cup'],
      },
      {
        country: 'Egypt',
        flag: '🇪🇬',
        leagues: ['Premier League', 'Egypt Cup'],
      },
      {
        country: 'Morocco',
        flag: '🇲🇦',
        leagues: ['Botola Pro', 'Throne Cup'],
      },
      {
        country: 'Algeria',
        flag: '🇩🇿',
        leagues: ['Ligue 1', 'Algerian Cup'],
      },
      {
        country: 'Tunisia',
        flag: '🇹🇳',
        leagues: ['Ligue 1'],
      },
      {
        country: 'Kenya',
        flag: '🇰🇪',
        leagues: ['Premier League'],
      },
      {
        country: 'Uganda',
        flag: '🇺🇬',
        leagues: ['Premier League'],
      },
      {
        country: 'Tanzania',
        flag: '🇹🇿',
        leagues: ['Premier League'],
      },
      {
        country: 'Rwanda',
        flag: '🇷🇼',
        leagues: ['Premier League'],
      },
      {
        country: 'Angola',
        flag: '🇦🇴',
        leagues: ['Girabola'],
      },
      {
        country: 'Botswana',
        flag: '🇧🇼',
        leagues: ['Premier League'],
      },
      {
        country: 'Mozambique',
        flag: '🇲🇿',
        leagues: ['Moçambola'],
      },
    ],
  },
  {
    id: 'americas',
    title: '5. Americas',
    shortLabel: 'Americas',
    icon: 'fa-solid fa-earth-americas',
    description: 'North, Central, and South American football leagues and state tournaments.',
    countryCount: 15,
    competitions: [
      {
        country: 'Brazil',
        flag: '🇧🇷',
        leagues: ['Série A', 'Série B', 'Série C', 'Série D', 'Copa do Brasil', 'State Championships (Paulista, Carioca)'],
      },
      {
        country: 'Argentina',
        flag: '🇦🇷',
        leagues: ['Primera División', 'Primera Nacional', 'Copa Argentina'],
      },
      {
        country: 'USA',
        flag: '🇺🇸',
        leagues: ['Major League Soccer (MLS)', 'USL Championship', 'USL League One', 'US Open Cup'],
      },
      {
        country: 'Mexico',
        flag: '🇲🇽',
        leagues: ['Liga MX', 'Liga de Expansión MX', 'Copa MX'],
      },
      {
        country: 'Chile',
        flag: '🇨🇱',
        leagues: ['Primera División', 'Primera B'],
      },
      {
        country: 'Colombia',
        flag: '🇨🇴',
        leagues: ['Categoría Primera A', 'Categoría Primera B', 'Copa Colombia'],
      },
      {
        country: 'Uruguay',
        flag: '🇺🇾',
        leagues: ['Primera División'],
      },
      {
        country: 'Paraguay',
        flag: '🇵🇾',
        leagues: ['Primera División'],
      },
      {
        country: 'Ecuador',
        flag: '🇪🇨',
        leagues: ['Serie A', 'Serie B'],
      },
      {
        country: 'Peru',
        flag: '🇵🇪',
        leagues: ['Liga 1'],
      },
      {
        country: 'Bolivia',
        flag: '🇧🇴',
        leagues: ['División Profesional'],
      },
      {
        country: 'Venezuela',
        flag: '🇻🇪',
        leagues: ['Primera División'],
      },
      {
        country: 'Costa Rica',
        flag: '🇨🇷',
        leagues: ['Primera División'],
      },
      {
        country: 'Guatemala',
        flag: '🇬🇹',
        leagues: ['Liga Nacional'],
      },
      {
        country: 'El Salvador',
        flag: '🇸🇻',
        leagues: ['Primera División'],
      },
      {
        country: 'Nicaragua',
        flag: '🇳🇮',
        leagues: ['Primera División'],
      },
    ],
  },
  {
    id: 'asia-oceania',
    title: '6. Asia and Oceania',
    shortLabel: 'Asia & Oceania',
    icon: 'fa-solid fa-earth-asia',
    description: 'Asian Football Confederation and Oceania competitions, Gulf leagues, and East Asian powerhouses.',
    countryCount: 15,
    competitions: [
      {
        country: 'Japan',
        flag: '🇯🇵',
        leagues: ['J1 League', 'J2 League', 'J3 League', 'WE League', 'Emperor Cup'],
      },
      {
        country: 'South Korea',
        flag: '🇰🇷',
        leagues: ['K League 1', 'K League 2', 'FA Cup'],
      },
      {
        country: 'Saudi Arabia',
        flag: '🇸🇦',
        leagues: ['Saudi Pro League', 'Division 1', 'King Cup'],
      },
      {
        country: 'China',
        flag: '🇨🇳',
        leagues: ['Chinese Super League', 'China League One', 'FA Cup'],
      },
      {
        country: 'Australia',
        flag: '🇦🇺',
        leagues: ['A-League Men', 'A-League Women', 'Australia Cup'],
      },
      {
        country: 'India',
        flag: '🇮🇳',
        leagues: ['Indian Super League', 'I-League', 'Super Cup'],
      },
      {
        country: 'Indonesia',
        flag: '🇮🇩',
        leagues: ['Super League (Liga 1)', 'Liga 2'],
      },
      {
        country: 'Thailand',
        flag: '🇹🇭',
        leagues: ['Thai League 1', 'Thai League 2'],
      },
      {
        country: 'Iran',
        flag: '🇮🇷',
        leagues: ['Persian Gulf Pro League', 'Hazfi Cup'],
      },
      {
        country: 'Qatar',
        flag: '🇶🇦',
        leagues: ['Stars League', 'Emir Cup'],
      },
      {
        country: 'United Arab Emirates',
        flag: '🇦🇪',
        leagues: ['UAE Pro League', 'President Cup'],
      },
      {
        country: 'Kazakhstan',
        flag: '🇰🇿',
        leagues: ['Premier League'],
      },
      {
        country: 'Uzbekistan',
        flag: '🇺🇿',
        leagues: ['Super League'],
      },
      {
        country: 'Bahrain',
        flag: '🇧🇭',
        leagues: ['Premier League'],
      },
      {
        country: 'Lebanon',
        flag: '🇱🇧',
        leagues: ['Premier League'],
      },
      {
        country: 'Cambodia',
        flag: '🇰🇭',
        leagues: ['Cambodian Premier League'],
      },
    ],
  },
  {
    id: 'international-other',
    title: '7. International and Other Football Competitions',
    shortLabel: 'International & Cups',
    icon: 'fa-solid fa-globe',
    description: 'National team tournaments, qualifiers, youth cups, and international club competitions.',
    countryCount: 5,
    competitions: [
      {
        country: 'Global FIFA & Major Tournaments',
        flag: '🌐',
        leagues: [
          'FIFA World Cup & Qualifiers',
          'International Friendlies',
          'European Championship (Euros) & Qualifiers',
          'Africa Cup of Nations (AFCON) & Qualifiers',
          'Asian Cup & Qualifiers',
          'CONCACAF Gold Cup',
          'Copa América',
          'Olympic Football',
        ],
      },
      {
        country: 'Youth Tournaments',
        flag: '👶',
        leagues: [
          'U21 European Championship & Qualifiers',
          'U20 World Cup',
          'U19 European Championship',
          'U17 World Cup & Regional Cups',
        ],
      },
      {
        country: 'Women\'s Football',
        flag: '👩',
        leagues: [
          'Women\'s World Cup & Qualifiers',
          'UEFA Women\'s Champions League',
          'England Women\'s Super League (WSL)',
          'NWSL (USA Women)',
          'Spain Liga F',
        ],
      },
      {
        country: 'Amateur & Reserve Leagues',
        flag: '⚽',
        leagues: [
          'English Premier League 2 (Reserves)',
          'Spanish Tercera Federación',
          'German Regionalliga',
          'Italian Primavera (U19)',
        ],
      },
    ],
  },
]

// ── Match & Selection models for Acca Builder ────────────────────────────────

export interface FixtureMarketOutcome {
  id: string
  label: string
  odds: number
  probability: number
  marketId: string
  marketName: string
  specifier?: string
}

export interface AccaFixture {
  id: string
  eventId: string
  league: string
  country: string
  category: string
  homeTeam: string
  awayTeam: string
  kickoff: string
  markets: {
    // 1X2
    homeWin: FixtureMarketOutcome
    draw: FixtureMarketOutcome
    awayWin: FixtureMarketOutcome
    // Over / Under 2.5
    over25: FixtureMarketOutcome
    under25: FixtureMarketOutcome
    // BTTS
    bttsYes: FixtureMarketOutcome
    bttsNo: FixtureMarketOutcome
    // Double Chance
    dc1X: FixtureMarketOutcome
    dcX2: FixtureMarketOutcome
  }
}

export interface AccaSelection {
  fixtureId: string
  eventId: string
  matchLabel: string
  league: string
  country: string
  marketId: string
  marketName: string
  outcomeId: string
  outcomeLabel: string
  odds: number
  probability: number
  ev: number
  specifier?: string
}

// ── Pre-populated Live/Upcoming Fixtures across all 7 Categories ─────────────

export const SAMPLE_ACCA_FIXTURES: AccaFixture[] = [
  // 1. Major Europe - England
  {
    id: 'fix-eng-1',
    eventId: 'sr:match:5100101',
    league: 'Premier League',
    country: 'England',
    category: 'major-europe',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: 'Tomorrow, 17:30',
    markets: {
      homeWin: { id: '1', label: 'Arsenal Win', odds: 1.62, probability: 0.61, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 4.10, probability: 0.23, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Chelsea Win', odds: 5.25, probability: 0.16, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.70, probability: 0.58, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.15, probability: 0.42, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.75, probability: 0.56, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.05, probability: 0.44, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Arsenal or Draw)', odds: 1.18, probability: 0.84, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Chelsea)', odds: 2.25, probability: 0.39, marketId: '10', marketName: 'Double Chance' },
    },
  },
  {
    id: 'fix-eng-2',
    eventId: 'sr:match:5100102',
    league: 'Premier League',
    country: 'England',
    category: 'major-europe',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester City',
    kickoff: 'Sunday, 16:30',
    markets: {
      homeWin: { id: '1', label: 'Liverpool Win', odds: 2.45, probability: 0.39, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.60, probability: 0.27, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Man City Win', odds: 2.75, probability: 0.34, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.55, probability: 0.63, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.40, probability: 0.37, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.50, probability: 0.65, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.55, probability: 0.35, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Liverpool or Draw)', odds: 1.45, probability: 0.66, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Man City)', odds: 1.52, probability: 0.61, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 1. Major Europe - Spain
  {
    id: 'fix-esp-1',
    eventId: 'sr:match:5100201',
    league: 'La Liga',
    country: 'Spain',
    category: 'major-europe',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    kickoff: 'Saturday, 20:00',
    markets: {
      homeWin: { id: '1', label: 'Real Madrid Win', odds: 2.10, probability: 0.46, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.75, probability: 0.26, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Barcelona Win', odds: 3.20, probability: 0.28, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.58, probability: 0.62, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.35, probability: 0.38, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.52, probability: 0.64, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.45, probability: 0.36, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Real Madrid/Draw)', odds: 1.34, probability: 0.72, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw/Barcelona)', odds: 1.70, probability: 0.54, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 1. Major Europe - Germany
  {
    id: 'fix-ger-1',
    eventId: 'sr:match:5100301',
    league: 'Bundesliga',
    country: 'Germany',
    category: 'major-europe',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Bayer Leverkusen',
    kickoff: 'Saturday, 17:30',
    markets: {
      homeWin: { id: '1', label: 'Bayern Win', odds: 1.72, probability: 0.57, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 4.20, probability: 0.23, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Leverkusen Win', odds: 4.30, probability: 0.20, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.42, probability: 0.70, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.85, probability: 0.30, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.48, probability: 0.66, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.60, probability: 0.34, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Bayern or Draw)', odds: 1.22, probability: 0.80, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw/Leverkusen)', odds: 2.10, probability: 0.43, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 1. Major Europe - Italy
  {
    id: 'fix-ita-1',
    eventId: 'sr:match:5100401',
    league: 'Serie A',
    country: 'Italy',
    category: 'major-europe',
    homeTeam: 'Inter Milan',
    awayTeam: 'Juventus',
    kickoff: 'Sunday, 19:45',
    markets: {
      homeWin: { id: '1', label: 'Inter Win', odds: 1.95, probability: 0.50, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.35, probability: 0.29, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Juventus Win', odds: 4.10, probability: 0.21, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 2.05, probability: 0.46, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 1.78, probability: 0.54, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.88, probability: 0.51, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 1.90, probability: 0.49, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Inter or Draw)', odds: 1.25, probability: 0.79, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Juventus)', odds: 1.85, probability: 0.50, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 1. Major Europe - France
  {
    id: 'fix-fra-1',
    eventId: 'sr:match:5100501',
    league: 'Ligue 1',
    country: 'France',
    category: 'major-europe',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Marseille',
    kickoff: 'Sunday, 20:00',
    markets: {
      homeWin: { id: '1', label: 'PSG Win', odds: 1.50, probability: 0.66, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 4.50, probability: 0.21, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Marseille Win', odds: 6.00, probability: 0.13, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.52, probability: 0.64, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.50, probability: 0.36, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.68, probability: 0.58, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.15, probability: 0.42, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (PSG or Draw)', odds: 1.14, probability: 0.87, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Marseille)', odds: 2.55, probability: 0.34, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 3. International Clubs - Champions League
  {
    id: 'fix-ucl-1',
    eventId: 'sr:match:5100601',
    league: 'UEFA Champions League',
    country: 'Europe (UEFA)',
    category: 'international-clubs',
    homeTeam: 'Real Madrid',
    awayTeam: 'Manchester City',
    kickoff: 'Wednesday, 20:00',
    markets: {
      homeWin: { id: '1', label: 'Real Madrid Win', odds: 2.50, probability: 0.38, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.65, probability: 0.26, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Man City Win', odds: 2.65, probability: 0.36, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.62, probability: 0.61, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.28, probability: 0.39, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.54, probability: 0.63, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.40, probability: 0.37, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Real Madrid or Draw)', odds: 1.48, probability: 0.64, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Man City)', odds: 1.52, probability: 0.62, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 4. Africa - Nigeria NPFL
  {
    id: 'fix-nga-1',
    eventId: 'sr:match:5100701',
    league: 'NPFL (Nigeria Premier Football League)',
    country: 'Nigeria',
    category: 'africa',
    homeTeam: 'Enyimba FC',
    awayTeam: 'Remo Stars',
    kickoff: 'Sunday, 16:00',
    markets: {
      homeWin: { id: '1', label: 'Enyimba Win', odds: 1.82, probability: 0.54, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.10, probability: 0.30, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Remo Stars Win', odds: 4.80, probability: 0.16, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 2.25, probability: 0.42, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 1.65, probability: 0.58, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 2.10, probability: 0.44, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 1.72, probability: 0.56, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Enyimba or Draw)', odds: 1.18, probability: 0.84, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Remo Stars)', odds: 1.95, probability: 0.46, marketId: '10', marketName: 'Double Chance' },
    },
  },
  {
    id: 'fix-nga-2',
    eventId: 'sr:match:5100702',
    league: 'NPFL (Nigeria Premier Football League)',
    country: 'Nigeria',
    category: 'africa',
    homeTeam: 'Enugu Rangers',
    awayTeam: 'Shooting Stars',
    kickoff: 'Sunday, 16:00',
    markets: {
      homeWin: { id: '1', label: 'Rangers Win', odds: 1.70, probability: 0.57, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.25, probability: 0.28, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Shooting Stars Win', odds: 5.20, probability: 0.15, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 2.30, probability: 0.40, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 1.60, probability: 0.60, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 2.15, probability: 0.43, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 1.68, probability: 0.57, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Rangers or Draw)', odds: 1.15, probability: 0.85, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or 3SC)', odds: 2.10, probability: 0.43, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 4. Africa - South Africa Premiership
  {
    id: 'fix-rsa-1',
    eventId: 'sr:match:5100703',
    league: 'Premiership (PSL)',
    country: 'South Africa',
    category: 'africa',
    homeTeam: 'Mamelodi Sundowns',
    awayTeam: 'Orlando Pirates',
    kickoff: 'Saturday, 14:30',
    markets: {
      homeWin: { id: '1', label: 'Sundowns Win', odds: 1.78, probability: 0.55, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.30, probability: 0.28, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Pirates Win', odds: 4.60, probability: 0.17, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 2.10, probability: 0.45, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 1.72, probability: 0.55, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.95, probability: 0.48, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 1.82, probability: 0.52, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Sundowns or Draw)', odds: 1.20, probability: 0.83, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Pirates)', odds: 2.00, probability: 0.45, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 2. Other Europe - Netherlands
  {
    id: 'fix-ned-1',
    eventId: 'sr:match:5100801',
    league: 'Eredivisie',
    country: 'Netherlands',
    category: 'other-europe',
    homeTeam: 'Ajax',
    awayTeam: 'PSV Eindhoven',
    kickoff: 'Saturday, 19:00',
    markets: {
      homeWin: { id: '1', label: 'Ajax Win', odds: 2.60, probability: 0.36, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.70, probability: 0.25, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'PSV Win', odds: 2.45, probability: 0.39, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.45, probability: 0.68, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.70, probability: 0.32, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.42, probability: 0.69, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.80, probability: 0.31, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Ajax or Draw)', odds: 1.55, probability: 0.61, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or PSV)', odds: 1.50, probability: 0.64, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 2. Other Europe - Portugal
  {
    id: 'fix-por-1',
    eventId: 'sr:match:5100802',
    league: 'Primeira Liga',
    country: 'Portugal',
    category: 'other-europe',
    homeTeam: 'Sporting CP',
    awayTeam: 'Benfica',
    kickoff: 'Sunday, 20:30',
    markets: {
      homeWin: { id: '1', label: 'Sporting Win', odds: 2.15, probability: 0.44, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.40, probability: 0.28, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Benfica Win', odds: 3.25, probability: 0.28, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.80, probability: 0.53, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.00, probability: 0.47, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.65, probability: 0.58, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.20, probability: 0.42, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Sporting or Draw)', odds: 1.34, probability: 0.72, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Benfica)', odds: 1.70, probability: 0.56, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 5. Americas - Brazil Série A
  {
    id: 'fix-bra-1',
    eventId: 'sr:match:5100901',
    league: 'Série A',
    country: 'Brazil',
    category: 'americas',
    homeTeam: 'Flamengo',
    awayTeam: 'Palmeiras',
    kickoff: 'Sunday, 21:00',
    markets: {
      homeWin: { id: '1', label: 'Flamengo Win', odds: 2.05, probability: 0.47, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.25, probability: 0.29, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Palmeiras Win', odds: 3.65, probability: 0.24, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 2.05, probability: 0.46, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 1.75, probability: 0.54, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.85, probability: 0.51, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 1.95, probability: 0.49, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Flamengo or Draw)', odds: 1.28, probability: 0.76, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Palmeiras)', odds: 1.75, probability: 0.53, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 6. Asia - Saudi Pro League
  {
    id: 'fix-sau-1',
    eventId: 'sr:match:5101001',
    league: 'Saudi Pro League',
    country: 'Saudi Arabia',
    category: 'asia-oceania',
    homeTeam: 'Al-Hilal',
    awayTeam: 'Al-Nassr',
    kickoff: 'Friday, 18:00',
    markets: {
      homeWin: { id: '1', label: 'Al-Hilal Win', odds: 1.95, probability: 0.49, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.80, probability: 0.24, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Al-Nassr Win', odds: 3.40, probability: 0.27, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 1.50, probability: 0.65, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 2.55, probability: 0.35, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.48, probability: 0.66, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 2.60, probability: 0.34, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Al-Hilal or Draw)', odds: 1.30, probability: 0.73, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Al-Nassr)', odds: 1.82, probability: 0.51, marketId: '10', marketName: 'Double Chance' },
    },
  },
  // 7. UEFA Champions League Marquee
  {
    id: 'fix-ucl-marquee',
    eventId: 'sr:match:5101101',
    league: 'UEFA Champions League',
    country: 'Europe',
    category: 'major-european',
    homeTeam: 'Inter Milan',
    awayTeam: 'Atlético Madrid',
    kickoff: 'Today, 21:00',
    markets: {
      homeWin: { id: '1', label: 'Inter Milan Win', odds: 1.88, probability: 0.50, marketId: '1', marketName: '1X2' },
      draw:    { id: '2', label: 'Draw', odds: 3.45, probability: 0.27, marketId: '1', marketName: '1X2' },
      awayWin: { id: '3', label: 'Atlético Madrid Win', odds: 4.20, probability: 0.23, marketId: '1', marketName: '1X2' },
      over25:  { id: '12', label: 'Over 2.5', odds: 2.05, probability: 0.46, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      under25: { id: '13', label: 'Under 2.5', odds: 1.76, probability: 0.54, marketId: '18', marketName: 'Over/Under 2.5', specifier: 'total=2.5' },
      bttsYes: { id: '29', label: 'BTTS Yes', odds: 1.90, probability: 0.49, marketId: '29', marketName: 'Both Teams To Score' },
      bttsNo:  { id: '30', label: 'BTTS No', odds: 1.86, probability: 0.51, marketId: '29', marketName: 'Both Teams To Score' },
      dc1X:    { id: '10', label: '1X (Inter Milan or Draw)', odds: 1.22, probability: 0.77, marketId: '10', marketName: 'Double Chance' },
      dcX2:    { id: '11', label: 'X2 (Draw or Atlético)', odds: 1.92, probability: 0.50, marketId: '10', marketName: 'Double Chance' },
    },
  },
]


// ── Daily Sure Picks (Model-Audited Predictions) ─────────────────────────────

export type SurePickType =
  | 'banker'
  | 'goals_lock'
  | 'double_chance'
  | 'btts'
  | 'value_play'
  | 'corner_lock'
  | 'booking_lock'
  | 'handicap_play'
  | 'interval_lock'

export type MarketFamily =
  | 'all'
  | 'match_result'
  | 'goals'
  | 'btts'
  | 'handicap'
  | 'corners'
  | 'cards_bookings'
  | 'intervals_halves'
  | 'cleansheet'

export interface DiscoveredCompetition {
  id: string
  name: string
  categoryName: string
  eventCount: number
  tier: 'major' | 'secondary' | 'other'
}

export interface DailySurePick {
  id: string
  eventId: string
  tournamentId?: string
  matchLabel: string
  homeTeam: string
  awayTeam: string
  league: string
  country: string
  category?: string
  kickoff: string
  kickoffTag?: string
  estimateStartTime?: number | null
  hoursFromNow?: number
  leagueScope?: 'major' | 'small' | 'other'
  market: string
  marketName: string
  marketFamily?: MarketFamily
  marketId: string
  outcomeId: string
  specifier?: string
  odds: number
  probability: number
  ev: number
  impliedProbability?: number
  modelProbability?: number
  edge?: number
  uncertaintyLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  lineupStatus?: 'confirmed' | 'projected' | 'unconfirmed'
  dataAgeMinutes?: number
  varianceCategory?: 'lower_variance' | 'positive_edge'
  disclaimer?: string
  confidenceScore: number
  confidenceTier: 1 | 2 | 3
  modelType: SurePickType
  badgeLabel: string
  modelRationale: string
}

export function enrichPickWithStats(p: DailySurePick): DailySurePick {
  const implied = Number((1 / p.odds).toFixed(4))
  const modelProb = Number(p.probability.toFixed(4))
  const edge = Number((modelProb - implied).toFixed(4))
  const ev = Number((modelProb * p.odds - 1).toFixed(4))
  const uncertainty = p.probability >= 0.82 ? 'LOW' : p.probability >= 0.70 ? 'MODERATE' : 'HIGH'
  const varianceCat = p.probability >= 0.78 ? 'lower_variance' : 'positive_edge'
  const badge = p.probability >= 0.78 ? 'Lower-Variance Candidate' : 'Positive Estimated Edge'

  return {
    ...p,
    impliedProbability: p.impliedProbability ?? implied,
    modelProbability: p.modelProbability ?? modelProb,
    edge: p.edge ?? edge,
    ev: p.ev ?? ev,
    uncertaintyLevel: p.uncertaintyLevel ?? uncertainty,
    lineupStatus: p.lineupStatus ?? 'unconfirmed',
    dataAgeMinutes: p.dataAgeMinutes ?? 2,
    varianceCategory: p.varianceCategory ?? varianceCat,
    badgeLabel: badge,
    disclaimer: p.disclaimer ?? 'Estimates can be wrong. Historical performance does not guarantee future results. Stake only what you can afford to lose.',
  }
}

export const DAILY_SURE_PICKS: DailySurePick[] = [
  {
    id: 'sp-1',
    eventId: 'sr:match:5100101',
    matchLabel: 'Arsenal vs Chelsea',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    league: 'Premier League',
    country: 'England',
    category: 'major-europe',
    kickoff: 'Today, 17:30',
    market: 'Arsenal or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.18,
    probability: 0.88,
    ev: 0.038,
    confidenceScore: 95,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Arsenal are undefeated in 8 consecutive home derbies with a dominant +1.4 xG differential. Chelsea away conversion is below 1.1.',
  },
  {
    id: 'sp-2',
    eventId: 'sr:match:5100201',
    matchLabel: 'Real Madrid vs Barcelona',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    league: 'La Liga',
    country: 'Spain',
    category: 'major-europe',
    kickoff: 'Today, 20:00',
    market: 'Over 1.5 Goals',
    marketName: 'Over/Under 1.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=1.5',
    odds: 1.18,
    probability: 0.89,
    ev: 0.05,
    confidenceScore: 94,
    confidenceTier: 1,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'Last 12 El Clásico fixtures averaged 3.42 goals; combined team offensive rating yields an 89% Poisson probability of 2+ goals.',
  },
  {
    id: 'sp-3',
    eventId: 'sr:match:5100701',
    matchLabel: 'Enyimba FC vs Remo Stars',
    homeTeam: 'Enyimba FC',
    awayTeam: 'Remo Stars',
    league: 'NPFL (Nigeria Premier Football League)',
    country: 'Nigeria',
    category: 'africa',
    kickoff: 'Today, 16:00',
    market: 'Enyimba or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.18,
    probability: 0.89,
    ev: 0.05,
    confidenceScore: 94,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🇳🇬 NPFL Anchor',
    modelRationale: 'Enyimba maintains an 84% home win rate in Aba this season, while Remo Stars away goal output is restricted to 0.7 goals/game.',
  },
  {
    id: 'sp-4',
    eventId: 'sr:match:5100401',
    matchLabel: 'Inter Milan vs Juventus',
    homeTeam: 'Inter Milan',
    awayTeam: 'Juventus',
    league: 'Serie A',
    country: 'Italy',
    category: 'major-europe',
    kickoff: 'Today, 19:45',
    market: 'Inter Milan or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.25,
    probability: 0.84,
    ev: 0.05,
    confidenceScore: 91,
    confidenceTier: 1,
    modelType: 'double_chance',
    badgeLabel: '🎯 Double Chance',
    modelRationale: 'Inter leads Serie A in home expected points (xPTS). San Siro defensive structure allows just 0.65 xGA per 90.',
  },
  {
    id: 'sp-5',
    eventId: 'sr:match:5100301',
    matchLabel: 'Bayern Munich vs Bayer Leverkusen',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Bayer Leverkusen',
    league: 'Bundesliga',
    country: 'Germany',
    category: 'major-europe',
    kickoff: 'Today, 17:30',
    market: 'Both Teams to Score (BTTS Yes)',
    marketName: 'Both Teams To Score',
    marketId: '29',
    outcomeId: '29',
    odds: 1.48,
    probability: 0.74,
    ev: 0.095,
    confidenceScore: 89,
    confidenceTier: 2,
    modelType: 'btts',
    badgeLabel: '🔥 BTTS Signal',
    modelRationale: 'Both teams scored in 9 of their last 10 meetings. High-line pressing setups create sustained counter-attacking overloads.',
  },
  {
    id: 'sp-6',
    eventId: 'sr:match:5100501',
    matchLabel: 'Paris Saint-Germain vs Marseille',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Marseille',
    league: 'Ligue 1',
    country: 'France',
    category: 'major-europe',
    kickoff: 'Today, 20:00',
    market: 'PSG Win (1)',
    marketName: '1X2',
    marketId: '1',
    outcomeId: '1',
    odds: 1.50,
    probability: 0.73,
    ev: 0.095,
    confidenceScore: 88,
    confidenceTier: 2,
    modelType: 'value_play',
    badgeLabel: '💰 Value Pick',
    modelRationale: 'PSG home goal output averages 2.6 per match, meeting a Marseille side that conceded in 6 consecutive away league trips.',
  },
  {
    id: 'sp-7',
    eventId: 'sr:match:5100702',
    matchLabel: 'Enugu Rangers vs Shooting Stars',
    homeTeam: 'Enugu Rangers',
    awayTeam: 'Shooting Stars',
    league: 'NPFL (Nigeria Premier Football League)',
    country: 'Nigeria',
    category: 'africa',
    kickoff: 'Today, 16:00',
    market: 'Enugu Rangers or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.15,
    probability: 0.90,
    ev: 0.035,
    confidenceScore: 96,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Enugu Rangers boast the highest clean-sheet percentage in the NPFL (62%) when playing at the Nnamdi Azikiwe Stadium.',
  },
  {
    id: 'sp-8',
    eventId: 'sr:match:5100801',
    matchLabel: 'Ajax vs PSV Eindhoven',
    homeTeam: 'Ajax',
    awayTeam: 'PSV Eindhoven',
    league: 'Eredivisie',
    country: 'Netherlands',
    category: 'other-europe',
    kickoff: 'Today, 19:00',
    market: 'Over 2.5 Goals',
    marketName: 'Over/Under 2.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=2.5',
    odds: 1.45,
    probability: 0.76,
    ev: 0.102,
    confidenceScore: 90,
    confidenceTier: 2,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'Eredivisie marquee clash features two of Europe top 5 offenses by open-play xG. 85% of previous H2H cleared 2.5 goals.',
  },
  {
    id: 'sp-9',
    eventId: 'sr:match:5100703',
    matchLabel: 'Mamelodi Sundowns vs Orlando Pirates',
    homeTeam: 'Mamelodi Sundowns',
    awayTeam: 'Orlando Pirates',
    league: 'Premiership (PSL)',
    country: 'South Africa',
    category: 'africa',
    kickoff: 'Today, 14:30',
    market: 'Sundowns or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.20,
    probability: 0.88,
    ev: 0.056,
    confidenceScore: 92,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🌍 Africa Lock',
    modelRationale: 'Sundowns have not lost a domestic home league fixture in over 14 months, dictating 66% average territory control.',
  },
  {
    id: 'sp-10',
    eventId: 'sr:match:5101001',
    matchLabel: 'Al-Hilal vs Al-Nassr',
    homeTeam: 'Al-Hilal',
    awayTeam: 'Al-Nassr',
    league: 'Saudi Pro League',
    country: 'Saudi Arabia',
    category: 'asia-oceania',
    kickoff: 'Today, 18:00',
    market: 'Over 2.5 Goals',
    marketName: 'Over/Under 2.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=2.5',
    odds: 1.50,
    probability: 0.73,
    ev: 0.095,
    confidenceScore: 89,
    confidenceTier: 2,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'Both squads feature world-class strike partnerships with combined match xG exceeding 3.5 per contest.',
  },
  {
    id: 'sp-11',
    eventId: 'sr:match:5100901',
    matchLabel: 'Flamengo vs Palmeiras',
    homeTeam: 'Flamengo',
    awayTeam: 'Palmeiras',
    league: 'Série A',
    country: 'Brazil',
    category: 'americas',
    kickoff: 'Today, 21:00',
    market: 'Flamengo or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.28,
    probability: 0.83,
    ev: 0.062,
    confidenceScore: 90,
    confidenceTier: 1,
    modelType: 'double_chance',
    badgeLabel: '🌎 Americas Anchor',
    modelRationale: 'Flamengo Maracanã home defensive metrics rank 1st in South America for ball recoveries and shots conceded on target.',
  },
  {
    id: 'sp-12',
    eventId: 'sr:match:5100102',
    matchLabel: 'Liverpool vs Manchester City',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester City',
    league: 'Premier League',
    country: 'England',
    category: 'major-europe',
    kickoff: 'Today, 16:30',
    market: 'Both Teams to Score (BTTS Yes)',
    marketName: 'Both Teams To Score',
    marketId: '29',
    outcomeId: '29',
    odds: 1.50,
    probability: 0.74,
    ev: 0.11,
    confidenceScore: 91,
    confidenceTier: 2,
    modelType: 'btts',
    badgeLabel: '🔥 BTTS Signal',
    modelRationale: 'Liverpool scored in 24 consecutive matches at Anfield; Man City created over 2.0 xG in every away match against top 6 opposition.',
  },
  {
    id: 'sp-13',
    eventId: 'sr:match:5100103',
    matchLabel: 'Tottenham vs Aston Villa',
    homeTeam: 'Tottenham',
    awayTeam: 'Aston Villa',
    league: 'Premier League',
    country: 'England',
    category: 'major-europe',
    kickoff: 'Today, 15:00',
    market: 'Over 2.5 Goals',
    marketName: 'Over/Under 2.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=2.5',
    odds: 1.48,
    probability: 0.76,
    ev: 0.12,
    confidenceScore: 92,
    confidenceTier: 2,
    modelType: 'goals_lock',
    badgeLabel: '🔥 Goals Lock',
    modelRationale: 'Both sides play aggressive high-line transition systems, combining for 3.65 average total goals per match in current campaign.',
  },
  {
    id: 'sp-14',
    eventId: 'sr:match:5100104',
    matchLabel: 'Newcastle vs Everton',
    homeTeam: 'Newcastle',
    awayTeam: 'Everton',
    league: 'Premier League',
    country: 'England',
    category: 'major-europe',
    kickoff: 'Today, 17:30',
    market: 'Newcastle or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.20,
    probability: 0.87,
    ev: 0.044,
    confidenceScore: 95,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Newcastle hold an 82% unbeaten rate at St. James Park over the past 14 months with top-quartile defensive set-piece suppression.',
  },
  {
    id: 'sp-15',
    eventId: 'sr:match:5100202',
    matchLabel: 'Atletico Madrid vs Sevilla',
    homeTeam: 'Atletico Madrid',
    awayTeam: 'Sevilla',
    league: 'La Liga',
    country: 'Spain',
    category: 'major-europe',
    kickoff: 'Today, 18:30',
    market: 'Atletico Madrid or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.16,
    probability: 0.90,
    ev: 0.044,
    confidenceScore: 96,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Simeone has conceded only 0.65 goals per game at Metropolitano; Sevilla have 1 win in their last 9 away fixtures.',
  },
  {
    id: 'sp-16',
    eventId: 'sr:match:5100203',
    matchLabel: 'Girona vs Valencia',
    homeTeam: 'Girona',
    awayTeam: 'Valencia',
    league: 'La Liga',
    country: 'Spain',
    category: 'major-europe',
    kickoff: 'Today, 14:00',
    market: 'Over 1.5 Goals',
    marketName: 'Over/Under 1.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=1.5',
    odds: 1.25,
    probability: 0.84,
    ev: 0.05,
    confidenceScore: 93,
    confidenceTier: 1,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'Girona matches boast an 88% rate of 2+ total goals, driven by aggressive full-back overlaps and high turnover volume.',
  },
  {
    id: 'sp-17',
    eventId: 'sr:match:5100302',
    matchLabel: 'Bayer Leverkusen vs Wolfsburg',
    homeTeam: 'Bayer Leverkusen',
    awayTeam: 'Wolfsburg',
    league: 'Bundesliga',
    country: 'Germany',
    category: 'major-europe',
    kickoff: 'Today, 15:30',
    market: 'Leverkusen to Win or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.15,
    probability: 0.91,
    ev: 0.046,
    confidenceScore: 97,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Xabi Alonso system remains remarkably dominant at BayArena with 67% average possession and +1.6 expected goal difference.',
  },
  {
    id: 'sp-18',
    eventId: 'sr:match:5100303',
    matchLabel: 'Borussia Dortmund vs Frankfurt',
    homeTeam: 'Borussia Dortmund',
    awayTeam: 'Frankfurt',
    league: 'Bundesliga',
    country: 'Germany',
    category: 'major-europe',
    kickoff: 'Today, 18:30',
    market: 'Over 2.5 Goals',
    marketName: 'Over/Under 2.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=2.5',
    odds: 1.45,
    probability: 0.77,
    ev: 0.116,
    confidenceScore: 92,
    confidenceTier: 2,
    modelType: 'goals_lock',
    badgeLabel: '🔥 Goals Lock',
    modelRationale: 'Signal strength 92% — previous 7 head-to-head encounters generated 27 goals, averaging 3.86 goals per fixture.',
  },
  {
    id: 'sp-19',
    eventId: 'sr:match:5100402',
    matchLabel: 'Juventus vs Torino',
    homeTeam: 'Juventus',
    awayTeam: 'Torino',
    league: 'Serie A',
    country: 'Italy',
    category: 'major-europe',
    kickoff: 'Today, 18:00',
    market: 'Juventus or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.18,
    probability: 0.88,
    ev: 0.038,
    confidenceScore: 95,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Juventus are unbeaten in 18 consecutive Turin derbies with 11 clean sheets recorded in the Derby della Mole.',
  },
  {
    id: 'sp-20',
    eventId: 'sr:match:5100403',
    matchLabel: 'Atalanta vs Udinese',
    homeTeam: 'Atalanta',
    awayTeam: 'Udinese',
    league: 'Serie A',
    country: 'Italy',
    category: 'major-europe',
    kickoff: 'Today, 15:00',
    market: 'Over 1.5 Goals',
    marketName: 'Over/Under 1.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=1.5',
    odds: 1.22,
    probability: 0.86,
    ev: 0.049,
    confidenceScore: 94,
    confidenceTier: 1,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'Gasperini pressing scheme delivers 2.15 home xG; 9 of the last 10 meetings surpassed the 1.5 goal threshold comfortably.',
  },
  {
    id: 'sp-21',
    eventId: 'sr:match:5100502',
    matchLabel: 'Monaco vs Lille',
    homeTeam: 'Monaco',
    awayTeam: 'Lille',
    league: 'Ligue 1',
    country: 'France',
    category: 'major-europe',
    kickoff: 'Today, 21:00',
    market: 'Monaco or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.30,
    probability: 0.81,
    ev: 0.053,
    confidenceScore: 91,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Monaco maintain an unbeaten run in 6 home matches, creating 14 big chances while allowing under 0.9 xG against top half sides.',
  },
  {
    id: 'sp-22',
    eventId: 'sr:match:5100503',
    matchLabel: 'Marseille vs Lens',
    homeTeam: 'Marseille',
    awayTeam: 'Lens',
    league: 'Ligue 1',
    country: 'France',
    category: 'major-europe',
    kickoff: 'Today, 17:00',
    market: 'Over 1.5 Goals',
    marketName: 'Over/Under 1.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=1.5',
    odds: 1.24,
    probability: 0.85,
    ev: 0.054,
    confidenceScore: 93,
    confidenceTier: 1,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'De Zerbi high-tempo transition play has seen all 6 Stade Velodrome games yield over 2 goals this season.',
  },
  {
    id: 'sp-23',
    eventId: 'sr:match:5100602',
    matchLabel: 'Sporting CP vs Braga',
    homeTeam: 'Sporting CP',
    awayTeam: 'Braga',
    league: 'Primeira Liga',
    country: 'Portugal',
    category: 'major-europe',
    kickoff: 'Today, 19:00',
    market: 'Sporting CP or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.17,
    probability: 0.89,
    ev: 0.041,
    confidenceScore: 96,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'SportyBet verified data: Sporting are 100% win-rate at Jose Alvalade, conceding just 4 goals across all competitions.',
  },
  {
    id: 'sp-24',
    eventId: 'sr:match:5100603',
    matchLabel: 'Porto vs Vitoria Guimaraes',
    homeTeam: 'Porto',
    awayTeam: 'Vitoria Guimaraes',
    league: 'Primeira Liga',
    country: 'Portugal',
    category: 'major-europe',
    kickoff: 'Today, 21:30',
    market: 'Porto to Win (1)',
    marketName: '1X2',
    marketId: '1',
    outcomeId: '1',
    odds: 1.33,
    probability: 0.80,
    ev: 0.064,
    confidenceScore: 92,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Porto have won 14 of their last 15 home clashes with Guimaraes, with a goal ratio of 38-7 in that sample.',
  },
  {
    id: 'sp-25',
    eventId: 'sr:match:5100702',
    matchLabel: 'Ajax vs Feyenoord',
    homeTeam: 'Ajax',
    awayTeam: 'Feyenoord',
    league: 'Eredivisie',
    country: 'Netherlands',
    category: 'major-europe',
    kickoff: 'Today, 14:30',
    market: 'Over 2.5 Goals',
    marketName: 'Over/Under 2.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=2.5',
    odds: 1.48,
    probability: 0.75,
    ev: 0.11,
    confidenceScore: 90,
    confidenceTier: 2,
    modelType: 'goals_lock',
    badgeLabel: '🔥 Goals Lock',
    modelRationale: 'De Klassieker fixture has seen over 2.5 goals in 8 of the last 9 meetings, with both teams playing top-third attacking football.',
  },
  {
    id: 'sp-26',
    eventId: 'sr:match:5100703',
    matchLabel: 'PSV Eindhoven vs AZ Alkmaar',
    homeTeam: 'PSV Eindhoven',
    awayTeam: 'AZ Alkmaar',
    league: 'Eredivisie',
    country: 'Netherlands',
    category: 'major-europe',
    kickoff: 'Today, 16:45',
    market: 'PSV or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.16,
    probability: 0.90,
    ev: 0.044,
    confidenceScore: 96,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'PSV hold a +28 goal differential at Philips Stadion, scoring at a 3.2 goals per game clip across all domestic fixtures.',
  },
  {
    id: 'sp-27',
    eventId: 'sr:match:5100801',
    matchLabel: 'Celtic vs Aberdeen',
    homeTeam: 'Celtic',
    awayTeam: 'Aberdeen',
    league: 'Premiership',
    country: 'Scotland',
    category: 'major-europe',
    kickoff: 'Today, 15:00',
    market: 'Celtic to Win (1)',
    marketName: '1X2',
    marketId: '1',
    outcomeId: '1',
    odds: 1.25,
    probability: 0.85,
    ev: 0.062,
    confidenceScore: 94,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Celtic have won 11 consecutive home matches with +2.8 average goal margin, dominating possession at 71%.',
  },
  {
    id: 'sp-28',
    eventId: 'sr:match:5100802',
    matchLabel: 'Rangers vs Hearts',
    homeTeam: 'Rangers',
    awayTeam: 'Hearts',
    league: 'Premiership',
    country: 'Scotland',
    category: 'major-europe',
    kickoff: 'Today, 17:30',
    market: 'Rangers or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.15,
    probability: 0.91,
    ev: 0.046,
    confidenceScore: 97,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Ibrox fortress: Rangers have lost just 1 home game in 20 matches, conceding only 0.55 xG per 90.',
  },
  {
    id: 'sp-29',
    eventId: 'sr:match:5100901',
    matchLabel: 'Galatasaray vs Besiktas',
    homeTeam: 'Galatasaray',
    awayTeam: 'Besiktas',
    league: 'Super Lig',
    country: 'Turkey',
    category: 'major-europe',
    kickoff: 'Today, 19:00',
    market: 'Galatasaray or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.22,
    probability: 0.86,
    ev: 0.049,
    confidenceScore: 94,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Galatasaray boast an undefeated home record across 22 straight league fixtures with Osimhen and Icardi generating 2.8 big chances/match.',
  },
  {
    id: 'sp-30',
    eventId: 'sr:match:5100902',
    matchLabel: 'Fenerbahce vs Trabzonspor',
    homeTeam: 'Fenerbahce',
    awayTeam: 'Trabzonspor',
    league: 'Super Lig',
    country: 'Turkey',
    category: 'major-europe',
    kickoff: 'Today, 17:00',
    market: 'Over 1.5 Goals',
    marketName: 'Over/Under 1.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=1.5',
    odds: 1.21,
    probability: 0.87,
    ev: 0.052,
    confidenceScore: 95,
    confidenceTier: 1,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'Mourinho side average 2.1 goals scored at Sukru Saracoglu, while Trabzonspor have conceded in 9 of their last 10 away games.',
  },
  {
    id: 'sp-31',
    eventId: 'sr:match:5101001',
    matchLabel: 'Inter Miami vs Atlanta United',
    homeTeam: 'Inter Miami',
    awayTeam: 'Atlanta United',
    league: 'MLS',
    country: 'USA',
    category: 'international',
    kickoff: 'Today, 23:30',
    market: 'Over 2.5 Goals',
    marketName: 'Over/Under 2.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=2.5',
    odds: 1.42,
    probability: 0.78,
    ev: 0.107,
    confidenceScore: 92,
    confidenceTier: 2,
    modelType: 'goals_lock',
    badgeLabel: '🔥 Goals Lock',
    modelRationale: 'Messi & Suarez attack produces 2.65 goals per match at Chase Stadium; 100% of Miami home playoffs crossed 2.5 goals.',
  },
  {
    id: 'sp-32',
    eventId: 'sr:match:5101002',
    matchLabel: 'LA Galaxy vs Colorado Rapids',
    homeTeam: 'LA Galaxy',
    awayTeam: 'Colorado Rapids',
    league: 'MLS',
    country: 'USA',
    category: 'international',
    kickoff: 'Today, 02:00',
    market: 'LA Galaxy or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.22,
    probability: 0.86,
    ev: 0.049,
    confidenceScore: 93,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Midnight odds pick: Galaxy are unbeaten in 16 home matches with Puig generating league-leading progressive passing numbers.',
  },
  {
    id: 'sp-33',
    eventId: 'sr:match:5101101',
    matchLabel: 'Flamengo vs Corinthians',
    homeTeam: 'Flamengo',
    awayTeam: 'Corinthians',
    league: 'Serie A',
    country: 'Brazil',
    category: 'international',
    kickoff: 'Today, 23:00',
    market: 'Flamengo or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.18,
    probability: 0.88,
    ev: 0.038,
    confidenceScore: 94,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Midnight fixture: Maracana stronghold where Flamengo concede an average of just 0.52 goals per 90 in domestic cup and league.',
  },
  {
    id: 'sp-34',
    eventId: 'sr:match:5101102',
    matchLabel: 'Palmeiras vs Botafogo',
    homeTeam: 'Palmeiras',
    awayTeam: 'Botafogo',
    league: 'Serie A',
    country: 'Brazil',
    category: 'international',
    kickoff: 'Today, 01:30',
    market: 'Over 1.5 Goals',
    marketName: 'Over/Under 1.5',
    marketId: '18',
    outcomeId: '12',
    specifier: 'total=1.5',
    odds: 1.28,
    probability: 0.83,
    ev: 0.062,
    confidenceScore: 91,
    confidenceTier: 1,
    modelType: 'goals_lock',
    badgeLabel: '⚽ Goals Lock',
    modelRationale: 'Midnight odds clash: Title decider featuring two of South America’s most prolific counter-attacking units.',
  },
  {
    id: 'sp-35',
    eventId: 'sr:match:5101201',
    matchLabel: 'River Plate vs Boca Juniors',
    homeTeam: 'River Plate',
    awayTeam: 'Boca Juniors',
    league: 'Liga Profesional',
    country: 'Argentina',
    category: 'international',
    kickoff: 'Today, 22:00',
    market: 'River Plate or Draw (1X)',
    marketName: 'Double Chance',
    marketId: '10',
    outcomeId: '10',
    odds: 1.25,
    probability: 0.84,
    ev: 0.05,
    confidenceScore: 92,
    confidenceTier: 1,
    modelType: 'banker',
    badgeLabel: '🛡️ Tier 1 Banker',
    modelRationale: 'Superclasico at Monumental: River Plate possess a 79% win rate when playing at home with 84,000 spectators backing them.',
  },
]

// ── Target Odds Acca Generator Algorithm ─────────────────────────────────────
// Selects the optimal combination of picks to hit the target odds with maximum survival probability.

export function generateTargetOddsAcca(
  targetOdds: number,
  availablePicks: DailySurePick[],
  maxLegs = 20,
): DailySurePick[] {
  if (availablePicks.length === 0) return []

  const uniqueByEvent = new Map<string, DailySurePick>()
  for (const pick of availablePicks) {
    const existing = uniqueByEvent.get(pick.eventId)
    if (!existing || pick.probability > existing.probability) {
      uniqueByEvent.set(pick.eventId, pick)
    }
  }

  const sorted = [...uniqueByEvent.values()].sort(
    (a, b) => b.probability * (1 + b.ev) - a.probability * (1 + a.ev),
  )

  const cap = Math.max(1, maxLegs)
  let currentOdds = 1.0
  const selected: DailySurePick[] = []

  for (const pick of sorted) {
    if (selected.length >= cap) break
    if (currentOdds * pick.odds <= targetOdds * 1.2) {
      selected.push(pick)
      currentOdds *= pick.odds
    }
    if (currentOdds >= targetOdds * 0.92) break
  }

  if (selected.length === 0 && sorted.length > 0) {
    return sorted.slice(0, Math.min(cap, Math.max(2, Math.min(6, sorted.length))))
  }

  if (selected.length < Math.min(2, cap) && sorted.length > selected.length) {
    for (const pick of sorted) {
      if (selected.length >= cap) break
      if (!selected.some(s => s.eventId === pick.eventId)) {
        selected.push(pick)
      }
    }
  }

  return selected
}
