// ============================================================================
// TASKNERA ATS - TYPE DEFINITIONS
// Evidence-Based Candidate-JD Evaluation System
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export enum RequirementCategory {
  EXPERIENCE = 'Experience',
  TECHNICAL = 'Technical',
  FUNCTIONAL = 'Functional',
  DOMAIN = 'Domain',
  EDUCATION = 'Education',
  CERTIFICATION = 'Certification',
  LANGUAGE = 'Language',
  LOCATION = 'Location',
  SOFT_SKILL = 'Soft Skill',
  TOOL = 'Tool',
  PLATFORM = 'Platform',
  RESPONSIBILITY = 'Responsibility',
}

export enum RequirementStatus {
  FULLY_MET = 'Fully Met',
  PARTIALLY_MET = 'Partially Met',
  NOT_MET = 'Not Met',
  NOT_FOUND = 'Not Found',
  NEEDS_VERIFICATION = 'Needs Verification',
}

export enum ConfidenceLevel {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum EvidenceType {
  EXPLICIT = 'Explicit',
  SEMANTIC = 'Semantic',
  INFERRED = 'Inferred',
}

export enum SubmissionDecision {
  SUBMIT = 'SUBMIT',
  REVIEW = 'REVIEW',
  DO_NOT_SUBMIT = 'DO NOT SUBMIT',
}

export enum MatchLevel {
  STRONG_MATCH = 'STRONG MATCH',
  GOOD_MATCH = 'GOOD MATCH',
  REVIEW = 'REVIEW',
  WEAK_MATCH = 'WEAK MATCH',
  NOT_RECOMMENDED = 'NOT RECOMMENDED',
}

export enum JobStatus {
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  CLOSED = 'Closed',
  DRAFT = 'Draft',
}

export enum CandidateStatus {
  NEW = 'New',
  REVIEWED = 'Reviewed',
  SHORTLISTED = 'Shortlisted',
  INTERVIEW = 'Interview',
  OFFER = 'Offer',
  REJECTED = 'Rejected',
  SUBMITTED = 'Submitted',
  HIRED = 'Hired',
}

// ============================================================================
// CLIENT EVALUATION PROFILE
// ============================================================================

export interface ClientProfile {
  id: string;
  clientName: string;
  description?: string;
  rules: {
    strictMandatory: boolean; // If true, failed mandatory = auto reject
    technicalSkillsWeight: number; // Multiplier for technical skills
    certificationsImportant: boolean;
    experienceWeightMultiplier: number;
    industryExperienceWeight: number;
    allowFlexibleRequirements: boolean;
  };
  scoringAdjustments?: {
    mandatoryWeight?: number; // Default: 50
    skillsWeight?: number; // Default: 20
    experienceWeight?: number; // Default: 15
    responsibilitiesWeight?: number; // Default: 10
    preferredWeight?: number; // Default: 5
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================================================
// JOB DESCRIPTION
// ============================================================================

export interface Requirement {
  id: string;
  text: string;
  category: RequirementCategory;
  isMandatory: boolean;
  weight: number; // Points allocated to this requirement
  evidenceRequired: boolean;
  extractedFrom?: string; // Original text from JD
  sourceEvidence?: string; // Extracted source evidence from JD
  source_evidence?: string;
  order: number;
  aliases?: string[];
  context?: string;
}

export interface JobDescription {
  id: string;
  title: string;
  company?: string;
  location?: string;
  workMode?: 'Remote' | 'Hybrid' | 'Onsite';
  department?: string;
  employmentType?: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  
  // Parsed content
  rawText: string;
  summary?: string;
  
  // Years of experience required
  experienceRequired?: {
    min: number;
    max?: number;
    type: string; // e.g., "SAP CO", "Software Development"
  };
  
  // Extracted requirements
  mandatoryRequirements: Requirement[];
  preferredRequirements: Requirement[];
  
  // Additional parsed fields
  responsibilities?: string[];
  skills?: string[];
  tools?: string[];
  education?: string[];
  certifications?: string[];
  languages?: string[];
  
  // Metadata
  status: JobStatus;
  clientProfileId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  parsedAt?: Date;
  version: number;
}

// ============================================================================
// CANDIDATE CV
// ============================================================================

export interface CandidateExperience {
  id: string;
  role: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string | null; // null if current
  isCurrent: boolean;
  duration: string; // e.g., "2 years 3 months"
  responsibilities: string[];
  skills: string[];
  tools: string[];
  achievements?: string[];
}

export interface CandidateEducation {
  id: string;
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  graduationYear?: number;
  location?: string;
}

export interface CandidateCertification {
  id: string;
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface CandidateCV {
  id: string;
  
  // Personal information
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  portfolio?: string;
  
  // Current role
  currentRole?: string;
  currentCompany?: string;
  
  // Professional summary
  summary?: string;
  
  // Experience
  experiences: CandidateExperience[];
  totalExperience: string; // e.g., "8 years 6 months"
  totalExperienceMonths: number;
  totalExperienceYears?: number;
  
  // Skills
  skills: string[];
  tools: string[];
  platforms: string[];
  
  // Education
  education: CandidateEducation[];
  
  // Certifications
  certifications: CandidateCertification[];
  
  // Languages
  languages?: string[];
  
  // Industries worked in
  industries?: string[];
  
  // Metadata
  rawText: string;
  fileName: string;
  fileUrl?: string;
  uploadedAt: Date;
  parsedAt?: Date;
  uploadedBy: string;
  version: number;
}

// ============================================================================
// EVIDENCE
// ============================================================================

export interface Evidence {
  id: string;
  requirementId: string;
  candidateId: string;
  
  // Evidence details
  type: EvidenceType;
  text: string; // The actual text from CV that serves as evidence
  source: string; // Section of CV where found (e.g., "Experience - SAP Consultant")
  confidence: ConfidenceLevel;
  
  // Matching details
  matchStrength: number; // 0-100
  explanation?: string;
  
  // Location in CV
  experienceId?: string; // If from work experience
  certificationId?: string; // If from certification
  educationId?: string; // If from education
  
  createdAt: Date;
}

// ============================================================================
// REQUIREMENT EVALUATION
// ============================================================================

export interface RequirementEvaluation {
  id: string;
  requirementId: string;
  requirement: Requirement;
  
  status: RequirementStatus;
  confidence: ConfidenceLevel;
  
  // Evidence
  evidence: Evidence[];
  hasEvidence: boolean;
  
  // Scoring
  pointsAwarded: number;
  maxPoints: number;
  
  // Explanation
  reason: string;
  matchPercentage: number; // 0-100
  matchReason?: string;
  failureReason?: string;
  matchedAlias?: string;
  sourceEvidence?: string;
  source_evidence?: string;
  
  // Overrides
  overriddenBy?: string;
  overrideReason?: string;
  originalStatus?: RequirementStatus;
  overriddenAt?: Date;
}

// ============================================================================
// CANDIDATE EVALUATION
// ============================================================================

export interface ScoreBreakdown {
  // Mandatory Requirements - 50 points
  mandatoryCompliance: {
    score: number;
    maxScore: 50;
    percentage: number;
    totalRequirements: number;
    met: number;
    partiallyMet: number;
    notMet: number;
    notFound: number;
    needsVerification: number;
  };
  
  // Core Skills - 20 points
  coreSkills: {
    score: number;
    maxScore: 20;
    percentage: number;
    matchedSkills: number;
    totalSkills: number;
    matchedTools: number;
    totalTools: number;
  };
  
  // Relevant Experience - 15 points
  relevantExperience: {
    score: number;
    maxScore: 15;
    percentage: number;
    totalMonths: number;
    relevantMonths: number;
    meetsMinimum: boolean;
  };
  
  // Responsibilities - 10 points
  responsibilities: {
    score: number;
    maxScore: 10;
    percentage: number;
    matchedResponsibilities: number;
    totalResponsibilities: number;
  };
  
  // Preferred Requirements - 5 points
  preferredRequirements: {
    score: number;
    maxScore: 5;
    percentage: number;
    met: number;
    total: number;
  };
}

export interface ScoreDeduction {
  id: string;
  reason: string;
  points: number;
  category: string;
  requirementId?: string;
}

export interface CandidateStrength {
  title: string;
  description: string;
  evidence?: string;
}

export interface CandidateGap {
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  requirementId?: string;
}

export interface ATSCompatibilityScore {
  score: number; // 0-100
  maxScore: 100;
  
  factors: {
    keywordsPresent: number; // 0-30
    jobTitleAlignment: number; // 0-15
    skillsVisibility: number; // 0-20
    experienceVisibility: number; // 0-15
    educationVisibility: number; // 0-10
    formatting: number; // 0-10
  };
  
  missingKeywords: string[];
  suggestions: string[];
}

export interface CandidateEvaluation {
  id: string;
  candidateId: string;
  candidate: CandidateCV;
  jobId: string;
  job: JobDescription;
  
  // Overall scores
  overallScore: number; // 0-100
  matchLevel: MatchLevel;
  submissionDecision: SubmissionDecision;
  submissionReason: string;
  
  // Score breakdown
  scoreBreakdown: ScoreBreakdown;
  
  // ATS Compatibility (separate score)
  atsCompatibility: ATSCompatibilityScore;
  
  // Detailed evaluations
  requirementEvaluations: RequirementEvaluation[];
  
  // Deductions and explanations
  scoreDeductions: ScoreDeduction[];
  scoreExplanation: string;
  
  // Strengths and gaps
  strengths: CandidateStrength[];
  gaps: CandidateGap[];
  
  // Mandatory requirement failures
  mandatoryFailures: RequirementEvaluation[];
  hasMandatoryFailures: boolean;
  
  // Client profile used
  clientProfileId?: string;
  
  // Audit trail
  evaluatedAt: Date;
  evaluatedBy: string;
  evaluationVersion: number;
  reEvaluationOf?: string; // Previous evaluation ID
  
  // Recruiter actions
  recruiterNotes?: string;
  recruiterDecision?: SubmissionDecision;
  recruiterDecisionReason?: string;
  recruiterDecisionAt?: Date;
}

// ============================================================================
// CANDIDATE (Master Record)
// ============================================================================

export interface Candidate {
  id: string;
  
  // Latest CV
  currentCVId: string;
  cvHistory: string[]; // Array of CV IDs
  
  // Personal info (from latest CV)
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  
  // Status
  status: CandidateStatus;
  
  // Evaluations
  evaluations: string[]; // Array of evaluation IDs
  
  // Jobs applied to
  jobApplications: {
    jobId: string;
    appliedAt: Date;
    evaluationId?: string;
    submissionDecision?: SubmissionDecision;
  }[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Tags
  tags?: string[];
  
  // Notes
  notes?: {
    id: string;
    text: string;
    createdBy: string;
    createdAt: Date;
  }[];
}

// ============================================================================
// JOB (Master Record with Candidates)
// ============================================================================

export interface Job {
  id: string;
  jdId: string; // Reference to JobDescription
  
  // Basic info
  title: string;
  company?: string;
  department?: string;
  status: JobStatus;
  
  // Candidates
  candidates: {
    candidateId: string;
    evaluationId?: string;
    submittedAt?: Date;
    status: CandidateStatus;
  }[];
  
  // Stats
  stats: {
    totalCandidates: number;
    evaluated: number;
    strongMatches: number;
    submitted: number;
    inReview: number;
    rejected: number;
    averageScore: number;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  postedAt?: Date;
  closedAt?: Date;
}

// ============================================================================
// EVALUATION HISTORY & AUDIT
// ============================================================================

export interface EvaluationAudit {
  id: string;
  evaluationId: string;
  
  action: 'created' | 'updated' | 're-evaluated' | 'override' | 'decision';
  
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  
  performedBy: string;
  performedAt: Date;
  reason?: string;
  
  // Snapshot of scoring rules at time of evaluation
  scoringRulesSnapshot?: {
    mandatoryWeight: number;
    skillsWeight: number;
    experienceWeight: number;
    responsibilitiesWeight: number;
    preferredWeight: number;
    clientProfileId?: string;
  };
}

// ============================================================================
// SCORING ENGINE CONFIGURATION
// ============================================================================

export interface ScoringConfig {
  id: string;
  name: string;
  description?: string;
  
  weights: {
    mandatory: number; // Default: 50
    skills: number; // Default: 20
    experience: number; // Default: 15
    responsibilities: number; // Default: 10
    preferred: number; // Default: 5
  };
  
  rules: {
    strictMandatory: boolean;
    semanticMatchingEnabled: boolean;
    minimumConfidenceLevel: ConfidenceLevel;
    autoRejectOnMandatoryFailure: boolean;
  };
  
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// COMPARISON
// ============================================================================

export interface CandidateComparison {
  jobId: string;
  job: JobDescription;
  candidates: {
    candidate: CandidateCV;
    evaluation: CandidateEvaluation;
  }[];
  comparedAt: Date;
  comparedBy: string;
}

// ============================================================================
// EXPORT FORMATS
// ============================================================================

export interface ClientSubmissionSummary {
  candidate: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
  };
  position: string;
  overallMatch: number;
  matchLevel: MatchLevel;
  mandatoryCompliance: string;
  relevantExperience: string;
  keySkills: string[];
  strengths: string[];
  gaps: string[];
  recommendation: SubmissionDecision;
  generatedAt: Date;
  generatedBy: string;
}
