import prisma from '../config/prisma';
import { CandidateRecord } from '../controllers/candidateController';
import {
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
  // 1. Attempt AI-Powered Semantic Evaluation via Python Service with retries
  let lastError: any = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      } else {
        const errText = await response.text().catch(() => '');
        lastError = new Error(`Python service returned status ${response.status}: ${errText}`);
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[EvaluationService] Python attempt ${attempt}/${maxAttempts} failed:`, err.message);
      if (attempt < maxAttempts) {
        // Wait 1.5 seconds before retrying to allow cold-start / socket recovery
        await new Promise(res => setTimeout(res, 1500));
      }
    }
  }

  // Pure Python Guarantee: Fail cleanly instead of running conflicting TypeScript heuristics
  throw new Error(`Python evaluation engine failed after ${maxAttempts} attempts: ${lastError?.message || 'Service unreachable'}. Please verify the Python document processor is online.`);
}
