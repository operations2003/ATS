import prisma from '../config/prisma';
import { CandidateRecord } from '../controllers/candidateController';
import {
  calculateATSScore,
  ATSScoringResult,
  MatchStatus,
  EvidenceConfidence,
  MatchTier,
  MandatoryFailureDetail,
  PillarScores
} from './atsScoringEngine';

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

const PYTHON_SERVICE_URL = (process.env.DOCUMENT_PROCESSOR_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
const EVAL_TIMEOUT_MS = parseInt(process.env.PYTHON_TIMEOUT_MS || '25000', 10);

/**
 * Evaluates a single candidate against a job's confirmed requirements
 * Prioritizes Local Free AI Semantic Matching (all-MiniLM-L6-v2) with robust fallback
 */
export async function evaluateCandidateAgainstRequirements(
  candidate: CandidateRecord,
  job: { id: string; position?: string; title?: string; client?: string; company?: string; jd_text?: string },
  requirements: Array<{
    id: string;
    requirement: string;
    category?: string | null;
    weight?: number;
    is_mandatory?: boolean;
    isMandatory?: boolean;
    needs_verification?: boolean;
    source_evidence?: string | null;
  }>
): Promise<CandidateEvaluationPayload> {
  // 1. Attempt AI-Powered Semantic Evaluation via Python Service
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EVAL_TIMEOUT_MS);

    const response = await fetch(`${PYTHON_SERVICE_URL}/evaluate-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate,
        job,
        requirements
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const aiResult: any = await response.json();
      if (aiResult && typeof aiResult.overallScore === 'number') {
        const mappedReqs: RequirementEvaluationResult[] = (aiResult.requirements || []).map((r: any) => ({
          id: r.id,
          requirement: r.requirement,
          category: r.category || 'Technical Skill',
          mandatory: Boolean(r.mandatory ?? r.isMandatory),
          isMandatory: Boolean(r.mandatory ?? r.isMandatory),
          evidence: r.candidateEvidence || r.evidence || '',
          candidateEvidence: r.candidateEvidence || r.evidence || '',
          evidenceSource: r.evidenceSource || 'Semantic AI Evaluation',
          status: r.status,
          confidence: r.confidence || 'High',
          weight: r.weight || 1.0,
          score: r.score ?? 0,
          failureReason: r.failureReason,
          evidenceType: 'STRONG_SEMANTIC'
        }));

        const mandatoryTotal = aiResult.mandatoryCompliance?.total ?? mappedReqs.filter(r => r.mandatory).length;
        const mandatoryMet = aiResult.mandatoryCompliance?.met ?? mappedReqs.filter(r => r.mandatory && r.status === 'MATCHED').length;
        const mandatoryFailed = aiResult.mandatoryCompliance?.failed ?? (mandatoryTotal - mandatoryMet);

        const matchedCount = mappedReqs.filter(r => r.status === 'MATCHED').length;
        const partialCount = mappedReqs.filter(r => r.status === 'PARTIAL').length;
        const notMatchedCount = mappedReqs.filter(r => r.status === 'NOT_MATCHED').length;
        const unknownCount = mappedReqs.filter(r => r.status === 'UNKNOWN').length;

        const rawScore = aiResult.rawScore ?? aiResult.overallScore;
        const overallScore = aiResult.overallScore;

        const payload: CandidateEvaluationPayload = {
          evaluationId: aiResult.evaluationId || `eval-ai-${Date.now()}`,
          candidateId: candidate.id,
          candidateName: candidate.name || 'Candidate',
          candidateRole: candidate.currentTitle || job.position || 'Professional',
          candidateCompany: candidate.currentCompany || 'Organization',
          candidateEmail: candidate.email || '',
          candidatePhone: candidate.phone || '',
          candidateLocation: candidate.location || '',
          jobId: job.id,
          jobTitle: job.position || job.title || 'Job Position',
          jobClient: job.client || job.company || 'Client',
          rawScore,
          baseDeterministicScore: rawScore,
          aiSemanticAdjustment: 0.0,
          aiAssistanceEnabled: true,
          inferredRequirementsCount: 0,
          overallMatch: Math.round(overallScore),
          atsScore: Math.round(overallScore),
          overallScore,
          matchLevel: aiResult.matchLevel || (overallScore >= 80 ? 'STRONG MATCH' : overallScore >= 50 ? 'MODERATE MATCH' : 'LOW MATCH'),
          mandatoryRequirementFailed: Boolean(aiResult.mandatoryRequirementFailed),
          mandatoryComplianceScore: aiResult.mandatoryComplianceScore ?? Math.round((mandatoryMet / Math.max(1, mandatoryTotal)) * 100),
          mandatoryFailures: aiResult.mandatoryFailures || [],
          mandatoryCompliance: {
            total: mandatoryTotal,
            met: mandatoryMet,
            failed: mandatoryFailed,
            passed: !aiResult.mandatoryRequirementFailed
          },
          recommendation: aiResult.recommendation || (overallScore >= 75 ? 'SUBMIT' : overallScore >= 50 ? 'REVIEW' : 'DO NOT SUBMIT'),
          recommendationReason: aiResult.recommendationReason || 'Evaluated via Semantic AI ATS Matching Engine.',
          pillarScores: aiResult.pillarScores || {
            technicalSkills: Math.round(rawScore),
            experience: Math.round(rawScore * 0.95),
            education: 90,
            genAI: Math.round(rawScore * 0.85),
            semanticRelevance: Math.round(rawScore)
          },
          pillars: aiResult.pillarScores || {
            technicalSkills: Math.round(rawScore),
            experience: Math.round(rawScore * 0.95),
            education: 90,
            genAI: Math.round(rawScore * 0.85),
            semanticRelevance: Math.round(rawScore)
          },
          scoreBreakdown: {
            mandatory: {
              score: aiResult.mandatoryComplianceScore ?? 100,
              max: 100,
              pct: aiResult.mandatoryComplianceScore ?? 100,
              label: mandatoryTotal > 0 ? `Mandatory Compliance (${mandatoryMet}/${mandatoryTotal})` : 'Mandatory Compliance (N/A)'
            },
            skills: {
              score: aiResult.pillarScores?.technicalSkills ?? Math.round(rawScore),
              max: 100,
              pct: aiResult.pillarScores?.technicalSkills ?? Math.round(rawScore),
              label: 'Technical Skills'
            },
            experience: {
              score: aiResult.pillarScores?.experience ?? Math.round(rawScore * 0.95),
              max: 100,
              pct: aiResult.pillarScores?.experience ?? Math.round(rawScore * 0.95),
              label: 'Experience'
            },
            responsibilities: {
              score: aiResult.pillarScores?.genAI ?? Math.round(rawScore * 0.85),
              max: 100,
              pct: aiResult.pillarScores?.genAI ?? Math.round(rawScore * 0.85),
              label: 'Role Competencies'
            },
            preferred: {
              score: aiResult.pillarScores?.education ?? 90,
              max: 100,
              pct: aiResult.pillarScores?.education ?? 90,
              label: 'Education & Preferred'
            }
          },
          summaryCounts: {
            mandatoryTotal,
            preferredTotal: mappedReqs.filter(r => !r.mandatory).length,
            matched: matchedCount,
            partial: partialCount,
            notMatched: notMatchedCount,
            unknown: unknownCount,
            fullyMet: matchedCount,
            partiallyMet: partialCount,
            notMet: notMatchedCount,
            needsVerification: unknownCount,
            notFound: notMatchedCount
          },
          requirements: mappedReqs,
          requirementResults: mappedReqs,
          strengths: aiResult.strengths || [],
          gaps: aiResult.gaps || [],
          warnings: aiResult.warnings || [],
          explanation: {
            summary: `${aiResult.matchLevel} (${overallScore}% Overall Match). ${mandatoryTotal > 0 ? `Mandatory: ${mandatoryMet}/${mandatoryTotal}` : 'No mandatory constraints'}.`,
            strengths: aiResult.strengths || [],
            gaps: aiResult.gaps || [],
            mandatoryStatus: aiResult.mandatoryRequirementFailed ? 'FAILED' : 'PASSED'
          },
          scoringConfigVersion: '5.0.0-ai-semantic-matcher',
          evaluatedAt: new Date().toISOString(),
          evaluator: 'TaskNera Semantic AI Engine (all-MiniLM-L6-v2)'
        };

        return payload;
      }
    }
  } catch (err: any) {
    console.warn('[EvaluationService] AI service call bypassed or failed, using local scoring engine:', err.message);
  }

  // 2. Deterministic Fallback Engine
  const result: ATSScoringResult = calculateATSScore(candidate, job, requirements);

  const mappedReqs: RequirementEvaluationResult[] = result.requirements.map(r => ({
    id: r.id,
    requirement: r.requirement,
    category: r.category,
    mandatory: r.mandatory,
    isMandatory: r.mandatory,
    evidence: r.candidateEvidence,
    candidateEvidence: r.candidateEvidence,
    evidenceSource: r.evidenceSource,
    status: r.status,
    confidence: r.confidence,
    weight: r.weight,
    score: r.score,
    failureReason: r.failureReason,
    evidenceType: r.evidenceType
  }));

  const mandatoryTotal = result.mandatoryCompliance.total;
  const mandatoryMet = result.mandatoryCompliance.met;
  const mandatoryFailed = result.mandatoryCompliance.failed;

  let recommendation: 'SUBMIT' | 'REVIEW' | 'DO NOT SUBMIT' = 'REVIEW';
  let recommendationReason = 'Candidate meets core qualifications and requires recruiter review.';

  if (result.mandatoryRequirementFailed) {
    recommendation = 'DO NOT SUBMIT';
    const failedNames = result.mandatoryFailures.map(f => f.requirement).join(', ');
    recommendationReason = `Critical mandatory requirement failed: ${failedNames || 'Mandatory prerequisite not satisfied'}.`;
  } else if (result.overallScore >= 65) {
    recommendation = 'SUBMIT';
    recommendationReason = 'Strong qualification alignment across mandatory requirements, technical stack, and verified experience.';
  } else if (result.overallScore < 50) {
    recommendation = 'DO NOT SUBMIT';
    recommendationReason = 'Candidate overall fit is below threshold for this position.';
  }

  const matchedCount = mappedReqs.filter(r => r.status === 'MATCHED').length;
  const partialCount = mappedReqs.filter(r => r.status === 'PARTIAL').length;
  const notMatchedCount = mappedReqs.filter(r => r.status === 'NOT_MATCHED').length;
  const unknownCount = mappedReqs.filter(r => r.status === 'UNKNOWN').length;

  const payload: CandidateEvaluationPayload = {
    evaluationId: result.evaluationId,
    candidateId: candidate.id,
    candidateName: candidate.name || 'Candidate',
    candidateRole: candidate.currentTitle || job.position || 'Professional',
    candidateCompany: candidate.currentCompany || 'Organization',
    candidateEmail: candidate.email || '',
    candidatePhone: candidate.phone || '',
    candidateLocation: candidate.location || '',
    jobId: job.id,
    jobTitle: job.position || job.title || 'Job Position',
    jobClient: job.client || job.company || 'Client',
    rawScore: result.rawScore,
    baseDeterministicScore: result.rawScore,
    aiSemanticAdjustment: 0.0,
    aiAssistanceEnabled: true,
    inferredRequirementsCount: 0,
    overallMatch: Math.round(result.overallScore),
    atsScore: Math.round(result.overallScore),
    overallScore: result.overallScore,
    matchLevel: result.matchLevel,
    mandatoryRequirementFailed: result.mandatoryRequirementFailed,
    mandatoryComplianceScore: result.mandatoryComplianceScore,
    mandatoryFailures: result.mandatoryFailures,
    mandatoryCompliance: {
      total: mandatoryTotal,
      met: mandatoryMet,
      failed: mandatoryFailed,
      passed: !result.mandatoryRequirementFailed
    },
    recommendation,
    recommendationReason,
    pillarScores: result.pillarScores,
    pillars: result.pillarScores,
    scoreBreakdown: {
      mandatory: {
        score: result.mandatoryComplianceScore,
        max: 100,
        pct: result.mandatoryComplianceScore,
        label: mandatoryTotal > 0 ? `Mandatory Compliance (${mandatoryMet}/${mandatoryTotal})` : 'Mandatory Compliance (N/A)'
      },
      skills: {
        score: result.pillarScores.technicalSkills,
        max: 100,
        pct: result.pillarScores.technicalSkills,
        label: 'Technical Skills'
      },
      experience: {
        score: result.pillarScores.experience,
        max: 100,
        pct: result.pillarScores.experience,
        label: 'Experience'
      },
      responsibilities: {
        score: result.pillarScores.genAI,
        max: 100,
        pct: result.pillarScores.genAI,
        label: 'GenAI & Domain Fit'
      },
      preferred: {
        score: result.pillarScores.education,
        max: 100,
        pct: result.pillarScores.education,
        label: 'Education'
      }
    },
    summaryCounts: {
      mandatoryTotal,
      preferredTotal: mappedReqs.filter(r => !r.mandatory).length,
      matched: matchedCount,
      partial: partialCount,
      notMatched: notMatchedCount,
      unknown: unknownCount,
      fullyMet: matchedCount,
      partiallyMet: partialCount,
      notMet: notMatchedCount,
      needsVerification: unknownCount,
      notFound: notMatchedCount
    },
    requirements: mappedReqs,
    requirementResults: mappedReqs,
    strengths: result.strengths,
    gaps: result.gaps,
    warnings: result.warnings,
    explanation: {
      summary: `${result.matchLevel} (${result.overallScore}% Overall Score). ${mandatoryTotal > 0 ? `Mandatory: ${mandatoryMet}/${mandatoryTotal}` : 'No mandatory constraints'}.`,
      strengths: result.strengths,
      gaps: result.gaps,
      mandatoryStatus: result.mandatoryRequirementFailed ? 'FAILED' : 'PASSED'
    },
    scoringConfigVersion: result.scoringConfigVersion,
    evaluatedAt: result.evaluatedAt,
    evaluator: 'Evidence-Based ATS Engine (v3.0)'
  };

  return payload;
}
