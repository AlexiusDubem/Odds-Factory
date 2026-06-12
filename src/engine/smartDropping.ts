import { Slip, SlipLeg, OptimizationGoal } from '../types'
import { fetchMatchEnrichment } from './sportmonks'

export interface DroppingMetrics {
  legId: string;
  trueProbability: number;
  ev: number;
  confidenceScore: number;
  volatility: number;
  
  // Slip level impacts
  sspIncrease: number; // Simulated Slip Probability Increase
  oddsReduction: number;
  impactScore: number;
  rationale: string;
}

export interface SmartDropResult {
  optimizedSlip: Slip;
  droppedLegs: DroppingMetrics[];
  originalHealth: SlipHealth;
  optimizedHealth: SlipHealth;
}

export interface SlipHealth {
  riskScore: number;       // 0-100 (Lower is better)
  stabilityScore: number;  // 0-100 (Higher is better)
  confidenceScore: number; // 0-100
  valueScore: number;      // 0-100
  overallScore: number;    // 0-100 Health Score
}

/**
 * Calculates the core health metrics of a betting slip.
 */
export function calculateSlipHealth(legs: SlipLeg[], combinedOdds: number): SlipHealth {
  if (legs.length === 0) return { riskScore: 0, stabilityScore: 0, confidenceScore: 0, valueScore: 0, overallScore: 0 };

  const combinedProb = legs.reduce((acc, leg) => acc * (leg.probability || 0.5), 1);
  
  // Risk Score: Higher odds & lower probability = higher risk. Maxes out around 85 for crazy slips.
  let risk = (1 - combinedProb) * 100;
  if (combinedOdds > 50) risk = Math.min(99, risk + 5);

  // Confidence Score: Average tier (3 = high, 1 = low)
  const avgTier = legs.reduce((acc, leg) => acc + (leg.tier || 2), 0) / legs.length;
  const confidence = (avgTier / 3) * 100;

  // Value Score: Average EV
  const avgEv = legs.reduce((acc, leg) => acc + (((leg.probability || 0.5) * leg.odds) - 1), 0) / legs.length;
  const value = Math.max(0, Math.min(100, 50 + (avgEv * 100)));

  // Stability Score: Penalize long accumulators.
  const stability = Math.max(0, 100 - (legs.length * 5) + (confidence * 0.2));

  return {
    riskScore: Math.round(risk),
    stabilityScore: Math.round(stability),
    confidenceScore: Math.round(confidence),
    valueScore: Math.round(value),
    overallScore: Math.round((stability * 0.4) + (confidence * 0.3) + (value * 0.3) - (risk > 90 ? 10 : 0))
  };
}

/**
 * Main engine function to analyze a slip and recommend drops.
 */
export async function analyzeSmartDrops(slip: Slip, goal: OptimizationGoal): Promise<SmartDropResult> {
  const originalHealth = calculateSlipHealth(slip.legs, slip.combinedOdds);
  const OSP = slip.survivalProbability; // Original Slip Probability
  const OSO = slip.combinedOdds; // Original Slip Odds

  const droppingMetrics: DroppingMetrics[] = [];

  for (const leg of slip.legs) {
    // 1. Data Enrichment via SportMonks (Fallback active if API fails)
    const teams = leg.matchLabel.split(' vs ');
    const home = teams[0] || 'Home';
    const away = teams[1] || 'Away';
    
    // In real app, we await this.
    // For fast UI rendering, we trigger it synchronously or cache it.
    const stats = await fetchMatchEnrichment(home, away);

    // 2. Individual Metrics
    // Blend engine probability with real SportMonks data to find True Probability
    const trueProb = ((leg.probability || 0.5) * 0.6) + ((stats.home.winRate / 100) * 0.4);
    const ev = (trueProb * leg.odds) - 1;
    const confidence = (leg.tier / 3) * 100;
    const volatility = stats.h2hVolatility;

    // 3. Slip Level Impact
    // If we remove this leg, what is the new probability and odds?
    const ssp = OSP > 0 && leg.probability > 0 ? (OSP / leg.probability) : 0;
    const sso = OSO > 0 && leg.odds > 0 ? (OSO / leg.odds) : 0;

    const sspIncrease = ssp - OSP;
    const oddsReduction = OSO - sso;

    // Risk Reward Ratio: How much % probability do we gain per unit of odds lost?
    const rrr = oddsReduction > 0 ? (sspIncrease * 100) / oddsReduction : 0;

    // Impact Score: Higher means THIS LEG SHOULD BE DROPPED.
    // Negative EV, high volatility, and great SSP increase drive this up.
    let impactScore = (sspIncrease * 50) - (ev * 10) + (volatility * 5);
    
    let rationale = '';
    if (ev < -0.1) rationale = 'Negative expected value (EV). The odds do not justify the risk.';
    else if (volatility > 0.7) rationale = 'High historical volatility in this matchup. Unpredictable outcome.';
    else if (rrr > 2) rationale = 'Dropping this drastically improves ticket survival for minimal odds loss.';
    else rationale = 'Low confidence statistical edge.';

    droppingMetrics.push({
      legId: leg.id,
      trueProbability: trueProb,
      ev,
      confidenceScore: confidence,
      volatility,
      sspIncrease,
      oddsReduction,
      impactScore,
      rationale
    });
  }

  // 4. Rank the weak links (Highest impact score = weakest link)
  droppingMetrics.sort((a, b) => b.impactScore - a.impactScore);

  // 5. Determine how many to drop based on goal
  let dropCount = 0;
  if (goal.mode === 'target_survival' && goal.targetSurvival) {
    let currentProb = OSP;
    for (const m of droppingMetrics) {
      if (currentProb >= (goal.targetSurvival / 100)) break;
      currentProb += m.sspIncrease;
      dropCount++;
    }
  } else if (goal.mode === 'best_ev') {
    dropCount = droppingMetrics.filter(m => m.ev < 0).length;
  } else {
    // Balanced or default: drop the top 1-3 worst offenders if they are really bad
    dropCount = droppingMetrics.filter(m => m.impactScore > 5).slice(0, 3).length;
    if (dropCount === 0 && droppingMetrics.length > 5) dropCount = 1; // Drop at least 1 if slip is big
  }

  const legsToDrop = droppingMetrics.slice(0, dropCount).map(m => m.legId);
  
  // 6. Generate optimized slip
  const keptLegs = slip.legs.filter(l => !legsToDrop.includes(l.id));
  const newOdds = keptLegs.reduce((acc, l) => acc * l.odds, 1);
  const newProb = keptLegs.reduce((acc, l) => acc * (l.probability || 0.5), 1);

  const optimizedSlip: Slip = {
    ...slip,
    id: slip.id + '-opt',
    legs: keptLegs,
    combinedOdds: newOdds,
    survivalProbability: newProb
  };

  return {
    optimizedSlip,
    droppedLegs: droppingMetrics.slice(0, dropCount),
    originalHealth: originalHealth,
    optimizedHealth: calculateSlipHealth(keptLegs, newOdds)
  };
}
