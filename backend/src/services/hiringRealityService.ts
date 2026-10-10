/**
 * HireIQ Hiring Reality Engine™ (Phase 2)
 * 
 * Pre-sourcing job requisition stress-testing and market feasibility analyzer.
 * Evaluates whether a JD is realistic to hire for in the current labor market,
 * identifies talent pool bottlenecks, and simulates requirement relaxation gains.
 * 
 * 100% additive service — does NOT modify ATS scoring engine or candidate evaluations.
 */

export type RealityDifficulty = 'REALISTIC' | 'MODERATE' | 'DIFFICULT';

export interface ConstraintImpact {
  id: string;
  name: string;
  type: 'SKILL' | 'EXPERIENCE' | 'LOCATION' | 'NOTICE_PERIOD' | 'SALARY' | 'MANDATORY_DENSITY';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  poolReductionPercent: number;
  potentialGainPercent: number;
  explanation: string;
  suggestedRelaxation: string;
}

export interface SimulationAdjustment {
  constraintId: string;
  applied: boolean;
}

export interface HiringRealityReport {
  jobTitle: string;
  client: string;
  realityScore: number; // 0 - 100
  difficulty: RealityDifficulty;
  difficultyLabel: string;
  difficultyColor: 'green' | 'amber' | 'red';
  summaryHeadline: string;
  summaryDescription: string;
  estimatedTimeToHireDays: number;
  optimizedTimeToHireDays: number;
  baselinePoolIndex: number; // 100
  simulatedPoolGainPercent: number; // e.g. +58%
  constraints: ConstraintImpact[];
  recommendations: Array<{
    title: string;
    impact: string;
    gain: number;
    actionableText: string;
  }>;
  clientAdvisoryNote: string;
  evaluatedAt: string;
}

export interface HiringRealityInput {
  jobTitle?: string;
  client?: string;
  location?: string;
  workMode?: string;
  salary?: string;
  minExperienceYears?: number;
  maxExperienceYears?: number;
  noticePeriodDays?: number;
  jdText?: string;
  requirements?: Array<{
    id?: string;
    requirement: string;
    category?: string;
    isMandatory?: boolean;
    mandatory?: boolean;
    weight?: number;
  }>;
  activeAdjustments?: string[]; // IDs of constraints relaxed in simulation
}

// Niche / high-scarcity skill dictionary for calibration
const NICHE_SKILL_PATTERNS: Array<{ pattern: RegExp; name: string; reduction: number }> = [
  { pattern: /\bkubernetes\b|\bk8s\b/i, name: 'Kubernetes / K8s', reduction: 31 },
  { pattern: /\bkafka\b|\brabbitmq\b/i, name: 'Event Streaming (Kafka/RabbitMQ)', reduction: 26 },
  { pattern: /\bsap\s*(pp|qm|co|fi|sd|mm|hana)\b/i, name: 'Specific SAP Functional Module', reduction: 34 },
  { pattern: /\bsalesforce\s*cpq\b/i, name: 'Salesforce CPQ', reduction: 36 },
  { pattern: /\bguidewire\b/i, name: 'Guidewire PolicyCenter/ClaimCenter', reduction: 38 },
  { pattern: /\brust\b/i, name: 'Rust Systems Programming', reduction: 35 },
  { pattern: /\bgolang\b|\bgo\s+lang\b/i, name: 'Golang', reduction: 25 },
  { pattern: /\bpytorch\b|\btensorflow\b|\bdeep\s*learning\b/i, name: 'Deep Learning / ML Frameworks', reduction: 32 },
  { pattern: /\bblockchain\b|\bsolidity\b/i, name: 'Blockchain / Smart Contracts', reduction: 39 },
  { pattern: /\baws\b|\bamazon\s+web\s+services\b/i, name: 'AWS Cloud Infrastructure', reduction: 21 },
  { pattern: /\bazure\b|\bgcp\b|\bgoogle\s+cloud\b/i, name: 'Cloud Infrastructure (Azure/GCP)', reduction: 22 },
  { pattern: /\bmicroservices\b/i, name: 'Distributed Microservices Architecture', reduction: 19 },
  { pattern: /\bbanking\b|\bfintech\b|\bcapital\s+markets\b/i, name: 'Banking / Capital Markets Domain', reduction: 24 },
  { pattern: /\bhealthcare\b|\bhipaa\b/i, name: 'Healthcare / Regulatory Domain', reduction: 23 },
  { pattern: /\bspring\s*boot\b/i, name: 'Spring Boot Ecosystem', reduction: 16 }
];

/**
 * Evaluates a job requisition against market hiring feasibility
 */
export function analyzeHiringReality(input: HiringRealityInput): HiringRealityReport {
  const jobTitle = (input.jobTitle || 'Requisition').trim();
  const client = (input.client || 'Client Organization').trim();
  const location = (input.location || '').trim();
  const workMode = (input.workMode || 'Hybrid').trim();
  const salaryText = (input.salary || '').trim();
  const rawJd = `${jobTitle} ${input.jdText || ''} ${input.requirements?.map(r => r.requirement).join(' ') || ''}`.toLowerCase();

  const constraints: ConstraintImpact[] = [];

  // 1. Mandatory Skills Scarcity Detection
  const reqList = input.requirements || [];
  const mandatoryReqs = reqList.filter(r => Boolean(r.isMandatory || r.mandatory));

  // Detect specific niche/scarce skills in mandatory requirements or JD text
  const detectedNicheSet = new Set<string>();
  for (const niche of NICHE_SKILL_PATTERNS) {
    const isPresentInMandatory = mandatoryReqs.some(r => niche.pattern.test(r.requirement));
    const isPresentInJd = niche.pattern.test(rawJd);

    if (isPresentInMandatory || (mandatoryReqs.length === 0 && isPresentInJd)) {
      if (!detectedNicheSet.has(niche.name)) {
        detectedNicheSet.add(niche.name);
        constraints.push({
          id: `c-skill-${niche.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: `${niche.name} as Mandatory Requirement`,
          type: 'SKILL',
          severity: niche.reduction >= 30 ? 'HIGH' : 'MEDIUM',
          poolReductionPercent: niche.reduction,
          potentialGainPercent: niche.reduction,
          explanation: `Requiring verified ${niche.name} as an absolute non-negotiable filter eliminates ~${niche.reduction}% of candidates in this role family.`,
          suggestedRelaxation: `Shift ${niche.name} from Mandatory to Preferred, or accept candidate with strong adjacent skills and fast ramp-up.`
        });
      }
    }
  }

  // Mandatory Count Density Penalty (Unicorn JD constraint)
  if (mandatoryReqs.length >= 6) {
    const densityReduction = Math.min(42, 18 + (mandatoryReqs.length - 6) * 4);
    constraints.push({
      id: 'c-mandatory-density',
      name: `High Mandatory Requirements Count (${mandatoryReqs.length} rules)`,
      type: 'MANDATORY_DENSITY',
      severity: 'HIGH',
      poolReductionPercent: densityReduction,
      potentialGainPercent: Math.round(densityReduction * 0.9),
      explanation: `8+ mandatory requirements competing for the same candidate pool exponentially restricts intersection probability.`,
      suggestedRelaxation: `Prune mandatory criteria to top 3-4 dealbreakers; classify remaining as Secondary/Preferred.`
    });
  }

  // 2. Experience Threshold Constraint
  let expYears = input.minExperienceYears;
  if (!expYears) {
    const match = rawJd.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i);
    if (match) expYears = parseFloat(match[1]);
  }

  if (expYears && expYears >= 5) {
    const expReduction = expYears >= 10 ? 38 : expYears >= 8 ? 30 : expYears >= 6 ? 25 : 18;
    const expGain = Math.round(expReduction * 0.85);
    constraints.push({
      id: 'c-experience',
      name: `High Experience Threshold (${expYears}+ Years)`,
      type: 'EXPERIENCE',
      severity: expYears >= 8 ? 'HIGH' : 'MEDIUM',
      poolReductionPercent: expReduction,
      potentialGainPercent: expGain,
      explanation: `Demanding ${expYears}+ years filters out fast-track performers and creates intense competition with tech lead / principal brackets.`,
      suggestedRelaxation: `Calibrate required experience from ${expYears}+ years to ${Math.max(3, expYears - 2)}+ years with demonstrated skill proficiency.`
    });
  }

  // 3. Location & Workplace Type Constraint
  const isStrictOnsite = workMode.toLowerCase() === 'onsite' || workMode.toLowerCase() === 'on-site';
  const hasSpecificCity = location.length > 2 && !location.toLowerCase().includes('remote') && !location.toLowerCase().includes('any');

  if (isStrictOnsite && hasSpecificCity) {
    constraints.push({
      id: 'c-location',
      name: `Strict On-Site Attendance in ${location}`,
      type: 'LOCATION',
      severity: 'MEDIUM',
      poolReductionPercent: 22,
      potentialGainPercent: 18,
      explanation: `Strict 5-day on-site presence in ${location} eliminates regional relocators, remote talent, and hybrid commuters.`,
      suggestedRelaxation: `Offer Hybrid arrangement (e.g. 2-3 days remote) or expand to NCR / regional tech corridor.`
    });
  } else if (!isStrictOnsite && hasSpecificCity && !location.toLowerCase().includes('remote')) {
    constraints.push({
      id: 'c-location-hybrid',
      name: `Geographic Restriction (${location})`,
      type: 'LOCATION',
      severity: 'LOW',
      poolReductionPercent: 14,
      potentialGainPercent: 14,
      explanation: `Restricting exclusively to ${location} narrows the addressable pool compared to multi-hub or regional sourcing.`,
      suggestedRelaxation: `Consider candidates open to relocation or remote within standard timezone.`
    });
  }

  // 4. Notice Period Constraint
  const noticeMatch = rawJd.match(/(\d+)\s*(?:days?|day)\s*notice/i);
  let noticeDays = input.noticePeriodDays || (noticeMatch ? parseInt(noticeMatch[1], 10) : undefined);
  if (noticeDays && noticeDays <= 30) {
    constraints.push({
      id: 'c-notice',
      name: `Strict ${noticeDays}-Day Notice Period Requirement`,
      type: 'NOTICE_PERIOD',
      severity: 'HIGH',
      poolReductionPercent: 24,
      potentialGainPercent: 24,
      explanation: `Most high-performing professionals in this band are under 60-90 day contractual notice. A ${noticeDays}-day requirement eliminates ~80% of employed candidates.`,
      suggestedRelaxation: `Allow 60-day notice with buyout option or phased onboarding.`
    });
  }

  // 5. Salary Mismatch Constraint
  if (salaryText) {
    const lpaMatch = salaryText.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac)/i);
    if (lpaMatch && expYears) {
      const lpa = parseFloat(lpaMatch[1]);
      // Rough benchmark: ~2.5 - 3x experience years in tech
      const expectedMinLpa = expYears * 2.2;
      if (lpa < expectedMinLpa) {
        constraints.push({
          id: 'c-salary',
          name: `Below-Market Budget (₹${lpa} LPA for ${expYears}y exp)`,
          type: 'SALARY',
          severity: 'HIGH',
          poolReductionPercent: 32,
          potentialGainPercent: 30,
          explanation: `Offered compensation (₹${lpa} LPA) is below typical market brackets for ${expYears}+ years in ${jobTitle}.`,
          suggestedRelaxation: `Review budget upwards by 15-20% or calibrate seniority expectations.`
        });
      }
    }
  }

  // Fallback if no constraints detected
  if (constraints.length === 0) {
    constraints.push({
      id: 'c-baseline-skills',
      name: 'Standard Requisition Qualification Baseline',
      type: 'SKILL',
      severity: 'LOW',
      poolReductionPercent: 12,
      potentialGainPercent: 10,
      explanation: 'Requisition criteria are reasonably balanced for the target domain.',
      suggestedRelaxation: 'Maintain current hiring criteria and proceed with candidate sourcing.'
    });
  }

  // Deduplication & sorting by impact
  constraints.sort((a, b) => b.poolReductionPercent - a.poolReductionPercent);

  // Calculate Reality Score (100 minus cumulative weighted penalties)
  const totalDeductions = constraints.reduce((sum, c) => {
    const weight = c.severity === 'HIGH' ? 1.0 : c.severity === 'MEDIUM' ? 0.7 : 0.4;
    return sum + (c.poolReductionPercent * weight * 0.4);
  }, 0);

  const realityScore = Math.max(18, Math.min(95, Math.round(100 - totalDeductions)));

  // Difficulty classification
  let difficulty: RealityDifficulty = 'MODERATE';
  let difficultyLabel = 'Moderate Market Availability';
  let difficultyColor: 'green' | 'amber' | 'red' = 'amber';

  if (realityScore >= 75) {
    difficulty = 'REALISTIC';
    difficultyLabel = 'Realistic & Hireable';
    difficultyColor = 'green';
  } else if (realityScore <= 52) {
    difficulty = 'DIFFICULT';
    difficultyLabel = 'High Hiring Difficulty (Unicorn Constraints)';
    difficultyColor = 'red';
  }

  // Estimated Time-to-Hire in days
  const baseTimeToHire = difficulty === 'DIFFICULT' ? 65 : difficulty === 'MODERATE' ? 38 : 18;
  const optimizedTimeToHire = Math.max(14, Math.round(baseTimeToHire * 0.45));

  // Simulation of adjustments
  const activeAdjustments = new Set(input.activeAdjustments || []);
  let simulatedGain = 0;
  for (const c of constraints) {
    if (activeAdjustments.has(c.id)) {
      simulatedGain += c.potentialGainPercent;
    }
  }

  // Headline
  let summaryHeadline = '';
  let summaryDescription = '';
  if (difficulty === 'DIFFICULT') {
    summaryHeadline = `🔴 Role Stress Test: High Hiring Difficulty (${realityScore}/100)`;
    summaryDescription = `${constraints.length} competing mandatory constraints are narrowing the addressable talent pool. Roles with this profile typically experience 60+ day fill cycles.`;
  } else if (difficulty === 'MODERATE') {
    summaryHeadline = `🟡 Role Stress Test: Moderate Market Availability (${realityScore}/100)`;
    summaryDescription = `The position is hireable but contains 2-3 specific bottlenecks that will lengthen screening cycles unless proactively managed.`;
  } else {
    summaryHeadline = `🟢 Role Stress Test: Realistic & Well-Calibrated (${realityScore}/100)`;
    summaryDescription = `Requisition parameters are well aligned with market supply. Good candidate throughput expected.`;
  }

  // Recommendations
  const recommendations = constraints.slice(0, 4).map(c => ({
    title: c.suggestedRelaxation,
    impact: `+${c.potentialGainPercent}% available pool expansion`,
    gain: c.potentialGainPercent,
    actionableText: c.explanation
  }));

  // Generate Professional Client Advisory Note
  const topBottlenecks = constraints.slice(0, 3).map(c => `• ${c.name} (limits candidate pool by ~${c.poolReductionPercent}%)`).join('\n');
  const topSolutions = constraints.slice(0, 3).map(c => `• ${c.suggestedRelaxation} (+${c.potentialGainPercent}% pool gain)`).join('\n');
  const totalCombinedGain = constraints.slice(0, 3).reduce((acc, c) => acc + c.potentialGainPercent, 0);

  const clientAdvisoryNote = `Subject: Market Feasibility Analysis & Sourcing Recommendation — ${jobTitle} (${client})

Dear Hiring Manager / Team,

We have completed the pre-sourcing HireIQ Reality Analysis for the ${jobTitle} requisition.

Feasibility Assessment:
• Overall Hiring Reality Score: ${realityScore}/100 (${difficultyLabel})
• Estimated Baseline Time-to-Fill: ~${baseTimeToHire} days

Primary Market Bottlenecks Identified:
${topBottlenecks}

Recommended Calibrations:
${topSolutions}

Business Impact:
Implementing these calibrations widens the addressable candidate pool by approximately +${totalCombinedGain}%, accelerating submission velocity and reducing projected time-to-hire from ~${baseTimeToHire} days to ~${optimizedTimeToHire} days without compromising technical execution.

Please let us know if you approve these calibrations for the initial sourcing sprint.

Best regards,
Talent Acquisition Team
Powered by HireIQ Hiring Reality Engine™`;

  return {
    jobTitle,
    client,
    realityScore,
    difficulty,
    difficultyLabel,
    difficultyColor,
    summaryHeadline,
    summaryDescription,
    estimatedTimeToHireDays: baseTimeToHire,
    optimizedTimeToHireDays: optimizedTimeToHire,
    baselinePoolIndex: 100,
    simulatedPoolGainPercent: simulatedGain,
    constraints,
    recommendations,
    clientAdvisoryNote,
    evaluatedAt: new Date().toISOString()
  };
}

