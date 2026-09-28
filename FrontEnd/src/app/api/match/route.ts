import { NextRequest, NextResponse } from 'next/server';
import {
  computeComprehensiveMatchScore,
  ComprehensiveMatchResult,
} from '@/utils/requirementUtils';

export const dynamic = 'force-dynamic';

export interface EvaluatedCandidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  currentCompany?: string;
  totalExperience?: string;
  skills: string[];
  education?: any[];
  matchScore: number;
  matchLevel: string;
  breakdown: ComprehensiveMatchResult['breakdown'];
  summary: string;
  evaluatedAt: string;
}

// In-memory evaluations store for fast retrieval and persistence
const EVALUATIONS_STORE: Map<string, any[]> = new Map();

// POST - Match candidate CV data with Job Requirements & JD
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, jobDescription, requirements, candidates } = body;

    if (!jobDescription && !jobId && (!requirements || requirements.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Job description, jobId, or requirements are required' },
        { status: 400 }
      );
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Candidates array is required and must not be empty' },
        { status: 400 }
      );
    }

    const effectiveJdText = typeof jobDescription === 'string'
      ? jobDescription
      : jobDescription?.jd_text || jobDescription?.jdText || jobDescription?.position || '';

    const effectiveRequirements = Array.isArray(requirements)
      ? requirements
      : (jobDescription?.requirements || []);

    const targetJob = {
      id: jobId || jobDescription?.id || 'job-req',
      jd_text: effectiveJdText,
      position: jobDescription?.position || jobDescription?.title || 'Target Job',
      requirements: effectiveRequirements,
    };

    // Process each candidate using the 4-part comprehensive matching algorithm
    const evaluatedCandidates: EvaluatedCandidate[] = candidates.map((candidate: any) => {
      const matchResult = computeComprehensiveMatchScore(
        {
          skills: candidate.skills || [],
          totalExperience: candidate.totalExperience || candidate.experience || candidate.totalExperienceYears,
          totalExperienceYears: candidate.totalExperienceYears,
          education: candidate.education || [],
          rawText: candidate.rawText || candidate.raw_text || '',
          summary: candidate.summary || candidate.professionalSummary || '',
          currentTitle: candidate.currentTitle || candidate.current_title || '',
        },
        targetJob
      );

      const candidateId = candidate.id || `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const candidateName = candidate.name || candidate.candidateName || 'Candidate';

      return {
        ...candidate,
        id: candidateId,
        name: candidateName,
        matchScore: matchResult.overallScore,
        matchLevel: matchResult.matchLevel,
        breakdown: matchResult.breakdown,
        summary: matchResult.summary,
        evaluatedAt: new Date().toISOString(),
      };
    });

    // Rank candidates by matchScore descending
    evaluatedCandidates.sort((a, b) => b.matchScore - a.matchScore);

    // Save evaluation records to memory cache / evaluation records store
    const evalKey = jobId || targetJob.id;
    const evaluationRecords = evaluatedCandidates.map(c => ({
      id: `eval-${Date.now()}-${c.id}`,
      jobId: evalKey,
      candidateId: c.id,
      candidateName: c.name,
      overallScore: c.matchScore,
      matchLevel: c.matchLevel,
      scoreBreakdown: c.breakdown,
      summary: c.summary,
      evaluatedAt: c.evaluatedAt,
    }));

    EVALUATIONS_STORE.set(evalKey, evaluationRecords);

    // Calculate aggregated statistics
    const scores = evaluatedCandidates.map(c => c.matchScore);
    const averageMatch = scores.length > 0
      ? Math.round(scores.reduce((acc, s) => acc + s, 0) / scores.length)
      : 0;

    const strongMatchesCount = evaluatedCandidates.filter(c => c.matchScore >= 85).length;
    const goodMatchesCount = evaluatedCandidates.filter(c => c.matchScore >= 70 && c.matchScore < 85).length;
    const moderateMatchesCount = evaluatedCandidates.filter(c => c.matchScore >= 50 && c.matchScore < 70).length;
    const lowFitCount = evaluatedCandidates.filter(c => c.matchScore < 50).length;

    return NextResponse.json({
      success: true,
      jobId: evalKey,
      data: {
        totalCandidates: evaluatedCandidates.length,
        averageMatch,
        distribution: {
          strongMatches: strongMatchesCount,
          goodMatches: goodMatchesCount,
          moderateMatches: moderateMatchesCount,
          lowFit: lowFitCount,
        },
        weightsApplied: {
          skillsWeight: '40%',
          experienceWeight: '30%',
          educationWeight: '15%',
          keywordCosineSimilarityWeight: '15%',
        },
        topCandidates: evaluatedCandidates.slice(0, 10),
        allCandidates: evaluatedCandidates,
        evaluationRecords,
      },
      message: `Successfully evaluated ${evaluatedCandidates.length} candidate(s) against job requirements`,
    });
  } catch (error: any) {
    console.error('Match evaluation API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to match candidates against job requirements' },
      { status: 500 }
    );
  }
}

