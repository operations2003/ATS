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

const getPythonServiceUrls = (): string[] => {
  const configured = (process.env.DOCUMENT_PROCESSOR_URL || '').trim().replace(/\/+$/, '');
  const remote = (process.env.REMOTE_DOCUMENT_PROCESSOR_URL || '').trim().replace(/\/+$/, '');
  const local = 'http://127.0.0.1:8000';
  const urls: string[] = [];
  if (configured) urls.push(configured);
  if (!urls.includes(local)) urls.push(local);
  if (remote && !urls.includes(remote)) urls.push(remote);
  return urls;
};

const EVAL_TIMEOUT_MS = parseInt(process.env.PYTHON_TIMEOUT_MS || '15000', 10);

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

  // 1. Attempt AI-Powered Semantic Evaluation via Python Service with retries
  let lastError: any = null;
  const candidateUrls = getPythonServiceUrls();

  for (let uIdx = 0; uIdx < candidateUrls.length; uIdx++) {
    const serviceUrl = candidateUrls[uIdx];
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
            failureReason: r.failureReason || r.matchReason,
            aiMatchReason: r.matchReason,
            aiMatchedAlias: r.matchedAlias,
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
      console.warn(`[EvaluationService] Python service (${serviceUrl}) attempt ${uIdx + 1}/${candidateUrls.length} failed:`, err.message);
      if (uIdx + 1 < candidateUrls.length) {
        await new Promise(res => setTimeout(res, 500));
      }
    }
  }

  // 2. Resilient Deterministic Fallback: Run local TypeScript ATS Engine if Python service is unreachable
  console.warn(`[EvaluationService] Python evaluation engine unavailable (${lastError?.message}). Engaging local ATS scoring fallback...`);
  try {
    const { calculateATSScore } = await import('./atsScoringEngine');
    const tsResult = calculateATSScore(
      candidate,
      {
        id: job.id,
        position: job.position || job.title,
        client: job.client || job.company,
        jd_text: job.jd_text
      },
      enrichedRequirements as any
    );

    const mappedReqs: RequirementEvaluationResult[] = tsResult.requirements.map((r: any) => ({
      id: r.id,
      requirement: r.requirement,
      category: r.category,
      mandatory: r.mandatory,
      isMandatory: r.mandatory,
      evidence: r.candidateEvidence || r.evidence || '',
      candidateEvidence: r.candidateEvidence || r.evidence || '',
      evidenceSource: r.evidenceSource || 'Local ATS Evaluation',
      status: r.status,
      confidence: r.confidence || 'High',
      weight: r.weight,
      score: r.score,
      failureReason: r.failureReason,
      evidenceType: r.evidenceType
    }));

    return {
      evaluationId: tsResult.evaluationId,
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
      rawScore: tsResult.rawScore,
      baseDeterministicScore: tsResult.rawScore,
      aiSemanticAdjustment: 0.0,
      aiAssistanceEnabled: false,
      inferredRequirementsCount: 0,
      overallMatch: tsResult.overallScore,
      atsScore: tsResult.overallScore,
      overallScore: tsResult.overallScore,
      matchLevel: tsResult.matchLevel,
      mandatoryRequirementFailed: tsResult.mandatoryRequirementFailed,
      mandatoryComplianceScore: tsResult.mandatoryComplianceScore,
      mandatoryFailures: tsResult.mandatoryFailures,
      mandatoryCompliance: tsResult.mandatoryCompliance,
      recommendation: tsResult.overallScore >= 75 && !tsResult.mandatoryRequirementFailed ? 'SUBMIT' : (tsResult.overallScore >= 50 ? 'REVIEW' : 'DO NOT SUBMIT'),
      recommendationReason: tsResult.mandatoryRequirementFailed ? 'Mandatory knockout criteria failed in candidate profile.' : 'Evaluated via Deterministic ATS Engine.',
      pillarScores: tsResult.pillarScores,
      pillars: tsResult.pillars,
      scoreBreakdown: {
        mandatory: { score: tsResult.mandatoryComplianceScore, max: 100, pct: tsResult.mandatoryComplianceScore, label: 'Mandatory Compliance' },
        skills: { score: tsResult.pillarScores.technicalSkills, max: 100, pct: tsResult.pillarScores.technicalSkills, label: 'Technical Skills' },
        experience: { score: tsResult.pillarScores.experience, max: 100, pct: tsResult.pillarScores.experience, label: 'Experience' },
        responsibilities: { score: tsResult.pillarScores.genAI, max: 100, pct: tsResult.pillarScores.genAI, label: 'Role Competencies' },
        preferred: { score: tsResult.pillarScores.education, max: 100, pct: tsResult.pillarScores.education, label: 'Education & Preferred' }
      },
      summaryCounts: {
        mandatoryTotal: tsResult.mandatoryCompliance.total,
        preferredTotal: mappedReqs.filter(r => !r.mandatory).length,
        matched: mappedReqs.filter(r => r.status === 'MATCHED').length,
        partial: mappedReqs.filter(r => r.status === 'PARTIAL').length,
        notMatched: mappedReqs.filter(r => r.status === 'NOT_MATCHED').length,
        unknown: 0,
        fullyMet: mappedReqs.filter(r => r.status === 'MATCHED').length,
        partiallyMet: mappedReqs.filter(r => r.status === 'PARTIAL').length,
        notMet: mappedReqs.filter(r => r.status === 'NOT_MATCHED').length,
        needsVerification: 0,
        notFound: mappedReqs.filter(r => r.status === 'NOT_MATCHED').length
      },
      requirements: mappedReqs,
      requirementResults: mappedReqs,
      strengths: tsResult.strengths,
      gaps: tsResult.gaps,
      warnings: tsResult.warnings,
      explanation: {
        summary: `${tsResult.matchLevel} (${tsResult.overallScore}% Overall Match).`,
        strengths: tsResult.strengths,
        gaps: tsResult.gaps,
        mandatoryStatus: tsResult.mandatoryRequirementFailed ? 'FAILED' : 'PASSED'
      },
      scoringConfigVersion: '5.0.0-ats-scoring-fallback',
      evaluatedAt: new Date().toISOString(),
      evaluator: 'TaskNera ATS Engine (Local Fallback)'
    };
  } catch (fallbackErr: any) {
    throw new Error(`Evaluation engine failed: Python unreachable (${lastError?.message}) and fallback failed (${fallbackErr.message})`);
  }
}
