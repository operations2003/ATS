// ============================================================================
// TASKNERA ATS - MOCK DATA SERVICE
// Realistic demo data for frontend development
// ============================================================================

import type {
  JobDescription,
  Requirement,
  CandidateCV,
  CandidateEvaluation,
  RequirementEvaluation,
  Evidence,
  ScoreBreakdown,
  CandidateStrength,
  CandidateGap,
  ClientProfile,
  Job,
  Candidate,
} from '@/types';

import {
  RequirementCategory,
  RequirementStatus,
  ConfidenceLevel,
  EvidenceType,
  SubmissionDecision,
  MatchLevel,
  JobStatus,
  CandidateStatus,
} from '@/types';

// ============================================================================
// SAMPLE JOB DESCRIPTIONS
// ============================================================================

export const sampleJobs: JobDescription[] = [
  {
    id: 'jd-1',
    title: 'SAP CO Consultant',
    company: 'TechCorp Industries',
    location: 'New York, NY',
    workMode: 'Hybrid',
    department: 'Finance Technology',
    employmentType: 'Full-time',
    salaryRange: { min: 120000, max: 180000, currency: 'USD' },
    rawText: `SAP CO Consultant - TechCorp Industries
    
We are seeking an experienced SAP CO Consultant with strong manufacturing domain knowledge.

Requirements:
- 5+ years SAP CO experience (Mandatory)
- 4+ years SAP S/4HANA experience (Mandatory)
- Manufacturing industry experience (Mandatory)
- SAP implementation project experience
- Bachelor's degree in Finance, Accounting or related field
- SAP certification (Preferred)
- Power BI experience (Preferred)

Responsibilities:
- Configure and customize SAP CO modules
- Lead S/4HANA implementation projects
- Provide training and support to end users
- Develop reporting solutions`,
    summary: 'Experienced SAP CO Consultant for manufacturing finance technology role',
    experienceRequired: { min: 5, type: 'SAP CO' },
    mandatoryRequirements: [
      {
        id: 'req-1',
        text: '5+ years SAP CO experience',
        category: RequirementCategory.EXPERIENCE,
        isMandatory: true,
        weight: 15,
        evidenceRequired: true,
        order: 1,
      },
      {
        id: 'req-2',
        text: '4+ years SAP S/4HANA experience',
        category: RequirementCategory.TECHNICAL,
        isMandatory: true,
        weight: 10,
        evidenceRequired: true,
        order: 2,
      },
      {
        id: 'req-3',
        text: 'Manufacturing industry experience',
        category: RequirementCategory.DOMAIN,
        isMandatory: true,
        weight: 10,
        evidenceRequired: true,
        order: 3,
      },
      {
        id: 'req-4',
        text: 'SAP implementation project experience',
        category: RequirementCategory.EXPERIENCE,
        isMandatory: true,
        weight: 8,
        evidenceRequired: true,
        order: 4,
      },
      {
        id: 'req-5',
        text: "Bachelor's degree in Finance or Accounting",
        category: RequirementCategory.EDUCATION,
        isMandatory: true,
        weight: 7,
        evidenceRequired: true,
        order: 5,
      },
    ],
    preferredRequirements: [
      {
        id: 'req-6',
        text: 'SAP certification',
        category: RequirementCategory.CERTIFICATION,
        isMandatory: false,
        weight: 3,
        evidenceRequired: false,
        order: 6,
      },
      {
        id: 'req-7',
        text: 'Power BI experience',
        category: RequirementCategory.TOOL,
        isMandatory: false,
        weight: 2,
        evidenceRequired: false,
        order: 7,
      },
    ],
    responsibilities: [
      'Configure and customize SAP CO modules',
      'Lead S/4HANA implementation projects',
      'Provide training and support to end users',
      'Develop reporting solutions',
    ],
    skills: ['SAP CO', 'S/4HANA', 'Cost Center Accounting', 'Profit Center Accounting', 'Internal Orders'],
    tools: ['SAP', 'Power BI', 'Excel'],
    education: ["Bachelor's degree"],
    certifications: ['SAP Certified Application Associate'],
    status: JobStatus.ACTIVE,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    createdBy: 'recruiter@techcorp.com',
    parsedAt: new Date('2024-01-15'),
    version: 1,
  },
  {
    id: 'jd-2',
    title: 'Senior Full Stack Developer',
    company: 'InnovateTech',
    location: 'San Francisco, CA',
    workMode: 'Remote',
    department: 'Engineering',
    employmentType: 'Full-time',
    salaryRange: { min: 140000, max: 200000, currency: 'USD' },
    rawText: 'Senior Full Stack Developer position...',
    summary: 'Senior Full Stack Developer for cloud-based SaaS platform',
    experienceRequired: { min: 5, type: 'Full Stack Development' },
    mandatoryRequirements: [
      {
        id: 'req-fs-1',
        text: '5+ years full stack development experience',
        category: RequirementCategory.EXPERIENCE,
        isMandatory: true,
        weight: 15,
        evidenceRequired: true,
        order: 1,
      },
      {
        id: 'req-fs-2',
        text: 'React and Node.js expertise',
        category: RequirementCategory.TECHNICAL,
        isMandatory: true,
        weight: 12,
        evidenceRequired: true,
        order: 2,
      },
      {
        id: 'req-fs-3',
        text: 'AWS cloud experience',
        category: RequirementCategory.TECHNICAL,
        isMandatory: true,
        weight: 10,
        evidenceRequired: true,
        order: 3,
      },
    ],
    preferredRequirements: [
      {
        id: 'req-fs-4',
        text: 'TypeScript experience',
        category: RequirementCategory.TECHNICAL,
        isMandatory: false,
        weight: 3,
        evidenceRequired: false,
        order: 4,
      },
    ],
    responsibilities: ['Build scalable web applications', 'Design RESTful APIs', 'Mentor junior developers'],
    skills: ['React', 'Node.js', 'TypeScript', 'AWS'],
    tools: ['Git', 'Docker', 'Kubernetes'],
    status: JobStatus.ACTIVE,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    createdBy: 'hr@innovatetech.com',
    parsedAt: new Date('2024-01-10'),
    version: 1,
  },
];

// ============================================================================
// SAMPLE CANDIDATE CVs
// ============================================================================

export const sampleCandidates: CandidateCV[] = [
  {
    id: 'cv-1',
    fullName: 'Sarah Mitchell',
    email: 'sarah.mitchell@email.com',
    phone: '+1 234 567 8901',
    location: 'New York, NY',
    currentRole: 'Senior SAP CO Consultant',
    currentCompany: 'Global Solutions Inc',
    summary: 'Experienced SAP CO consultant with 6+ years specializing in S/4HANA implementations for manufacturing clients',
    experiences: [
      {
        id: 'exp-1',
        role: 'Senior SAP CO Consultant',
        company: 'Global Solutions Inc',
        location: 'New York, NY',
        startDate: '2020-03',
        endDate: null,
        isCurrent: true,
        duration: '3 years 10 months',
        responsibilities: [
          'Led S/4HANA CO module implementation for 3 manufacturing clients',
          'Configured cost center accounting and profit center accounting',
          'Trained 50+ end users on SAP CO best practices',
          'Developed custom reports using SAP BW and Power BI',
        ],
        skills: ['SAP CO', 'S/4HANA', 'Cost Center Accounting', 'Product Costing'],
        tools: ['SAP', 'Power BI', 'Excel'],
        achievements: ['Successfully delivered $2M implementation project 2 weeks ahead of schedule'],
      },
      {
        id: 'exp-2',
        role: 'SAP CO Consultant',
        company: 'TechConsult Partners',
        location: 'New York, NY',
        startDate: '2018-01',
        endDate: '2020-02',
        isCurrent: false,
        duration: '2 years 2 months',
        responsibilities: [
          'Implemented SAP CO modules for manufacturing and automotive clients',
          'Performed gap analysis and solution design',
          'Supported month-end closing processes',
        ],
        skills: ['SAP CO', 'ECC', 'Internal Orders'],
        tools: ['SAP', 'ABAP'],
      },
    ],
    totalExperience: '5 years 11 months',
    totalExperienceMonths: 71,
    skills: ['SAP CO', 'S/4HANA', 'Cost Center Accounting', 'Profit Center Accounting', 'Product Costing', 'Internal Orders', 'Power BI'],
    tools: ['SAP', 'Power BI', 'Excel', 'Tableau'],
    platforms: ['S/4HANA', 'SAP ECC'],
    education: [
      {
        id: 'edu-1',
        degree: "Bachelor's degree",
        institution: 'NYU Stern School of Business',
        fieldOfStudy: 'Finance',
        graduationYear: 2017,
        location: 'New York, NY',
      },
    ],
    certifications: [
      {
        id: 'cert-1',
        name: 'SAP Certified Application Associate - SAP S/4HANA for Management Accounting',
        issuer: 'SAP',
        issueDate: '2021-06',
      },
    ],
    industries: ['Manufacturing', 'Automotive', 'Consumer Goods'],
    rawText: 'Full CV text here...',
    fileName: 'Sarah_Mitchell_CV.pdf',
    uploadedAt: new Date('2024-01-20'),
    parsedAt: new Date('2024-01-20'),
    uploadedBy: 'recruiter@techcorp.com',
    version: 1,
  },
  {
    id: 'cv-2',
    fullName: 'Michael Chen',
    email: 'michael.chen@email.com',
    phone: '+1 234 567 8902',
    location: 'San Francisco, CA',
    currentRole: 'SAP Consultant',
    currentCompany: 'Enterprise Systems Ltd',
    summary: 'SAP consultant with 7 years of experience across multiple modules',
    experiences: [
      {
        id: 'exp-3',
        role: 'SAP Consultant',
        company: 'Enterprise Systems Ltd',
        location: 'San Francisco, CA',
        startDate: '2017-01',
        endDate: null,
        isCurrent: true,
        duration: '7 years',
        responsibilities: [
          'Worked on SAP implementations across FI, CO, and MM modules',
          'Specialized in financial reporting and analysis',
          'Conducted system training sessions',
        ],
        skills: ['SAP FI', 'SAP CO', 'SAP MM', 'S/4HANA'],
        tools: ['SAP', 'Excel'],
      },
    ],
    totalExperience: '7 years',
    totalExperienceMonths: 84,
    skills: ['SAP FI', 'SAP CO', 'SAP MM', 'S/4HANA', 'Financial Reporting'],
    tools: ['SAP', 'Excel'],
    platforms: ['S/4HANA', 'SAP ECC'],
    education: [
      {
        id: 'edu-2',
        degree: "Bachelor's degree",
        institution: 'UC Berkeley',
        fieldOfStudy: 'Accounting',
        graduationYear: 2016,
        location: 'Berkeley, CA',
      },
    ],
    certifications: [],
    industries: ['Technology', 'Retail'],
    rawText: 'Full CV text here...',
    fileName: 'Michael_Chen_CV.pdf',
    uploadedAt: new Date('2024-01-21'),
    parsedAt: new Date('2024-01-21'),
    uploadedBy: 'recruiter@techcorp.com',
    version: 1,
  },
  {
    id: 'cv-3',
    fullName: 'Jennifer Lopez',
    email: 'jennifer.lopez@email.com',
    phone: '+1 234 567 8903',
    location: 'Chicago, IL',
    currentRole: 'Junior SAP Analyst',
    currentCompany: 'Business Solutions Co',
    summary: 'Early career SAP professional with 2 years experience',
    experiences: [
      {
        id: 'exp-4',
        role: 'Junior SAP Analyst',
        company: 'Business Solutions Co',
        location: 'Chicago, IL',
        startDate: '2022-06',
        endDate: null,
        isCurrent: true,
        duration: '1 year 7 months',
        responsibilities: [
          'Support SAP CO module operations',
          'Assist with month-end closing',
          'Create basic reports',
        ],
        skills: ['SAP CO', 'Excel'],
        tools: ['SAP', 'Excel'],
      },
    ],
    totalExperience: '1 year 7 months',
    totalExperienceMonths: 19,
    skills: ['SAP CO', 'Excel', 'Data Analysis'],
    tools: ['SAP', 'Excel'],
    platforms: ['SAP ECC'],
    education: [
      {
        id: 'edu-3',
        degree: "Bachelor's degree",
        institution: 'University of Illinois',
        fieldOfStudy: 'Business Administration',
        graduationYear: 2022,
        location: 'Chicago, IL',
      },
    ],
    certifications: [],
    industries: ['Consulting'],
    rawText: 'Full CV text here...',
    fileName: 'Jennifer_Lopez_CV.pdf',
    uploadedAt: new Date('2024-01-22'),
    parsedAt: new Date('2024-01-22'),
    uploadedBy: 'recruiter@techcorp.com',
    version: 1,
  },
];

// ============================================================================
// SAMPLE EVALUATIONS
// ============================================================================

export const sampleEvaluations: CandidateEvaluation[] = [
  {
    id: 'eval-1',
    candidateId: 'cv-1',
    candidate: sampleCandidates[0],
    jobId: 'jd-1',
    job: sampleJobs[0],
    overallScore: 94,
    matchLevel: MatchLevel.STRONG_MATCH,
    submissionDecision: SubmissionDecision.SUBMIT,
    submissionReason: 'Candidate exceeds all mandatory requirements with strong evidence. Highly qualified for the role.',
    scoreBreakdown: {
      mandatoryCompliance: {
        score: 48,
        maxScore: 50,
        percentage: 96,
        totalRequirements: 5,
        met: 5,
        partiallyMet: 0,
        notMet: 0,
        notFound: 0,
        needsVerification: 0,
      },
      coreSkills: {
        score: 19,
        maxScore: 20,
        percentage: 95,
        matchedSkills: 7,
        totalSkills: 8,
        matchedTools: 2,
        totalTools: 3,
      },
      relevantExperience: {
        score: 14,
        maxScore: 15,
        percentage: 93,
        totalMonths: 71,
        relevantMonths: 71,
        meetsMinimum: true,
      },
      responsibilities: {
        score: 9,
        maxScore: 10,
        percentage: 90,
        matchedResponsibilities: 4,
        totalResponsibilities: 4,
      },
      preferredRequirements: {
        score: 4,
        maxScore: 5,
        percentage: 80,
        met: 2,
        total: 2,
      },
    },
    atsCompatibility: {
      score: 96,
      maxScore: 100,
      factors: {
        keywordsPresent: 29,
        jobTitleAlignment: 15,
        skillsVisibility: 19,
        experienceVisibility: 15,
        educationVisibility: 10,
        formatting: 8,
      },
      missingKeywords: ['Azure'],
      suggestions: ['Add more quantified achievements', 'Include project budget/team size details'],
    },
    requirementEvaluations: [
      {
        id: 'req-eval-1',
        requirementId: 'req-1',
        requirement: sampleJobs[0].mandatoryRequirements[0],
        status: RequirementStatus.FULLY_MET,
        confidence: ConfidenceLevel.HIGH,
        evidence: [
          {
            id: 'ev-1',
            requirementId: 'req-1',
            candidateId: 'cv-1',
            type: EvidenceType.EXPLICIT,
            text: 'Senior SAP CO Consultant (2020-present): 3 years 10 months + SAP CO Consultant (2018-2020): 2 years 2 months = 5 years 11 months total SAP CO experience',
            source: 'Experience - Global Solutions Inc & TechConsult Partners',
            confidence: ConfidenceLevel.HIGH,
            matchStrength: 98,
            explanation: 'Candidate has 5 years 11 months of direct SAP CO experience, exceeding the 5+ years requirement',
            experienceId: 'exp-1',
            createdAt: new Date(),
          },
        ],
        hasEvidence: true,
        pointsAwarded: 15,
        maxPoints: 15,
        reason: 'Candidate has 5 years 11 months of direct SAP CO experience, fully meeting and exceeding the requirement',
        matchPercentage: 100,
      },
      {
        id: 'req-eval-2',
        requirementId: 'req-2',
        requirement: sampleJobs[0].mandatoryRequirements[1],
        status: RequirementStatus.FULLY_MET,
        confidence: ConfidenceLevel.HIGH,
        evidence: [
          {
            id: 'ev-2',
            requirementId: 'req-2',
            candidateId: 'cv-1',
            type: EvidenceType.EXPLICIT,
            text: 'Led S/4HANA CO module implementation for 3 manufacturing clients (2020-present)',
            source: 'Experience - Global Solutions Inc',
            confidence: ConfidenceLevel.HIGH,
            matchStrength: 95,
            experienceId: 'exp-1',
            createdAt: new Date(),
          },
        ],
        hasEvidence: true,
        pointsAwarded: 10,
        maxPoints: 10,
        reason: 'Candidate has 3+ years of hands-on S/4HANA experience',
        matchPercentage: 100,
      },
      {
        id: 'req-eval-3',
        requirementId: 'req-3',
        requirement: sampleJobs[0].mandatoryRequirements[2],
        status: RequirementStatus.FULLY_MET,
        confidence: ConfidenceLevel.HIGH,
        evidence: [
          {
            id: 'ev-3',
            requirementId: 'req-3',
            candidateId: 'cv-1',
            type: EvidenceType.EXPLICIT,
            text: 'Industries: Manufacturing, Automotive, Consumer Goods',
            source: 'Industries section',
            confidence: ConfidenceLevel.HIGH,
            matchStrength: 100,
            createdAt: new Date(),
          },
        ],
        hasEvidence: true,
        pointsAwarded: 10,
        maxPoints: 10,
        reason: 'Direct manufacturing industry experience clearly stated',
        matchPercentage: 100,
      },
      {
        id: 'req-eval-4',
        requirementId: 'req-4',
        requirement: sampleJobs[0].mandatoryRequirements[3],
        status: RequirementStatus.FULLY_MET,
        confidence: ConfidenceLevel.HIGH,
        evidence: [
          {
            id: 'ev-4',
            requirementId: 'req-4',
            candidateId: 'cv-1',
            type: EvidenceType.EXPLICIT,
            text: 'Led S/4HANA CO module implementation for 3 manufacturing clients',
            source: 'Experience - Global Solutions Inc',
            confidence: ConfidenceLevel.HIGH,
            matchStrength: 100,
            experienceId: 'exp-1',
            createdAt: new Date(),
          },
        ],
        hasEvidence: true,
        pointsAwarded: 8,
        maxPoints: 8,
        reason: 'Multiple SAP implementation projects documented',
        matchPercentage: 100,
      },
      {
        id: 'req-eval-5',
        requirementId: 'req-5',
        requirement: sampleJobs[0].mandatoryRequirements[4],
        status: RequirementStatus.FULLY_MET,
        confidence: ConfidenceLevel.HIGH,
        evidence: [
          {
            id: 'ev-5',
            requirementId: 'req-5',
            candidateId: 'cv-1',
            type: EvidenceType.EXPLICIT,
            text: "Bachelor's degree in Finance from NYU Stern School of Business (2017)",
            source: 'Education',
            confidence: ConfidenceLevel.HIGH,
            matchStrength: 100,
            educationId: 'edu-1',
            createdAt: new Date(),
          },
        ],
        hasEvidence: true,
        pointsAwarded: 7,
        maxPoints: 7,
        reason: "Bachelor's degree in Finance from reputable institution",
        matchPercentage: 100,
      },
    ],
    scoreDeductions: [
      {
        id: 'ded-1',
        reason: 'Missing Azure cloud platform mention',
        points: 1,
        category: 'Skills',
      },
      {
        id: 'ded-2',
        reason: 'International client experience not clearly stated',
        points: 1,
        category: 'Experience',
      },
    ],
    scoreExplanation:
      'The candidate scored 94/100 because all five mandatory requirements were fully satisfied with strong evidence. Candidate has 5 years 11 months of SAP CO experience (exceeds 5+ year requirement), 3+ years of S/4HANA experience, direct manufacturing industry exposure, multiple implementation projects, and required education. SAP certification is present. Minor deductions for missing Power BI depth and some international exposure details.',
    strengths: [
      {
        title: 'Exceeds Experience Requirement',
        description: '5 years 11 months SAP CO experience vs 5 years required',
        evidence: 'Documented across two companies with clear dates',
      },
      {
        title: 'Strong S/4HANA Background',
        description: 'Led 3 S/4HANA implementations for manufacturing clients',
        evidence: 'Current role at Global Solutions Inc',
      },
      {
        title: 'Manufacturing Domain Expert',
        description: 'Extensive experience in manufacturing, automotive, and consumer goods',
      },
      {
        title: 'SAP Certified Professional',
        description: 'SAP Certified Application Associate - S/4HANA for Management Accounting',
      },
      {
        title: 'Power BI Experience',
        description: 'Developed custom reports using SAP BW and Power BI',
      },
    ],
    gaps: [
      {
        title: 'Azure Platform Not Mentioned',
        description: 'While not required, Azure cloud experience would be beneficial',
        severity: 'Low',
      },
      {
        title: 'International Project Exposure',
        description: 'All documented projects appear to be US-based',
        severity: 'Low',
      },
    ],
    mandatoryFailures: [],
    hasMandatoryFailures: false,
    evaluatedAt: new Date('2024-01-20T10:30:00'),
    evaluatedBy: 'recruiter@techcorp.com',
    evaluationVersion: 1,
  },
  {
    id: 'eval-2',
    candidateId: 'cv-2',
    candidate: sampleCandidates[1],
    jobId: 'jd-1',
    job: sampleJobs[0],
    overallScore: 76,
    matchLevel: MatchLevel.REVIEW,
    submissionDecision: SubmissionDecision.REVIEW,
    submissionReason: 'Candidate has relevant SAP experience but SAP CO depth is unclear. Requires recruiter verification before submission.',
    scoreBreakdown: {
      mandatoryCompliance: {
        score: 38,
        maxScore: 50,
        percentage: 76,
        totalRequirements: 5,
        met: 3,
        partiallyMet: 1,
        notMet: 0,
        notFound: 1,
        needsVerification: 1,
      },
      coreSkills: {
        score: 16,
        maxScore: 20,
        percentage: 80,
        matchedSkills: 6,
        totalSkills: 8,
        matchedTools: 1,
        totalTools: 3,
      },
      relevantExperience: {
        score: 12,
        maxScore: 15,
        percentage: 80,
        totalMonths: 84,
        relevantMonths: 50,
        meetsMinimum: true,
      },
      responsibilities: {
        score: 7,
        maxScore: 10,
        percentage: 70,
        matchedResponsibilities: 3,
        totalResponsibilities: 4,
      },
      preferredRequirements: {
        score: 0,
        maxScore: 5,
        percentage: 0,
        met: 0,
        total: 2,
      },
    },
    atsCompatibility: {
      score: 78,
      maxScore: 100,
      factors: {
        keywordsPresent: 22,
        jobTitleAlignment: 12,
        skillsVisibility: 16,
        experienceVisibility: 12,
        educationVisibility: 10,
        formatting: 6,
      },
      missingKeywords: ['Power BI', 'Manufacturing', 'Product Costing'],
      suggestions: [
        'Clarify depth of SAP CO experience vs other modules',
        'Add manufacturing industry details',
        'Include Power BI skills if available',
      ],
    },
    requirementEvaluations: [
      {
        id: 'req-eval-6',
        requirementId: 'req-1',
        requirement: sampleJobs[0].mandatoryRequirements[0],
        status: RequirementStatus.NEEDS_VERIFICATION,
        confidence: ConfidenceLevel.MEDIUM,
        evidence: [
          {
            id: 'ev-6',
            requirementId: 'req-1',
            candidateId: 'cv-2',
            type: EvidenceType.SEMANTIC,
            text: 'Worked on SAP implementations across FI, CO, and MM modules (7 years total)',
            source: 'Experience - Enterprise Systems Ltd',
            confidence: ConfidenceLevel.MEDIUM,
            matchStrength: 65,
            explanation: 'SAP CO mentioned among multiple modules, but specific CO experience duration unclear',
            experienceId: 'exp-3',
            createdAt: new Date(),
          },
        ],
        hasEvidence: true,
        pointsAwarded: 8,
        maxPoints: 15,
        reason: 'CV mentions SAP CO but does not clearly specify years focused on CO module specifically',
        matchPercentage: 60,
      },
      {
        id: 'req-eval-7',
        requirementId: 'req-2',
        requirement: sampleJobs[0].mandatoryRequirements[1],
        status: RequirementStatus.PARTIALLY_MET,
        confidence: ConfidenceLevel.MEDIUM,
        evidence: [
          {
            id: 'ev-7',
            requirementId: 'req-2',
            candidateId: 'cv-2',
            type: EvidenceType.SEMANTIC,
            text: 'Skills include S/4HANA',
            source: 'Skills section',
            confidence: ConfidenceLevel.MEDIUM,
            matchStrength: 60,
            createdAt: new Date(),
          },
        ],
        hasEvidence: true,
        pointsAwarded: 6,
        maxPoints: 10,
        reason: 'S/4HANA listed in skills but no specific project details or duration provided',
        matchPercentage: 60,
      },
      {
        id: 'req-eval-8',
        requirementId: 'req-3',
        requirement: sampleJobs[0].mandatoryRequirements[2],
        status: RequirementStatus.NOT_FOUND,
        confidence: ConfidenceLevel.LOW,
        evidence: [],
        hasEvidence: false,
        pointsAwarded: 0,
        maxPoints: 10,
        reason: 'No manufacturing industry experience documented. Industries listed: Technology, Retail',
        matchPercentage: 0,
      },
    ],
    scoreDeductions: [
      {
        id: 'ded-3',
        reason: 'Manufacturing experience not found',
        points: 10,
        category: 'Domain',
        requirementId: 'req-3',
      },
      {
        id: 'ded-4',
        reason: 'SAP CO specific experience unclear',
        points: 7,
        category: 'Experience',
        requirementId: 'req-1',
      },
      {
        id: 'ded-5',
        reason: 'No SAP certification',
        points: 3,
        category: 'Certification',
      },
      {
        id: 'ded-6',
        reason: 'Power BI experience not mentioned',
        points: 2,
        category: 'Skills',
      },
    ],
    scoreExplanation:
      'The candidate scored 76/100 due to unclear SAP CO depth and missing manufacturing experience. While candidate has 7 years total SAP experience, the CV does not clearly specify how many years were focused specifically on the CO module. Manufacturing industry experience is not documented. S/4HANA is mentioned but without implementation details. This candidate requires recruiter verification to clarify SAP CO depth and assess industry transferability.',
    strengths: [
      {
        title: 'Long SAP Experience',
        description: '7 years total SAP experience across multiple modules',
      },
      {
        title: 'Multi-Module Knowledge',
        description: 'Experience with FI, CO, and MM modules provides broad SAP understanding',
      },
      {
        title: 'Relevant Education',
        description: "Bachelor's degree in Accounting from UC Berkeley",
      },
    ],
    gaps: [
      {
        title: 'SAP CO Depth Unclear',
        description: 'Years focused specifically on CO module not clearly stated',
        severity: 'High',
        requirementId: 'req-1',
      },
      {
        title: 'No Manufacturing Experience',
        description: 'No documented experience in manufacturing industry (required)',
        severity: 'Critical',
        requirementId: 'req-3',
      },
      {
        title: 'Missing SAP Certification',
        description: 'No SAP certification documented',
        severity: 'Medium',
      },
      {
        title: 'Power BI Not Mentioned',
        description: 'Power BI experience not documented in CV',
        severity: 'Low',
      },
    ],
    mandatoryFailures: [
      {
        id: 'req-eval-8',
        requirementId: 'req-3',
        requirement: sampleJobs[0].mandatoryRequirements[2],
        status: RequirementStatus.NOT_FOUND,
        confidence: ConfidenceLevel.LOW,
        evidence: [],
        hasEvidence: false,
        pointsAwarded: 0,
        maxPoints: 10,
        reason: 'No manufacturing industry experience documented',
        matchPercentage: 0,
      },
    ],
    hasMandatoryFailures: true,
    evaluatedAt: new Date('2024-01-21T11:15:00'),
    evaluatedBy: 'recruiter@techcorp.com',
    evaluationVersion: 1,
  },
  {
    id: 'eval-3',
    candidateId: 'cv-3',
    candidate: sampleCandidates[2],
    jobId: 'jd-1',
    job: sampleJobs[0],
    overallScore: 52,
    matchLevel: MatchLevel.NOT_RECOMMENDED,
    submissionDecision: SubmissionDecision.DO_NOT_SUBMIT,
    submissionReason: 'Candidate does not meet mandatory experience requirements. Only 1.7 years SAP CO experience vs 5+ years required.',
    scoreBreakdown: {
      mandatoryCompliance: {
        score: 18,
        maxScore: 50,
        percentage: 36,
        totalRequirements: 5,
        met: 1,
        partiallyMet: 1,
        notMet: 3,
        notFound: 0,
        needsVerification: 0,
      },
      coreSkills: {
        score: 12,
        maxScore: 20,
        percentage: 60,
        matchedSkills: 3,
        totalSkills: 8,
        matchedTools: 1,
        totalTools: 3,
      },
      relevantExperience: {
        score: 5,
        maxScore: 15,
        percentage: 33,
        totalMonths: 19,
        relevantMonths: 19,
        meetsMinimum: false,
      },
      responsibilities: {
        score: 4,
        maxScore: 10,
        percentage: 40,
        matchedResponsibilities: 2,
        totalResponsibilities: 4,
      },
      preferredRequirements: {
        score: 0,
        maxScore: 5,
        percentage: 0,
        met: 0,
        total: 2,
      },
    },
    atsCompatibility: {
      score: 62,
      maxScore: 100,
      factors: {
        keywordsPresent: 15,
        jobTitleAlignment: 8,
        skillsVisibility: 14,
        experienceVisibility: 9,
        educationVisibility: 10,
        formatting: 6,
      },
      missingKeywords: ['S/4HANA', 'Manufacturing', 'Implementation', 'Power BI', 'Product Costing'],
      suggestions: [
        'Gain more SAP CO experience (currently 1.7 years vs 5+ required)',
        'Pursue SAP certification',
        'Seek manufacturing industry opportunities',
      ],
    },
    requirementEvaluations: [],
    scoreDeductions: [
      {
        id: 'ded-7',
        reason: 'Insufficient SAP CO experience: 1.7 years vs 5+ years required',
        points: 15,
        category: 'Experience',
        requirementId: 'req-1',
      },
      {
        id: 'ded-8',
        reason: 'No S/4HANA experience',
        points: 10,
        category: 'Technical',
        requirementId: 'req-2',
      },
      {
        id: 'ded-9',
        reason: 'No manufacturing experience',
        points: 10,
        category: 'Domain',
        requirementId: 'req-3',
      },
    ],
    scoreExplanation:
      'The candidate scored 52/100 due to insufficient experience for this senior role. Candidate has only 1.7 years of SAP CO experience vs the required 5+ years. No S/4HANA implementation experience and no manufacturing industry exposure. This is an entry-level profile for a senior position.',
    strengths: [
      {
        title: 'Relevant Education',
        description: "Bachelor's degree in Business Administration",
      },
      {
        title: 'SAP CO Foundation',
        description: 'Has basic SAP CO exposure and understanding',
      },
    ],
    gaps: [
      {
        title: 'Insufficient Experience',
        description: 'Only 1.7 years SAP CO experience vs 5+ years required',
        severity: 'Critical',
        requirementId: 'req-1',
      },
      {
        title: 'No S/4HANA Experience',
        description: 'No documented S/4HANA project experience',
        severity: 'Critical',
        requirementId: 'req-2',
      },
      {
        title: 'No Manufacturing Background',
        description: 'No manufacturing industry experience',
        severity: 'Critical',
        requirementId: 'req-3',
      },
      {
        title: 'Entry-Level Profile',
        description: 'This is a junior-level candidate for a senior position',
        severity: 'Critical',
      },
    ],
    mandatoryFailures: [],
    hasMandatoryFailures: true,
    evaluatedAt: new Date('2024-01-22T09:00:00'),
    evaluatedBy: 'recruiter@techcorp.com',
    evaluationVersion: 1,
  },
];

// ============================================================================
// CLIENT PROFILES
// ============================================================================

export const sampleClientProfiles: ClientProfile[] = [
  {
    id: 'client-1',
    clientName: 'TechCorp Industries (Strict)',
    description: 'Manufacturing client with strict mandatory requirements',
    rules: {
      strictMandatory: true,
      technicalSkillsWeight: 1.2,
      certificationsImportant: true,
      experienceWeightMultiplier: 1.1,
      industryExperienceWeight: 1.3,
      allowFlexibleRequirements: false,
    },
    scoringAdjustments: {
      mandatoryWeight: 50,
      skillsWeight: 20,
      experienceWeight: 15,
      responsibilitiesWeight: 10,
      preferredWeight: 5,
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: 'sheetalbedi@tasknera.com',
  },
  {
    id: 'client-2',
    clientName: 'InnovateTech (Flexible)',
    description: 'Tech startup with flexible requirements, values potential',
    rules: {
      strictMandatory: false,
      technicalSkillsWeight: 1.5,
      certificationsImportant: false,
      experienceWeightMultiplier: 0.9,
      industryExperienceWeight: 0.8,
      allowFlexibleRequirements: true,
    },
    scoringAdjustments: {
      mandatoryWeight: 40,
      skillsWeight: 30,
      experienceWeight: 10,
      responsibilitiesWeight: 15,
      preferredWeight: 5,
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: 'sheetalbedi@tasknera.com',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getJobById(id: string): JobDescription | undefined {
  return sampleJobs.find((job) => job.id === id);
}

export function getCandidateById(id: string): CandidateCV | undefined {
  return sampleCandidates.find((cv) => cv.id === id);
}

export function getEvaluationById(id: string): CandidateEvaluation | undefined {
  return sampleEvaluations.find((item) => item.id === id);
}

export function getEvaluationsByJobId(jobId: string): CandidateEvaluation[] {
  return sampleEvaluations.filter((item) => item.jobId === jobId);
}

export function getEvaluationsByCandidateId(candidateId: string): CandidateEvaluation[] {
  return sampleEvaluations.filter((item) => item.candidateId === candidateId);
}

export function getClientProfileById(id: string): ClientProfile | undefined {
  return sampleClientProfiles.find((profile) => profile.id === id);
}

// Export all
export default {
  sampleJobs,
  sampleCandidates,
  sampleEvaluations,
  sampleClientProfiles,
  getJobById,
  getCandidateById,
  getEvaluationById,
  getEvaluationsByJobId,
  getEvaluationsByCandidateId,
  getClientProfileById,
};
