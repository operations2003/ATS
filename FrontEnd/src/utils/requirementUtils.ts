export const SUPPORTED_CATEGORIES = [
  'Experience',
  'Technical Skill',
  'Functional Skill',
  'Technology',
  'Tool',
  'Education',
  'Certification',
  'Industry',
  'Language',
  'Other'
] as const;

export type SupportedCategory = typeof SUPPORTED_CATEGORIES[number];

/**
 * Validates if a string is one of the supported categories
 */
export const isValidCategory = (category: string): boolean => {
  if (!category || typeof category !== 'string') return false;
  return SUPPORTED_CATEGORIES.some(c => c.toLowerCase() === category.trim().toLowerCase());
};

/**
 * Normalizes a category string to the canonical SupportedCategory casing
 */
export const normalizeCategory = (category: string | null | undefined): SupportedCategory => {
  if (!category || typeof category !== 'string') return 'Other';
  const trimmed = category.trim().toLowerCase();
  
  // Mapping synonyms to supported categories
  if (trimmed.includes('exp')) return 'Experience';
  if (trimmed.includes('tech skill') || trimmed.includes('technical skill') || trimmed === 'technical') return 'Technical Skill';
  if (trimmed.includes('func skill') || trimmed.includes('functional skill') || trimmed === 'functional') return 'Functional Skill';
  if (trimmed.includes('tech') || trimmed.includes('technology')) return 'Technology';
  if (trimmed.includes('tool') || trimmed.includes('software')) return 'Tool';
  if (trimmed.includes('edu') || trimmed.includes('degree') || trimmed.includes('education')) return 'Education';
  if (trimmed.includes('certif')) return 'Certification';
  if (trimmed.includes('industr') || trimmed.includes('domain')) return 'Industry';
  if (trimmed.includes('lang')) return 'Language';

  const matched = SUPPORTED_CATEGORIES.find(c => c.toLowerCase() === trimmed);
  return matched || 'Other';
};

/**
 * Verifies if the source evidence string exists in the original JD text.
 * Returns true if evidence is found in raw JD text (normalizing whitespace/casing).
 */
export const verifyEvidenceInJd = (sourceEvidence: string | null | undefined, jdText: string | null | undefined): boolean => {
  if (!sourceEvidence || typeof sourceEvidence !== 'string' || !sourceEvidence.trim()) {
    return false;
  }
  if (!jdText || typeof jdText !== 'string' || !jdText.trim()) {
    return true; // If no JD text is provided, fallback to allow manually supplied sourceEvidence
  }

  const normJd = jdText.toLowerCase().replace(/\s+/g, ' ');
  const normEvidence = sourceEvidence.toLowerCase().replace(/\s+/g, ' ').trim();

  // If evidence substring or major token sequence is present in JD
  if (normJd.includes(normEvidence)) {
    return true;
  }

  // Check if at least 70% of significant words in sourceEvidence appear in JD text
  const evidenceWords = normEvidence.split(' ').filter(w => w.length > 3);
  if (evidenceWords.length === 0) return true;

  const matchedWords = evidenceWords.filter(w => normJd.includes(w));
  return (matchedWords.length / evidenceWords.length) >= 0.7;
};

/**
 * Classifies if a requirement text is Mandatory or Preferred based on explicit indicators.
 * If unclear, returns { isMandatory: false, needsVerification: true }.
 */
export const classifyRequirementMandatory = (text: string): { isMandatory: boolean; needsVerification: boolean } => {
  const lower = text.toLowerCase();

  const mandatoryKeywords = [
    'required',
    'mandatory',
    'must have',
    'essential',
    'minimum',
    'candidate must have',
    'must possess',
    'must be'
  ];

  const preferredKeywords = [
    'preferred',
    'nice to have',
    'desirable',
    'advantage',
    'plus',
    'beneficial',
    'optional'
  ];

  const hasMandatoryIndicator = mandatoryKeywords.some(kw => lower.includes(kw));
  const hasPreferredIndicator = preferredKeywords.some(kw => lower.includes(kw));

  if (hasMandatoryIndicator && !hasPreferredIndicator) {
    return { isMandatory: true, needsVerification: false };
  }

  if (hasPreferredIndicator && !hasMandatoryIndicator) {
    return { isMandatory: false, needsVerification: false };
  }

  // If unclear, default to isMandatory = false and flag needsVerification = true
  return { isMandatory: false, needsVerification: true };
};

/**
 * Detects obvious or potential duplicate requirements in a list.
 * Returns array of warning messages describing potential duplicates.
 */
export const detectDuplicateRequirements = (requirements: Array<{ id?: string; requirement: string }>): string[] => {
  const warnings: string[] = [];
  if (!requirements || requirements.length < 2) return warnings;

  // Helper to get normalized word token set
  const getTokens = (str: string) => {
    return new Set(
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !['and', 'for', 'with', 'the', 'in', 'of', 'to'].includes(w))
    );
  };

  for (let i = 0; i < requirements.length; i++) {
    for (let j = i + 1; j < requirements.length; j++) {
      const reqA = requirements[i].requirement.trim();
      const reqB = requirements[j].requirement.trim();

      if (reqA.toLowerCase() === reqB.toLowerCase()) {
        warnings.push(`Exact duplicate detected: "${reqA}"`);
        continue;
      }

      const tokensA = getTokens(reqA);
      const tokensB = getTokens(reqB);

      if (tokensA.size === 0 || tokensB.size === 0) continue;

      let intersectionCount = 0;
      tokensA.forEach(t => {
        if (tokensB.has(t)) intersectionCount++;
      });

      const similarityA = intersectionCount / tokensA.size;
      const similarityB = intersectionCount / tokensB.size;

      if (similarityA >= 0.8 && similarityB >= 0.8) {
        warnings.push(`Potential duplicate detected between "${reqA}" and "${reqB}"`);
      }
    }
  }

  return Array.from(new Set(warnings));
};

/**
 * Formats a Prisma requirement record to match API response schema (Section 4)
 */
export const formatRequirementObject = (req: any) => {
  return {
    id: req.id,
    jobId: req.job_id || req.jobId,
    requirement: req.requirement,
    category: normalizeCategory(req.category),
    weight: typeof req.weight === 'number' ? req.weight : 1.0,
    isMandatory: Boolean(req.is_mandatory ?? req.isMandatory),
    evidenceRequired: Boolean(req.evidence_required ?? req.evidenceRequired),
    recruiterConfirmed: Boolean(req.recruiter_confirmed ?? req.recruiterConfirmed),
    sourceEvidence: req.source_evidence || req.sourceEvidence || req.requirement,
    needsVerification: Boolean(req.needs_verification ?? req.needsVerification),
    createdAt: req.created_at || req.createdAt,
    updatedAt: req.updated_at || req.updatedAt
  };
};

// ── COMPREHENSIVE MATCH SCORE ENGINE ──────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
  'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
  'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
  'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
  'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

export interface MatchScoreBreakdown {
  skills: {
    score: number;
    weight: 40;
    matchedSkills: string[];
    missingSkills: string[];
  };
  experience: {
    score: number;
    weight: 30;
    candidateYears: number;
    requiredYears: number;
  };
  education: {
    score: number;
    weight: 15;
    candidateDegrees: string[];
    requiredDegrees: string[];
  };
  keywords: {
    score: number;
    weight: 15;
    cosineSimilarity: number;
    topMatchedTerms: string[];
  };
}

export interface ComprehensiveMatchResult {
  overallScore: number; // 0 - 100
  matchLevel: 'STRONG MATCH' | 'GOOD MATCH' | 'MODERATE MATCH' | 'LOW FIT';
  breakdown: MatchScoreBreakdown;
  summary: string;
}

/**
 * 1. Skills Match Score (Weight ~40%)
 */
export const calculateSkillsScore = (
  candidateSkills: string[] = [],
  requiredSkills: string[] = []
): { score: number; matchedSkills: string[]; missingSkills: string[] } => {
  const normCand = candidateSkills.map(s => s.trim().toLowerCase());
  const normReq = requiredSkills.map(s => s.trim().toLowerCase()).filter(Boolean);

  if (normReq.length === 0) {
    // If no explicit JD skills required, evaluate based on candidate skill breadth (up to 90)
    const baseScore = Math.min(95, Math.max(60, candidateSkills.length * 12));
    return {
      score: baseScore,
      matchedSkills: candidateSkills,
      missingSkills: []
    };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  requiredSkills.forEach(reqSkill => {
    const rLower = reqSkill.trim().toLowerCase();
    const isMatched = normCand.some(c => c === rLower || c.includes(rLower) || rLower.includes(c));
    if (isMatched) {
      matched.push(reqSkill);
    } else {
      missing.push(reqSkill);
    }
  });

  const matchRatio = matched.length / normReq.length;
  // Base score from required matches + bonus for extra candidate tech skills
  const bonus = Math.min(15, (candidateSkills.length - matched.length) * 1.5);
  const score = Math.min(100, Math.round(matchRatio * 85 + (bonus > 0 ? bonus : 0)));

  return {
    score,
    matchedSkills: matched,
    missingSkills: missing
  };
};

/**
 * 2. Experience Match Score (Weight ~30%)
 */
export const parseExperienceYearsNumber = (exp: string | number | null | undefined): number => {
  if (typeof exp === 'number') return exp;
  if (!exp) return 0;
  const str = String(exp).toLowerCase().trim();

  // Pattern: "X years Y months" or "X.Y years"
  const yrMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
  const moMatch = str.match(/(\d+)\s*(?:months?|mos?)/i);

  let total = 0;
  if (yrMatch) total += parseFloat(yrMatch[1]);
  if (moMatch) total += parseInt(moMatch[1], 10) / 12;

  if (total > 0) return parseFloat(total.toFixed(1));

  // Fallback pattern: standalone number
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  return numMatch ? parseFloat(numMatch[1]) : 0;
};

export const calculateExperienceScore = (
  candidateExp: string | number | null | undefined,
  requiredExp: string | number | null | undefined
): { score: number; candidateYears: number; requiredYears: number } => {
  const candidateYears = parseExperienceYearsNumber(candidateExp);
  const requiredYears = parseExperienceYearsNumber(requiredExp) || 3.0; // Default 3 years if unspecified

  if (requiredYears <= 0) {
    return { score: 100, candidateYears, requiredYears: 0 };
  }

  if (candidateYears >= requiredYears) {
    return { score: 100, candidateYears, requiredYears };
  }

  const score = Math.min(100, Math.max(10, Math.round((candidateYears / requiredYears) * 100)));
  return { score, candidateYears, requiredYears };
};

/**
 * 3. Education Match Score (Weight ~15%)
 */
const DEGREE_TIERS: Record<string, number> = {
  phd: 4,
  doctorate: 4,
  master: 3,
  ms: 3,
  mtech: 3,
  mba: 3,
  mca: 3,
  bachelor: 2,
  be: 2,
  btech: 2,
  bs: 2,
  bsc: 2,
  bca: 2,
  diploma: 1,
  associate: 1,
};

export const calculateEducationScore = (
  candidateEdu: any[] = [],
  requiredEdu: string | string[] = []
): { score: number; candidateDegrees: string[]; requiredDegrees: string[] } => {
  const candDegrees = candidateEdu.map(e => (typeof e === 'string' ? e : e.degree || '')).filter(Boolean);
  const reqDegrees = Array.isArray(requiredEdu) ? requiredEdu : [requiredEdu].filter(Boolean);

  let maxCandTier = 1;
  for (const deg of candDegrees) {
    const dLower = deg.toLowerCase().replace(/[^a-z]/g, '');
    for (const [key, tier] of Object.entries(DEGREE_TIERS)) {
      if (dLower.includes(key) && tier > maxCandTier) {
        maxCandTier = tier;
      }
    }
  }

  let reqTier = 2; // Default Bachelor's required
  if (reqDegrees.length > 0) {
    for (const req of reqDegrees) {
      const rLower = req.toLowerCase().replace(/[^a-z]/g, '');
      for (const [key, tier] of Object.entries(DEGREE_TIERS)) {
        if (rLower.includes(key)) {
          reqTier = Math.max(reqTier, tier);
        }
      }
    }
  }

  let score = 75;
  if (maxCandTier >= reqTier) {
    score = 100;
  } else if (maxCandTier === reqTier - 1) {
    score = 80;
  } else {
    score = 60;
  }

  if (candDegrees.length === 0) score = 65;

  return {
    score,
    candidateDegrees: candDegrees.length > 0 ? candDegrees : ['Degree Listed in Profile'],
    requiredDegrees: reqDegrees.length > 0 ? reqDegrees : ['Bachelor\'s Degree in relevant field']
  };
};

/**
 * 4. Keyword Cosine Similarity & Semantic Overlap Score (Weight ~15%)
 */
export const calculateCosineSimilarity = (
  text1: string = '',
  text2: string = ''
): { cosine: number; topMatchedTerms: string[] } => {
  const tokenize = (text: string): Map<string, number> => {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    const freqMap = new Map<string, number>();
    for (const w of words) {
      freqMap.set(w, (freqMap.get(w) || 0) + 1);
    }
    return freqMap;
  };

  const map1 = tokenize(text1);
  const map2 = tokenize(text2);

  if (map1.size === 0 || map2.size === 0) {
    return { cosine: 0.5, topMatchedTerms: [] };
  }

  let dotProduct = 0;
  const matchedTerms: string[] = [];

  for (const [term, count1] of map1.entries()) {
    if (map2.has(term)) {
      const count2 = map2.get(term)!;
      dotProduct += count1 * count2;
      matchedTerms.push(term);
    }
  }

  let mag1 = 0;
  for (const count of map1.values()) mag1 += count * count;

  let mag2 = 0;
  for (const count of map2.values()) mag2 += count * count;

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  const cosine = magnitude > 0 ? dotProduct / magnitude : 0;

  return {
    cosine: Math.min(1.0, parseFloat(cosine.toFixed(4))),
    topMatchedTerms: matchedTerms.slice(0, 10)
  };
};

export const calculateKeywordOverlapScore = (
  candidateText: string = '',
  jdText: string = ''
): { score: number; cosineSimilarity: number; topMatchedTerms: string[] } => {
  const { cosine, topMatchedTerms } = calculateCosineSimilarity(candidateText, jdText);

  // Resume/JD cosine similarity typically ranges from 0.15 to 0.70; scale naturally to 0-100
  const scaledScore = Math.min(100, Math.max(30, Math.round(cosine * 140)));

  return {
    score: scaledScore,
    cosineSimilarity: cosine,
    topMatchedTerms
  };
};

export interface MatchScoreBreakdown {
  mandatoryCompliance?: {
    score: number;
    weight: 30;
    passed: boolean;
    failedCount: number;
  };
  technicalSkills?: {
    score: number;
    weight: 25;
    matchedSkills: string[];
    missingSkills: string[];
  };
  relevantExperience?: {
    score: number;
    weight: 20;
    candidateYears: number;
    requiredYears: number;
  };
  responsibilities?: {
    score: number;
    weight: 10;
  };
  domainFit?: {
    score: number;
    weight: 5;
  };
  skills: {
    score: number;
    weight: 40;
    matchedSkills: string[];
    missingSkills: string[];
  };
  experience: {
    score: number;
    weight: 30;
    candidateYears: number;
    requiredYears: number;
  };
  education: {
    score: number;
    weight: 15;
    candidateDegrees: string[];
    requiredDegrees: string[];
  };
  keywords: {
    score: number;
    weight: 15;
    cosineSimilarity: number;
    topMatchedTerms: string[];
  };
}

export interface ComprehensiveMatchResult {
  overallScore: number; // 0 - 100
  matchLevel: 'STRONG MATCH' | 'GOOD MATCH' | 'MODERATE MATCH' | 'LOW FIT';
  mandatoryRequirementFailed: boolean;
  breakdown: MatchScoreBreakdown;
  summary: string;
}

/**
 * Detect junk / non-requirement sentences (recruiter commercials, company blurbs, exclusions, perks)
 */
export const isJunkRequirement = (text: string): boolean => {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (t.length < 5) return true;

  // 1. Recruiter billing, commission, CTC, agency commercials
  if (/(?:fixed\s+ctc|freelance\s+recruiter|total\s+billing|billing\s+payables?|replacement\s+guarantee|placement\s+fee|incentive\s*[-:]|recruiter\s+margin|invoice\s+submission|payment\s+terms|commercials)/i.test(t)) {
    return true;
  }

  // 2. Company pitch, marketing, background blurbs
  if (/(?:bootstrapped\s+company|customers?\s+in\s+\d+\s+countries|chance\s+to\s+build\s+the\s+sales\s+motion|we(?:'re|\s+are)\s+looking\s+for\s+someone\s+climbing|founded\s+in\s+\d+|our\s+mission\s+is|about\s+(?:the\s+)?company|why\s+join\s+us|a\s+profitable\s+bootstrapped)/i.test(t)) {
    return true;
  }

  // 3. Exclusions / negative requirements ("What we're not asking for", "An MBA. Five-plus years...")
  if (/(?:what\s+we(?:'re|\s+are)\s+not\s+asking|not\s+asking\s+for|what\s+you\s+don't\s+need|who\s+this\s+is\s+not\s+for|an\s+mba\.?\s+five-plus\s+years|big-logo\s+cv|don't\s+apply\s+if)/i.test(t)) {
    return true;
  }

  // 4. Perks, benefits, compensation packages
  if (/(?:what\s+you\s+get|what\s+we\s+offer|perks\s+and\s+benefits|health\s+insurance|unlimited\s+pto|esops?|equity\s+grant|gym\s+membership|free\s+lunch)/i.test(t)) {
    return true;
  }

  return false;
};

/**
 * Safely tests if needle appears as a distinct word/token inside haystack.
 * Automatically cleans special characters and wraps in try-catch to prevent any RegExp runtime errors.
 */
export const safeWordMatch = (needle: string, haystack: string): boolean => {
  if (!needle || !haystack) return false;
  // Clean needle to strip leading/trailing non-alphanumeric punctuation
  const cleanNeedle = needle.toLowerCase().replace(/^[^a-zA-Z0-9+#.-]+|[^a-zA-Z0-9+#.-]+$/g, '').trim();
  if (cleanNeedle.length < 2) return false;

  try {
    const escaped = cleanNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`(?:^|[^a-zA-Z0-9+#.-])${escaped}(?:$|[^a-zA-Z0-9+#.-])`, 'i');
    return rx.test(haystack);
  } catch {
    return haystack.toLowerCase().includes(cleanNeedle);
  }
};

export const computeComprehensiveMatchScore = (
  candidate: {
    skills: string[];
    totalExperience?: string | number;
    totalExperienceYears?: number;
    education?: { degree?: string; field?: string; institution?: string }[];
    rawText?: string;
    summary?: string;
    currentTitle?: string;
  },
  job: {
    position: string;
    jd_text?: string;
    requirements?: {
      id?: string;
      requirement?: string;
      category?: string;
      is_mandatory?: boolean;
      weight?: number;
    }[];
  }
): {
  overallScore: number;
  matchLevel: 'STRONG MATCH' | 'GOOD MATCH' | 'MODERATE MATCH' | 'LOW FIT';
  mandatoryRequirementFailed: boolean;
  breakdown: MatchScoreBreakdown;
  summary: string;
} => {
  const rawText = candidate.rawText || '';
  const jdFullText = job.jd_text || job.position || '';
  const candSkills = (candidate.skills || []).map(s => (s || '').toLowerCase().trim()).filter(Boolean);

  // Parse candidate career years
  let totalCareerYears = 0;
  if (typeof candidate.totalExperienceYears === 'number' && !isNaN(candidate.totalExperienceYears)) {
    totalCareerYears = candidate.totalExperienceYears;
  } else if (candidate.totalExperience) {
    const parsed = parseFloat(String(candidate.totalExperience).replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed)) totalCareerYears = parsed;
  }

  // Filter out junk / commercial / exclusion requirements from evaluation
  const rawRequirements = (job.requirements && job.requirements.length > 0) ? job.requirements : [];
  const requirements = rawRequirements.filter(r => r.requirement && !isJunkRequirement(r.requirement));

  let mandatoryRequirementFailed = false;
  let mandatoryCount = 0;
  let mandatoryMetCount = 0;

  let totalTechWeight = 0;
  let earnedTechWeight = 0;

  let totalExpWeight = 0;
  let earnedExpWeight = 0;

  const matchedSkillsList: string[] = [];
  const missingSkillsList: string[] = [];

  // Evaluate requirements deterministically
  for (const req of requirements) {
    const reqText = req.requirement || '';
    const reqCategory = (req.category || '').toLowerCase();
    const isMandatory = Boolean(req.is_mandatory);
    const weight = typeof req.weight === 'number' && req.weight > 0 ? req.weight : 1.0;
    const reqLower = reqText.toLowerCase();

    if (isMandatory) mandatoryCount++;

    // 1. Experience Requirements
    const yearsPattern = reqLower.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i);
    if (yearsPattern || reqCategory.includes('exp') || reqLower.includes('experience')) {
      const requiredYears = yearsPattern ? parseFloat(yearsPattern[1]) : 3.0;

      // Extract domain keywords from experience requirement
      const expKeywords = reqLower
        .replace(/(\d+\+?\s*years?|experience|minimum|required|hands-on|relevant|professional|industry|proven|in|with|of|for|and|to)/gi, ' ')
        .split(/[\s,;/]+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length > 3 && !['years', 'year', 'work', 'role', 'team', 'candidate', 'ability'].includes(w));

      let domainMatch = true;
      if (expKeywords.length > 0) {
        domainMatch = expKeywords.some(kw =>
          candSkills.some(s => s === kw || s.includes(kw)) ||
          safeWordMatch(kw, rawText)
        );
      }

      const candidateRelevantExp = domainMatch ? totalCareerYears : (totalCareerYears > 0 ? totalCareerYears * 0.5 : 0);
      totalExpWeight += weight;

      if (candidateRelevantExp >= requiredYears) {
        earnedExpWeight += (1.0 * weight);
        if (isMandatory) mandatoryMetCount++;
      } else if (candidateRelevantExp >= requiredYears * 0.75) {
        earnedExpWeight += (0.7 * weight);
        if (isMandatory) mandatoryMetCount++;
      } else {
        // Severe experience deficiency (e.g. 0.4y vs 3y required) -> Earn 0 points and fail mandatory
        earnedExpWeight += 0;
        if (isMandatory || requiredYears >= 2.0) {
          mandatoryRequirementFailed = true;
        }
      }
      continue;
    }

    // 2. Technical Skills & Tools Requirements
    if (
      reqCategory.includes('skill') ||
      reqCategory.includes('tech') ||
      reqCategory.includes('tool') ||
      reqCategory.includes('certif') ||
      reqCategory.includes('function')
    ) {
      const cleanTech = reqText
        .replace(/(proficient|proficiency|experience|hands-on|strong|deep|knowledge|architectural|familiarity|with|in|and|of|for|to)/gi, ' ')
        .trim();
      const techTokens = cleanTech
        .split(/[,/&+\n]+/)
        .map(t => t.trim().toLowerCase().replace(/^[^a-zA-Z0-9+#.-]+|[^a-zA-Z0-9+#.-]+$/g, ''))
        .filter(t => t.length >= 3 && !['years', 'tools', 'skills', 'good', 'must', 'work', 'high', 'level'].includes(t));

      totalTechWeight += weight;

      // Strict skill matching: Exact skill match, or token match against extracted candidate skills, or safe word boundary in raw text
      const isMatched = candSkills.some(s => {
        if (!s || s.length < 2) return false;
        return (
          reqLower === s ||
          safeWordMatch(s, reqLower) ||
          techTokens.some(tok => tok === s)
        );
      }) || techTokens.some(tok => {
        if (!tok || tok.length < 3) return false;
        return (
          candSkills.includes(tok) ||
          safeWordMatch(tok, rawText)
        );
      });

      if (isMatched) {
        matchedSkillsList.push(reqText);
        earnedTechWeight += (1.0 * weight);
        if (isMandatory) mandatoryMetCount++;
      } else {
        missingSkillsList.push(reqText);
        if (isMandatory) mandatoryRequirementFailed = true;
      }
    }
  }

  // 1. Mandatory Compliance Score (30%)
  let mandatoryScore = 100;
  if (mandatoryCount > 0) {
    mandatoryScore = Math.round((mandatoryMetCount / mandatoryCount) * 100);
  }

  // 2. Technical Skills Score (25%)
  let techScore = 0;
  if (totalTechWeight > 0) {
    techScore = Math.round((earnedTechWeight / totalTechWeight) * 100);
  } else if (requirements.length === 0) {
    // Fallback only if no requirements at all: check match with JD keywords
    techScore = 50;
  }

  // 3. Relevant Experience Score (20%)
  let expScore = 0;
  if (totalExpWeight > 0) {
    expScore = Math.round((earnedExpWeight / totalExpWeight) * 100);
  } else {
    expScore = Math.min(100, Math.round(totalCareerYears * 20));
  }

  // 4. Education & Certifications Score (5%)
  const eduScore = calculateEducationScore(candidate.education || [], ['Bachelor']).score;

  // 5. Semantic / Keyword Score (5%)
  const keywordsResult = calculateKeywordOverlapScore(rawText, jdFullText);
  const semanticScore = keywordsResult.score;

  // 6. Domain & Role Fit Alignment (Check if role matches, e.g. Software Engineer vs Sales)
  const jobTitleLower = (job.position || '').toLowerCase();
  const candTitleLower = (candidate.currentTitle || '').toLowerCase();
  const isSalesJob = /\b(sales|account\s+executive|business\s+development|bdr|sdr|revops|account\s+manager)\b/i.test(jobTitleLower);
  const isEngCandidate = /\b(software|developer|engineer|full\s*stack|frontend|backend|programmer|web\s+developer)\b/i.test(candTitleLower) ||
                         candSkills.some(s => ['react', 'javascript', 'typescript', 'node.js', 'html', 'css', 'python', 'java'].includes(s));
  const hasSalesSkills = candSkills.some(s => ['sales', 'b2b', 'crm', 'pipeline', 'cold calling', 'account executive', 'lead generation'].includes(s));

  let domainScore = 80;
  let respScore = 80;

  if (isSalesJob && isEngCandidate && !hasSalesSkills) {
    // Severe role mismatch: Software engineer applying to Sales AE job
    domainScore = 10;
    respScore = 10;
    mandatoryRequirementFailed = true;
  }

  // 7-Pillar Composite Calculation (Task 5 Architecture)
  const weightedTotal =
    (mandatoryScore * 0.30) +
    (techScore * 0.25) +
    (expScore * 0.20) +
    (respScore * 0.10) +
    (eduScore * 0.05) +
    (semanticScore * 0.05) +
    (domainScore * 0.05);

  let overallScore = Math.min(100, Math.max(0, Math.round(weightedTotal)));

  let matchLevel: 'STRONG MATCH' | 'GOOD MATCH' | 'MODERATE MATCH' | 'LOW FIT' = 'MODERATE MATCH';
  if (overallScore >= 70 && !mandatoryRequirementFailed) matchLevel = 'STRONG MATCH';
  else if (overallScore >= 55) matchLevel = 'GOOD MATCH';
  else if (overallScore >= 45) matchLevel = 'MODERATE MATCH';
  else matchLevel = 'LOW FIT';

  const breakdown: MatchScoreBreakdown = {
    mandatoryCompliance: {
      score: mandatoryScore,
      weight: 30,
      passed: !mandatoryRequirementFailed,
      failedCount: mandatoryCount - mandatoryMetCount
    },
    technicalSkills: {
      score: techScore,
      weight: 25,
      matchedSkills: matchedSkillsList,
      missingSkills: missingSkillsList
    },
    relevantExperience: {
      score: expScore,
      weight: 20,
      candidateYears: totalCareerYears,
      requiredYears: 3.0
    },
    responsibilities: {
      score: respScore,
      weight: 10
    },
    domainFit: {
      score: domainScore,
      weight: 5
    },
    skills: {
      score: techScore,
      weight: 40,
      matchedSkills: matchedSkillsList,
      missingSkills: missingSkillsList,
    },
    experience: {
      score: expScore,
      weight: 30,
      candidateYears: totalCareerYears,
      requiredYears: 3.0,
    },
    education: {
      score: eduScore,
      weight: 15,
      candidateDegrees: (candidate.education || []).map(e => e.degree || 'Degree'),
      requiredDegrees: ["Bachelor's Degree"],
    },
    keywords: {
      score: semanticScore,
      weight: 15,
      cosineSimilarity: keywordsResult.cosineSimilarity,
      topMatchedTerms: keywordsResult.topMatchedTerms,
    },
  };

  const summary = `${matchLevel} (${overallScore}% overall). Mandatory compliance: ${mandatoryScore}%, Skills match: ${techScore}%, Experience: ${totalCareerYears}y (${expScore}%).`;

  return {
    overallScore,
    matchLevel,
    mandatoryRequirementFailed,
    breakdown,
    summary,
  };
};
