# Odds Factory - Codebase Analysis & Architecture

## 📋 Project Overview
**Odds Factory** is a sports betting optimization tool built with React + TypeScript + Vite. It analyzes betting slips from SportyBet, profiles matches based on advanced statistical models, and recommends optimized market selections for better survival rates and expected value (EV).

**Purpose**: Auto-optimize SportyBet booking codes using intelligent match profiling and market analysis.

---

## 🏗️ Project Architecture

### Tech Stack
```
Frontend Framework: React 19 + TypeScript
Build Tool: Vite 8
Styling: TailwindCSS 4
Runtime: Node.js/Bun
Package Manager: npm
```

### Directory Structure
```
src/
├── components/           # React UI Components
│   ├── SlipEditorPanel.tsx      (Main slip editor & code generator)
│   ├── SlipLegRow.tsx           (Individual betting leg display)
│   ├── ProfileBadge.tsx         (Match profile badge UI)
│   └── TierBadge.tsx            (Confidence tier indicator)
├── engine/               # Core Optimization Logic
│   ├── features.ts       (Feature engineering for match analysis)
│   ├── profiling.ts      (Match profile classification)
│   ├── markets.ts        (Market recommendations & analysis)
│   ├── probability.ts    (Probability calculations)
│   ├── slipBuilder.ts    (Slip construction & optimization)
│   └── slipEditor.ts     (Slip editing logic)
├── hooks/                # Custom React Hooks
│   └── useBacktest.ts    (Backtesting simulation hook)
├── types/                # TypeScript Type Definitions
│   └── index.ts          (All domain types)
├── data/                 # Static Data
│   └── sampleMatches.ts  (Sample match data for demo)
├── App.tsx               # Root App Component
├── main.tsx              # Entry point
└── index.css             # Global styles
```

---

## 🧠 Core Modules Explained

### 1. **Types Module** (`src/types/index.ts`)
Defines domain models for the entire application:

```typescript
Key Types:
- Sport          // football, basketball, tennis, etc.
- FootballStats  // goalsFor, xG, cleanSheetRate, etc.
- BasketballStats // pace, PPG, rebounds, etc.
- Match          // Complete match data with stats
- MarketOdds     // Betting market with odds
- Slip           // Collection of betting legs
- SlipLeg        // Single betting selection
- MatchProfile   // Classification: high_goal, low_goal, etc.
- ComputedFeatures // Derived analytics
- MarketRecommendation // Suggested picks with EV
```

### 2. **Feature Engineering** (`src/engine/features.ts`)
Computes advanced metrics from raw match data:

**Football Features:**
- `attackIndex` - Offensive strength (0-100)
- `defenseIndex` - Defensive capability (0-100)
- `goalEnvironment` - Expected goals environment
- `volatility` - Match unpredictability
- `fatigueIndex` - Player tiredness impact

**Basketball Features:**
- `paceScore` - Game speed/tempo
- `offensiveEfficiency` - Points per possession
- `defensiveEfficiency` - Defensive rating
- `totalPointsEnvironment` - Over/under tendency
- `backToBackFatigue` - Back-to-back game impact

### 3. **Match Profiling** (`src/engine/profiling.ts`)
Classifies matches into behavioral profiles:

**Football Profiles:**
- `high_goal` - Attack-focused, goals likely
- `low_goal` - Defensive, under 2.5 likely
- `controlled` - Dominant team, strong form
- `chaos` - Youth/friendly, unpredictable
- `balanced` - Mixed team strengths

**Basketball Profiles:**
- `high_scoring` - Over-heavy matchup (220+ PPG)
- `low_scoring` - Under-heavy matchup
- `controlled_favorite` - Favored team dominates
- `volatile` - Injuries/playoffs add risk
- `even_matchup` - Competitive matchup

### 4. **Market Analysis** (`src/engine/markets.ts`)
Recommends optimal betting markets based on profile:

```
Profile → Primary Markets → Secondary Markets → Avoid Markets

Example (Football - High Goal):
- Primary:    [Over 2.5, BTTS Yes, Over 1.5]
- Secondary:  [Home or Draw, Asian Handicap]
- Avoid:      [Both Halves Under, Clean Sheet]
```

**Confidence Tiers:**
- Tier 1: High confidence (75%+ probability)
- Tier 2: Medium confidence (60-75%)
- Tier 3: Speculative (50-60%)

### 5. **Slip Builder** (`src/engine/slipBuilder.ts`)
Constructs optimized betting slips:

**Slip Modes:**
- `single_acca` - Traditional parlay (max 15 legs)
- `bank_pool` - Conservative banking (max 8 legs)
- `night_midnight` - Late games (max 12 legs)

**Optimization Logic:**
1. Rank matches by prediction confidence
2. Extract best market recommendation per match
3. Ensure variety (avoid repetitive markets)
4. Apply mode-specific stake percentages
5. Calculate cumulative EV and probability

### 6. **Probability Module** (`src/engine/probability.ts`)
Calculates statistical metrics:
- Implied probability from odds
- Expected Value (EV) per selection
- Cumulative slip survival probability
- Kelly Criterion stake sizing (optional)

---

## 🎯 Data Flow

```
User Input (Booking Code)
    ↓
Fetch from SportyBet API (/api/sportybet/orders/share/{code})
    ↓
Parse response into Match objects
    ↓
For each Match:
  - computeFeatures() → extract metrics
  - profileMatch() → classify behavior
  - analyzeMatch() → get market recommendations
    ↓
buildSlip() combines recommendations
    ↓
Display SlipEditorPanel with optimizations
    ↓
User can edit/remove legs
    ↓
generateCode() creates new optimized booking code
    ↓
POST to /api/sportybet/orders/share → get new code
```

---

## 🔗 SportyBet Integration

### API Endpoints Used
```
GET  /api/sportybet/orders/share/{bookingCode}
     → Fetch existing slip details

POST /api/sportybet/orders/share
     → Generate new optimized booking code
     
Payload Format:
{
  selections: [
    {
      eventId: "sr:match:12345",
      marketId: "18",        // Market type
      outcomeId: "1",        // Prediction
      specifier: ""
    },
    ...
  ],
  device: "web",
  source: "betslip"
}
```

### Vite Proxy Configuration
```typescript
// vite.config.ts
proxy: {
  '/api/sportybet': {
    target: 'https://www.sportybet.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/sportybet/, '/api/ng')
  }
}
```

---

## 🎨 Component Hierarchy

```
App (root)
├── Header
│   ├── Logo + Title
│   └── Status Indicator
├── Navigation (Tab selector)
├── SlipEditorPanel (main content)
│   ├── Import Code Form
│   ├── Match Analyzer
│   ├── Slip Display
│   │   └── SlipLegRow[] (individual legs)
│   │       ├── ProfileBadge (match type)
│   │       ├── TierBadge (confidence)
│   │       └── Remove Button
│   ├── Edit Log
│   └── Code Generator
└── Footer
```

---

## 📊 Example Workflow

### Input: User pastes SportyBet code "BC5F2A9"

**Step 1: Load Code**
```
GET /api/sportybet/orders/share/BC5F2A9
Response: { selections: [...], outcomes: [...] }
```

**Step 2: Parse & Build Matches**
- Extract 4 Football + 1 Basketball match
- Enrich with computed features

**Step 3: Analyze Each Match**
```
Match: Arsenal vs Brighton
Features: attackIndex=72, defenseIndex=38, goalEnvironment=68
Profile: "high_goal" (High Goal Profile)
Markets: [
  { market: "Over 2.5", odds: 1.85, probability: 71%, tier: 1 },
  { market: "BTTS Yes", odds: 1.72, probability: 65%, tier: 1 },
  { market: "Over 1.5", odds: 1.28, probability: 78%, tier: 1 }
]
```

**Step 4: Build Optimized Slip**
- Select best market per match
- Calculate combined EV
- Recommended stake percentage

**Step 5: Generate New Code**
```
POST /api/sportybet/orders/share
With optimized selections
Returns: { shareCode: "N7K2X9M" }
```

---

## 🔧 Key Features

### ✅ Implemented
- [x] Match profiling (Football + Basketball)
- [x] Feature engineering (20+ metrics)
- [x] Market recommendation system
- [x] Slip building with variety logic
- [x] SportyBet API integration
- [x] Booking code parsing
- [x] Booking code generation
- [x] Edit log tracking
- [x] Responsive UI with TailwindCSS
- [x] TypeScript strict mode

### 🚀 Optional Enhancements
- Advanced ML-based profiling (under development)
- Backtesting simulation (useBacktest hook ready)
- Kelly Criterion stake sizing
- Hedging strategy recommendations
- Multi-sport comparison matrix
- Real-time odds tracking

---

## 📈 Performance Considerations

**Optimization Techniques:**
1. Memoization via `useCallback` hooks
2. Lazy computation (features only on demand)
3. Market caching (avoid repeated API calls)
4. React 19 concurrent rendering

**Scalability:**
- Can handle 50+ matches per slip
- Feature computation is O(1) for each match
- API responses cached in component state

---

## 🐛 Known Issues & Fixes Applied

**Fixed:**
- [x] Escaped quote syntax in `features.ts` line 53 (\'special\' → 'special')

**Testing:**
- Sample matches provided for testing without live API
- Fallback code generation if API fails

---

## 📝 Configuration Files

### `package.json`
```json
{
  "scripts": {
    "dev": "vite",           // Start dev server
    "build": "tsc -b && vite build",  // Build for production
    "lint": "eslint .",      // Lint TypeScript
    "preview": "vite preview" // Preview production build
  }
}
```

### `tsconfig.json`
- Strict mode enabled
- React JSX support
- Module: ES2020
- Target: ES2020

### `vite.config.ts`
- React plugin with Oxc
- TailwindCSS integration
- SportyBet API proxy

---

## 💡 Development Tips

### Running Locally
```bash
npm install
npm run dev          # Starts on http://localhost:5174
npm run build        # Production build
npm run lint         # Check code quality
```

### Adding a New Match Sport
1. Define stats type in `types/index.ts`
2. Add feature computation in `features.ts`
3. Add profiling logic in `profiling.ts`
4. Define market configs in `markets.ts`

### Testing Market Recommendations
- Use sample matches in `data/sampleMatches.ts`
- Paste booking code in UI (no live API needed)
- Check console logs for detailed analysis

---

## 🎯 Business Logic Summary

The system works on this principle:

> **Better Market Selection = Higher Survival Rates**

By analyzing match context (team form, injuries, motivation, fatigue, head-to-head), Odds Factory identifies which betting markets align with expected match behavior. A match profiled as "high_goal" shouldn't have "Clean Sheet" picks. A team facing back-to-back games shouldn't take overs in basketball.

This intelligent segmentation improves your betting slip's survival probability **without changing your stakes or risk**.

---

## 📚 File Summary

| File | LOC | Purpose |
|------|-----|---------|
| App.tsx | 100 | Main app shell |
| SlipEditorPanel.tsx | 400+ | Slip editor & code generator |
| features.ts | 150+ | Feature engineering |
| profiling.ts | 150+ | Match classification |
| markets.ts | 250+ | Market recommendations |
| slipBuilder.ts | 100+ | Slip construction |
| types/index.ts | 150+ | Type definitions |
| sampleMatches.ts | 300+ | Test data |

**Total: ~1,600 lines of production code**

---

Generated: June 2026
Status: ✅ Ready for optimization
