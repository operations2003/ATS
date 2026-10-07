import prisma from '../config/prisma';
import { CandidateRecord } from '../controllers/candidateController';
import {
  MatchStatus,
  EvidenceConfidence,
  MatchTier,
  MandatoryFailureDetail,
  PillarScores
} from './atsScoringEngine';
import {
  calculateCentralizedATSScore,
  CENTRALIZED_ATS_SCORING_VERSION
} from './centralizedATSScoringService';

export type EvaluationStatus =
  | 'MATCHED'
  | 'PARTIAL'
  | 'NOT_MATCHED'
  | 'UNKNOWN'
  | 'FULLY MET'
  | 'PARTIALLY MET'
  | 'NOT MET'
  | 'NOT FOUND';

export interface RequirementEvaluationResult {
  id: string;
  requirement: string;
  category: string;
  mandatory: boolean;
  isMandatory: boolean;
  evidence: string;
  candidateEvidence: string;
  evidenceSource: string;
  status: MatchStatus;
  confidence: 'High' | 'Medium' | 'Low';
  weight: number;
  score: number;
  failureReason?: string;
  verificationNote?: string;
  evidenceType?: EvidenceConfidence;
  // Controlled AI Fields
  aiMatchState?: 'MATCH' | 'NO_MATCH' | 'UNCERTAIN';
  aiEvidence?: string;
  aiConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  aiMatchType?: string;
  isInferred?: boolean;
  sourceEvidence?: string;
}

export interface CandidateEvaluationPayload {
  evaluationId?: string;
  candidateId: string;
  candidateName: string;
  candidateRole: string;
  candidateCompany: string;
  candidateEmail: string;
  candidatePhone: string;
  candidateLocation: string;
  jobId: string;
  jobTitle: string;
  jobClient: string;
  rawScore?: number;
  baseDeterministicScore?: number;
  aiSemanticAdjustment?: number;
  aiAssistanceEnabled?: boolean;
  inferredRequirementsCount?: number;
  overallMatch: number;
  atsScore: number;
  overallScore: number;
  matchLevel: MatchTier;
  mandatoryRequirementFailed: boolean;
  mandatoryComplianceScore: number;
  mandatoryFailures: MandatoryFailureDetail[];
  mandatoryCompliance: {
    total: number;
    met: number;
    failed: number;
    passed: boolean;
  };
  recommendation: 'SUBMIT' | 'REVIEW' | 'DO NOT SUBMIT';
  recommendationReason: string;
  pillarScores: PillarScores;
  pillars: PillarScores;
  scoreBreakdown: {
    mandatory: { score: number; max: number; pct: number; label: string };
    skills: { score: number; max: number; pct: number; label: string };
    experience: { score: number; max: number; pct: number; label: string };
    responsibilities: { score: number; max: number; pct: number; label: string };
    preferred: { score: number; max: number; pct: number; label: string };
  };
  summaryCounts: {
    mandatoryTotal: number;
    preferredTotal: number;
    matched: number;
    partial: number;
    notMatched: number;
    unknown: number;
    // Compatibility fields
    fullyMet: number;
    partiallyMet: number;
    notMet: number;
    needsVerification: number;
    notFound: number;
  };
  requirements: RequirementEvaluationResult[];
  requirementResults: RequirementEvaluationResult[];
  explanation: {
    summary: string;
    strengths: string[];
    gaps: string[];
    mandatoryStatus: string;
  };
  strengths: string[];
  gaps: string[];
  warnings: string[];
  scoringConfigVersion: string;
  evaluatedAt: string;
  evaluator: string;
}

const getPythonServiceUrls = (): string[] => {
  const configured = (process.env.DOCUMENT_PROCESSOR_URL || '').trim().replace(/\/+$/, '');
  const remote = (process.env.REMOTE_DOCUMENT_PROCESSOR_URL || '').trim().replace(/\/+$/, '');
  const isProd = process.env.NODE_ENV === 'production';
  const local = 'http://127.0.0.1:8000';
  const urls: string[] = [];
  if (configured) urls.push(configured);
  if (remote && !urls.includes(remote)) urls.push(remote);
  if (!isProd && !urls.includes(local)) urls.push(local);
  return urls;
};

const EVAL_TIMEOUT_MS = parseInt(process.env.PYTHON_EVAL_TIMEOUT_MS || process.env.PYTHON_TIMEOUT_MS || '15000', 10);

let lastEvaluationHealthCheck = 0;
let evaluationServiceHealthyUrl: string | null = null;

async function getHealthyEvaluationServiceUrl(): Promise<string | null> {
  const now = Date.now();
  const cacheDuration = evaluationServiceHealthyUrl ? 30000 : 5000;
  if (now - lastEvaluationHealthCheck < cacheDuration) {
    return evaluationServiceHealthyUrl;
  }
  const urls = getPythonServiceUrls();
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/health`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);
      if (res && res.ok) {
        evaluationServiceHealthyUrl = url;
        lastEvaluationHealthCheck = now;
        return url;
      }
    } catch {}
  }
  evaluationServiceHealthyUrl = null;
  lastEvaluationHealthCheck = now;
  return null;
}

/**
 * Evaluates a single candidate against a job's confirmed requirements
 * Prioritizes Local Free AI Semantic Matching (all-MiniLM-L6-v2) with robust fallback
 */
export async function evaluateCandidateAgainstRequirements(
  candidate: CandidateRecord,
  job: { id: string; position?: string; title?: string; client?: string; company?: string; jd_text?: string; normalized_jd?: any },
  requirements: Array<{
    id: string;
    requirement: string;
    category?: string | null;
    weight?: number;
    is_mandatory?: boolean;
    isMandatory?: boolean;
    needs_verification?: boolean;
    source_evidence?: string | null;
    aliases?: string[];
    context?: string | null;
  }>
): Promise<CandidateEvaluationPayload> {
  // Enrich requirements with aliases from job.normalized_jd if present
  const aliasLookup = new Map<string, string[]>();
  if (job.normalized_jd) {
    const allNormReqs = [
      ...(job.normalized_jd.mandatory_requirements || []),
      ...(job.normalized_jd.preferred_requirements || [])
    ];
    for (const nr of allNormReqs) {
      if (nr.name && Array.isArray(nr.aliases) && nr.aliases.length > 0) {
        aliasLookup.set(nr.name.toLowerCase().trim(), nr.aliases);
      }
    }
  }

  const enrichedRequirements = requirements.map(r => {
    const reqLower = r.requirement.toLowerCase();
    let aliases = r.aliases || [];
    if (aliases.length === 0) {
      for (const [name, aList] of aliasLookup.entries()) {
        if (reqLower.includes(name) || name.includes(reqLower)) {
          aliases = aList;
          break;
        }
      }
    }
    return {
      ...r,
      aliases
    };
  });

  // 1. Attempt AI-Powered Semantic Evidence Extraction via Python Service if available
  let aiSemanticEvidence: any[] | undefined = undefined;
  let evaluator = 'TaskNera Centralized Deterministic ATS Engine v6.0.0';
  const serviceUrl = await getHealthyEvaluationServiceUrl();

  if (serviceUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), EVAL_TIMEOUT_MS);

      const response = await fetch(`${serviceUrl}/evaluate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate,
          job,
          requirements: enrichedRequirements
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const aiResult: any = await response.json();
        if (aiResult && Array.isArray(aiResult.requirements)) {
          aiSemanticEvidence = aiResult.requirements;
          evaluator = 'TaskNera Semantic AI Engine (all-MiniLM-L6-v2) + Central ATS Engine v6.0.0';
        }
      }
    } catch (err: any) {
      console.warn(`[EvaluationService] Python semantic service (${serviceUrl}) unavailable:`, err.message);
    }
  }

  // 2. Authoritative Centralized Deterministic ATS Scoring Engine (Single Source of Truth v6.0.0)
  const centralResult = calculateCentralizedATSScore({
    candidate,
    job: {
      id: job.id,
      position: job.position || job.title,
      title: job.position || job.title,
      client: job.client || job.company,
      company: job.client || job.company,
      jd_text: job.jd_text,
      normalized_jd: job.normalized_jd
    },
    requirements: enrichedRequirements as any,
    semanticEvidence: aiSemanticEvidence
  });

  const mappedReqs: RequirementEvaluationResult[] = centralResult.requirements.map(r => ({
    id: r.id,
    requirement: r.requirement,
    category: r.category,
    mandatory: r.mandatory,
    isMandatory: r.mandatory,
    evidence: r.candidateEvidence || r.evidence || '',
    candidateEvidence: r.candidateEvidence || r.evidence || '',
    evidenceSource: r.evidenceSource || 'Centralized ATS Evaluation',
    status: r.status,
    confidence: r.confidence || 'High',
    weight: r.weight,
    score: r.score,
    failureReason: r.failureReason,
    evidenceType: r.evidenceType
  }));

  const finalScore = centralResult.atsScore;

  return {
    evaluationId: centralResult.evaluationId,
    candidateId: candidate.id,
    candidateName: candidate.name || 'Candidate',
    candidateRole: candidate.currentTitle || job.position || job.title || 'Professional',
    candidateCompany: candidate.currentCompany || 'Organization',
    candidateEmail: candidate.email || '',
    candidatePhone: candidate.phone || '',
    candidateLocation: candidate.location || '',
    jobId: job.id,
    jobTitle: job.position || job.title || 'Job Position',
    jobClient: job.client || job.company || 'Client',
    rawScore: centralResult.rawScore,
    baseDeterministicScore: finalScore,
    aiSemanticAdjustment: 0.0,
    aiAssistanceEnabled: Boolean(aiSemanticEvidence && aiSemanticEvidence.length > 0),
    inferredRequirementsCount: 0,
    overallMatch: finalScore,
    atsScore: finalScore,
    overallScore: finalScore,
    matchLevel: centralResult.matchLevel,
    mandatoryRequirementFailed: centralResult.mandatoryRequirementFailed,
    mandatoryComplianceScore: centralResult.mandatoryComplianceScore,
    mandatoryFailures: centralResult.mandatoryFailures,
    mandatoryCompliance: centralResult.mandatoryCompliance,
    recommendation: centralResult.recommendation,
    recommendationReason: centralResult.recommendationReason,
    pillarScores: centralResult.pillarScores,
    pillars: centralResult.pillars,
    scoreBreakdown: centralResult.scoreBreakdown,
    summaryCounts: {
      mandatoryTotal: centralResult.mandatoryCompliance.total,
      preferredTotal: mappedReqs.filter(r => !r.mandatory).length,
      matched: mappedReqs.filter(r => r.status === 'MATCHED').length,
      partial: mappedReqs.filter(r => r.status === 'PARTIAL').length,
      notMatched: mappedReqs.filter(r => r.status === 'NOT_MATCHED').length,
      unknown: mappedReqs.filter(r => r.status === 'UNKNOWN').length,
      fullyMet: mappedReqs.filter(r => r.status === 'MATCHED').length,
      partiallyMet: mappedReqs.filter(r => r.status === 'PARTIAL').length,
      notMet: mappedReqs.filter(r => r.status === 'NOT_MATCHED').length,
      needsVerification: 0,
      notFound: mappedReqs.filter(r => r.status === 'NOT_MATCHED').length
    },
    requirements: mappedReqs,
    requirementResults: mappedReqs,
    strengths: centralResult.strengths,
    gaps: centralResult.gaps,
    warnings: centralResult.warnings,
    explanation: {
      summary: `${centralResult.matchLevel} (${finalScore}% ATS Score). ${centralResult.mandatoryCompliance.total > 0 ? `Mandatory: ${centralResult.mandatoryCompliance.matched}/${centralResult.mandatoryCompliance.total}` : 'No mandatory constraints'}.`,
      strengths: centralResult.strengths,
      gaps: centralResult.gaps,
      mandatoryStatus: centralResult.mandatoryRequirementFailed ? 'FAILED' : 'PASSED'
    },
    scoringConfigVersion: CENTRALIZED_ATS_SCORING_VERSION,
    evaluatedAt: centralResult.evaluatedAt,
    evaluator
  };
}
