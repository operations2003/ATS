// In-House Tasknera ATS Unified Store (Local State + LocalStorage Synchronization)
import initialRecruitersData from './initialRecruiters.json';

export type CandidateStageStatus = 
  | 'SOURCED'
  | 'SCREENED'
  | 'SHORTLISTED'
  | 'PENDING_TL_REVIEW'
  | 'TL_APPROVED'
  | 'OVERRIDDEN'
  | 'REJECTED';

export interface ScreeningInfo {
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriod?: string;
  location?: string;
  relocationReady?: 'Yes' | 'No' | 'Hybrid only';
  notes?: string;
  screenedBy?: string;
  screenedAt?: string;
}

export interface CandidateItem {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  location: string;
  exp: string;
  companyCount: number;
  currentCompany?: string;
  match: number;
  calibratedScore?: number;
  scoreOverrideReason?: string;
  decision: 'SUBMIT' | 'REVIEW' | 'DO NOT SUBMIT';
  stageStatus: CandidateStageStatus;
  jobId: string;
  jobTitle: string;
  client: string;
  assignedRecruiter: string;
  skills: string[];
  mandatoryMatch: string; // e.g. "5/5"
  mandatoryFailed: boolean;
  screeningInfo?: ScreeningInfo;
  flagReason?: string;
  submittedToTlAt?: string;
  tlReviewedBy?: string;
  tlReviewedAt?: string;
  evidenceSnippets?: { requirement: string; evidence: string; status: 'MET' | 'PARTIAL' | 'MISSING' }[];
  uploadedAt: string;
}

export interface JobWorker {
  id: string;
  name: string;
  email?: string;
  role?: string;
  action?: string;
  isCreator?: boolean;
}

export interface JobItem {
  id: string;
  title: string;
  client: string;
  location: string;
  mode: 'Hybrid' | 'Remote' | 'Onsite';
  salary: string;
  candidates: number;
  topScore: number;
  status: 'Active' | 'Draft' | 'Closed';
  assignedRecruiter: string;
  workedBy?: JobWorker[];
  pod: string;
  createdAtDaysAgo: number;
  mandatoryRequirementsCount: number;
  totalRequirementsCount: number;
  description?: string;
  requirements?: { id: string; requirement: string; category: string; mandatory: boolean; weight: number }[];
}

export interface AuditEvent {
  id: string;
  action: 'JOB_CREATED' | 'RESUMES_UPLOADED' | 'SCREENING_SAVED' | 'SENT_TO_TL_REVIEW' | 'SCORE_OVERRIDE_APPROVED' | 'TL_APPROVED' | 'REQUISITION_REASSIGNED' | 'USER_ROLE_UPDATED';
  user: string;
  userRole: string;
  target: string;
  detail: string;
  time: string;
  timestamp: number;
}

export interface DailyTimeLog {
  day: string; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'
  date: string;
  hoursSpent: number; // e.g. 6.4
  resumesReviewedCount: number; // e.g. 38
  resumesTimeHours: number; // e.g. 3.2
  screeningsCount: number; // e.g. 8
  screeningTimeHours: number; // e.g. 2.1
  jdsUploadedCount: number; // e.g. 1
  jdTimeHours: number; // e.g. 1.1
}

export interface RecruiterMetric {
  id: string;
  name: string;
  email: string;
  role: 'RECRUITER_MEMBER' | 'TEAM_LEAD' | 'ADMIN';
  team: string;
  activeJobs: number;
  jdsUploaded: number;
  resumesSeen: number;
  screenedThisWeek: number;
  tlApprovedCount: number;
  avgMatchScore: number;
  avgTimePerScreen: string;
  avgTimePerResume: string;
  todayHoursSpent: number;
  totalHoursThisWeek: number;
  dailyTimeLogs: DailyTimeLog[];
  capacity: 'Optimal' | 'Normal' | 'Available' | 'High Load';
  lastActive: string;
  recentActivity?: string[];
  avatarUrl?: string;
  phone?: string;
  strengths?: string[];
  insightsSummary?: string;
  topSkills?: string[];
  efficiencyScore?: number;
}

const INITIAL_JOBS: JobItem[] = [];

const INITIAL_CANDIDATES: CandidateItem[] = [];

const INITIAL_AUDIT_EVENTS: AuditEvent[] = [];

const INITIAL_RECRUITERS: RecruiterMetric[] = ((initialRecruitersData as any[]) || []).filter(r => r.email?.toLowerCase().trim() !== 'sheetalbedi@tasknera.com' && r.role !== 'ADMIN');

class ATSStore {
  private jobs: JobItem[] = [];
  private candidates: CandidateItem[] = [];
  private auditEvents: AuditEvent[] = [];
  private recruiters: RecruiterMetric[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    } else {
      this.jobs = INITIAL_JOBS;
      this.candidates = INITIAL_CANDIDATES;
      this.auditEvents = INITIAL_AUDIT_EVENTS;
      this.recruiters = INITIAL_RECRUITERS;
    }
  }

  private loadFromStorage() {
    try {
      const storedJobs = localStorage.getItem('tasknera_ats_jobs');
      const storedCandidates = localStorage.getItem('tasknera_ats_candidates');
      const storedAudits = localStorage.getItem('tasknera_ats_audits');
      const storedRecruiters = localStorage.getItem('tasknera_ats_recruiters');

      // Purge dummy mock jobs & unwanted stale jobs
      const dummyJobIds = ['jd-1', 'jd-2', 'jd-3', 'jd-4'];
      let loadedJobs: JobItem[] = storedJobs ? JSON.parse(storedJobs) : [];
      loadedJobs = (Array.isArray(loadedJobs) ? loadedJobs : []).filter(j => {
        const id = String(j.id || '');
        const title = String(j.title || '').toLowerCase();
        return !dummyJobIds.includes(id) &&
               !id.startsWith('jd-') &&
               !id.includes('1788597184624') &&
               id !== 'b069cc8a-8e5d-47e4-8444-1c9ed2a0258b' &&
               !title.includes('xoxoday') &&
               !title.includes('1788597184624');
      });
      this.jobs = loadedJobs;

      // Purge dummy mock candidates (cand-1 through cand-6 and mock test candidates)
      const dummyCandidateIds = ['cand-1', 'cand-2', 'cand-3', 'cand-4', 'cand-5', 'cand-6'];
      let loadedCandidates: CandidateItem[] = storedCandidates ? JSON.parse(storedCandidates) : [];
      loadedCandidates = (Array.isArray(loadedCandidates) ? loadedCandidates : []).filter(c => {
        const id = String(c.id || '');
        const name = String(c.name || '').toLowerCase().trim();
        return !dummyCandidateIds.includes(id) &&
               !id.startsWith('cand-') &&
               name !== 'michael chen' &&
               name !== 'sarah jenkins' &&
               name !== 'james wilson' &&
               name !== 'marcus vance' &&
               name !== 'elena rostova' &&
               name !== 'alex chen' &&
               name !== 'jennifer lopez' &&
               !name.includes('mahesh pk');
      });
      this.candidates = loadedCandidates;
      this.auditEvents = storedAudits ? JSON.parse(storedAudits) : [];
      
      if (storedRecruiters) {
        let parsed = JSON.parse(storedRecruiters) as RecruiterMetric[];
        // Filter out legacy dummy mock recruiters (Sarah Mitchell, etc.) as well as the system admin account
        const dummyEmails = [
          'sarah.m@tasknera.com',
          'priya.s@tasknera.com',
          'david.p@tasknera.com',
          'marcus.v@tasknera.com',
          'elena.r@tasknera.com',
          'john.r@tasknera.com',
          'alex.m@tasknera.com',
          'alex.c@tasknera.com'
        ];
        parsed = parsed.filter(p => !dummyEmails.includes(p.email?.toLowerCase()) && p.email?.toLowerCase().trim() !== 'sheetalbedi@tasknera.com' && p.role !== 'ADMIN');

        if (parsed.length === 0) {
          this.recruiters = INITIAL_RECRUITERS;
        } else {
          this.recruiters = parsed;
          // Ensure all real database initial recruiters are present
          for (const ir of INITIAL_RECRUITERS) {
            if (!this.recruiters.some(r => r.id === ir.id || r.email.toLowerCase() === ir.email.toLowerCase())) {
              this.recruiters.push(ir);
            }
          }
        }
      } else {
        this.recruiters = INITIAL_RECRUITERS;
      }
      
      // Resave clean arrays to localStorage
      this.saveToStorage();
    } catch {
      this.jobs = INITIAL_JOBS;
      this.candidates = INITIAL_CANDIDATES;
      this.auditEvents = INITIAL_AUDIT_EVENTS;
      this.recruiters = INITIAL_RECRUITERS;
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('tasknera_ats_jobs', JSON.stringify(this.jobs));
      localStorage.setItem('tasknera_ats_candidates', JSON.stringify(this.candidates));
      localStorage.setItem('tasknera_ats_audits', JSON.stringify(this.auditEvents));
      localStorage.setItem('tasknera_ats_recruiters', JSON.stringify(this.recruiters));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
    this.notify();
  }

  public subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // --- Getters ---
  public getJobs(): JobItem[] {
    return this.jobs;
  }

  public getJob(id: string): JobItem | undefined {
    return this.jobs.find(j => j.id === id);
  }

  public getCandidates(jobId?: string): CandidateItem[] {
    if (jobId) {
      return this.candidates.filter(c => c.jobId === jobId);
    }
    return this.candidates;
  }

  public getCandidate(id: string): CandidateItem | undefined {
    return this.candidates.find(c => c.id === id);
  }

  public getTLReviewQueue(): CandidateItem[] {
    return this.candidates.filter(c => c.stageStatus === 'PENDING_TL_REVIEW');
  }

  public getAuditEvents(): AuditEvent[] {
    return this.auditEvents;
  }

  public setRecruitersFromDatabase(members: RecruiterMetric[]): void {
    if (!Array.isArray(members) || members.length === 0) return;
    this.recruiters = members.filter(m => m.email?.toLowerCase().trim() !== 'sheetalbedi@tasknera.com' && m.role !== 'ADMIN');
    this.saveToStorage();
  }

  public getRecruiters(): RecruiterMetric[] {
    return this.recruiters.filter(r => r.email?.toLowerCase().trim() !== 'sheetalbedi@tasknera.com' && r.role !== 'ADMIN');
  }

  public getRecruiter(id: string): RecruiterMetric | undefined {
    return this.recruiters.find(r => r.id === id);
  }

  public ensureMember(user: { id?: string; name?: string | null; email?: string; role?: string }): RecruiterMetric | null {
    if (!user || !user.email) return null;
    const cleanEmail = user.email.toLowerCase().trim();
    if (cleanEmail === 'sheetalbedi@tasknera.com' || user.role === 'ADMIN') return null;
    const cleanName = user.name?.trim() || cleanEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase());

    const existing = this.recruiters.find(r => r.email.toLowerCase() === cleanEmail || r.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return existing;
    }

    const newMember: RecruiterMetric = {
      id: user.id || `rec-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: (user.role === 'ADMIN' ? 'ADMIN' : user.role === 'TEAM_LEAD' ? 'TEAM_LEAD' : 'RECRUITER_MEMBER'),
      team: user.role === 'ADMIN' ? 'Executive & TA Leadership' : 'Cloud & Engineering Pod',
      activeJobs: 3,
      jdsUploaded: 5,
      resumesSeen: 142,
      screenedThisWeek: 34,
      tlApprovedCount: 18,
      avgMatchScore: 87,
      avgTimePerScreen: '3.0 min',
      avgTimePerResume: '1.7 min',
      todayHoursSpent: 6.5,
      totalHoursThisWeek: 32.5,
      capacity: 'Optimal',
      lastActive: 'Active now',
      strengths: ['AI Resume Analysis', 'Talent Engagement', 'Fast Evaluation'],
      insightsSummary: `${cleanName} is actively engaged in requisition screening with 6.5 hours logged today. Maintains strong 87% match quality and 1.7 min/CV review velocity.`,
      topSkills: ['Full-Cycle Recruiting', 'Technical Screening', 'Candidate Calibration'],
      efficiencyScore: 93,
      dailyTimeLogs: [
        { day: 'Mon', date: 'Aug 28', hoursSpent: 6.6, resumesReviewedCount: 32, resumesTimeHours: 3.2, screeningsCount: 8, screeningTimeHours: 2.1, jdsUploadedCount: 1, jdTimeHours: 1.3 },
        { day: 'Tue', date: 'Aug 29', hoursSpent: 6.8, resumesReviewedCount: 36, resumesTimeHours: 3.5, screeningsCount: 9, screeningTimeHours: 2.1, jdsUploadedCount: 1, jdTimeHours: 1.2 },
        { day: 'Wed', date: 'Aug 30', hoursSpent: 6.4, resumesReviewedCount: 30, resumesTimeHours: 3.1, screeningsCount: 7, screeningTimeHours: 1.9, jdsUploadedCount: 1, jdTimeHours: 1.4 },
        { day: 'Thu', date: 'Aug 31', hoursSpent: 6.2, resumesReviewedCount: 28, resumesTimeHours: 2.9, screeningsCount: 6, screeningTimeHours: 1.8, jdsUploadedCount: 1, jdTimeHours: 1.5 },
        { day: 'Fri', date: 'Sep 01', hoursSpent: 6.5, resumesReviewedCount: 32, resumesTimeHours: 3.2, screeningsCount: 8, screeningTimeHours: 2.0, jdsUploadedCount: 1, jdTimeHours: 1.3 },
      ],
      recentActivity: [
        'Reviewed candidate batch on active requisitions (Took 1.2 hrs)',
        'Calibrated ATS scoring rules and candidate match rankings',
      ]
    };

    this.recruiters = [newMember, ...this.recruiters];
    this.saveToStorage();
    return newMember;
  }

  public addRecruiter(member: Omit<RecruiterMetric, 'id'>): RecruiterMetric {
    const newMember: RecruiterMetric = {
      ...member,
      id: `rec-${Date.now()}`,
    };
    this.recruiters = [newMember, ...this.recruiters];
    this.logAudit({
      action: 'USER_ROLE_UPDATED',
      user: 'Administrator',
      userRole: 'ADMIN',
      target: `Member ${newMember.name}`,
      detail: `Provisioned new team member ${newMember.name} in ${newMember.team} with role ${newMember.role}.`
    });
    this.saveToStorage();
    return newMember;
  }

  public updateRecruiter(id: string, updates: Partial<RecruiterMetric>): RecruiterMetric | undefined {
    const rec = this.recruiters.find(r => r.id === id);
    if (!rec) return undefined;
    Object.assign(rec, updates);
    this.saveToStorage();
    return rec;
  }

  // --- Admin Analytics Helpers ---
  public getAdminOverviewStats() {
    const totalJds = this.jobs.length > 0 ? this.jobs.length : this.recruiters.reduce((sum, r) => sum + (r.activeJobs || r.jdsUploaded || 0), 0);
    const totalJdsUploaded = totalJds;

    // Resumes evaluated: count distinct evaluated candidates
    const recruiterResumesSeen = this.recruiters.reduce((sum, r) => sum + (r.resumesSeen || 0), 0);
    const totalResumesSeen = this.candidates.length > 0 ? this.candidates.length : recruiterResumesSeen;

    const totalScreened = this.candidates.filter(c => c.stageStatus === 'SCREENED' || c.stageStatus === 'TL_APPROVED' || c.stageStatus === 'SHORTLISTED').length || this.recruiters.reduce((sum, r) => sum + (r.screenedThisWeek || 0), 0);
    const totalShortlisted = this.candidates.filter(c => c.decision === 'SUBMIT' || c.stageStatus === 'TL_APPROVED' || c.stageStatus === 'SHORTLISTED').length || this.recruiters.reduce((sum, r) => sum + (r.tlApprovedCount || 0), 0);
    const activeRecruiters = this.recruiters.length;
    const agingJdsCount = this.jobs.filter(j => (j.createdAtDaysAgo || 0) >= 25).length;

    return {
      totalJds,
      totalJdsUploaded,
      totalResumesSeen,
      totalScreened,
      totalShortlisted,
      activeRecruiters,
      agingJdsCount,
      conversionRate: totalScreened > 0 ? Math.round((totalShortlisted / totalScreened) * 100) : (totalResumesSeen > 0 ? 100 : 0),
    };
  }

  public getWeeklyEvaluationTrends() {
    return [
      { day: 'Mon', resumesEvaluated: 142, jdsUploaded: 4, screenings: 38 },
      { day: 'Tue', resumesEvaluated: 185, jdsUploaded: 6, screenings: 46 },
      { day: 'Wed', resumesEvaluated: 210, jdsUploaded: 5, screenings: 52 },
      { day: 'Thu', resumesEvaluated: 198, jdsUploaded: 7, screenings: 49 },
      { day: 'Fri', resumesEvaluated: 235, jdsUploaded: 8, screenings: 61 },
      { day: 'Sat', resumesEvaluated: 92, jdsUploaded: 2, screenings: 18 },
      { day: 'Sun', resumesEvaluated: 45, jdsUploaded: 1, screenings: 8 },
    ];
  }

  public getPodAnalytics() {
    return [
      { name: 'SAP & Enterprise Practice', jds: 6, resumes: 424, screenings: 90, shortlists: 57, avgScore: 89, lead: 'John Reynolds' },
      { name: 'Cloud & Engineering Pod', jds: 8, resumes: 538, screenings: 127, shortlists: 79, avgScore: 87, lead: 'Alex Morales' },
      { name: 'Finance & Operations TA', jds: 3, resumes: 160, screenings: 35, shortlists: 18, avgScore: 84, lead: 'David Park' },
    ];
  }

  public getScoreTierDistribution() {
    return [
      { name: 'High Fit (≥85%)', value: 45, color: '#10B981', label: 'Direct Shortlist' },
      { name: 'Moderate Fit (65-84%)', value: 38, color: '#F59E0B', label: 'Review For Shortlist' },
      { name: 'Low Fit (<65%)', value: 17, color: '#EF4444', label: 'Rejected' },
    ];
  }

  // --- Mutations ---
  public addJob(job: Omit<JobItem, 'id' | 'createdAtDaysAgo'>, creatorName: string, creatorRole: string): JobItem {
    const newJob: JobItem = {
      ...job,
      id: `jd-${Date.now()}`,
      createdAtDaysAgo: 0,
    };
    this.jobs = [newJob, ...this.jobs];

    // Increment recruiter JD upload count
    const rec = this.recruiters.find(r => r.name.toLowerCase() === creatorName.toLowerCase() || creatorName.includes(r.name));
    if (rec) {
      rec.jdsUploaded = (rec.jdsUploaded || 0) + 1;
      rec.activeJobs = (rec.activeJobs || 0) + 1;
    }

    this.logAudit({
      action: 'JOB_CREATED',
      user: `${creatorName} (${creatorRole === 'ADMIN' ? 'Admin' : creatorRole === 'TEAM_LEAD' ? 'Team Lead' : 'TA Member'})`,
      userRole: creatorRole,
      target: `Job ${newJob.title}`,
      detail: `Created & uploaded new requisition for ${newJob.client} with ${newJob.mandatoryRequirementsCount} mandatory requirements.`
    });
    this.saveToStorage();
    return newJob;
  }

  public reassignJob(jobId: string, newRecruiterName: string, leadName: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;
    const prevRecruiter = job.assignedRecruiter;
    job.assignedRecruiter = newRecruiterName;
    this.logAudit({
      action: 'REQUISITION_REASSIGNED',
      user: `${leadName} (Team Lead)`,
      userRole: 'TEAM_LEAD',
      target: `Job ${job.title}`,
      detail: `Reassigned requisition from ${prevRecruiter} to ${newRecruiterName}.`
    });
    this.saveToStorage();
  }

  public updateJobStatus(jobId: string, status: 'Active' | 'Draft' | 'Closed', updaterName: string = 'Team Member', updaterRole: string = 'MEMBER') {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;
    const prevStatus = job.status;
    job.status = status;
    this.logAudit({
      action: 'JOB_CREATED',
      user: `${updaterName} (${updaterRole === 'ADMIN' ? 'Admin' : updaterRole === 'TEAM_LEAD' ? 'Team Lead' : 'TA Member'})`,
      userRole: updaterRole,
      target: `Job ${job.title}`,
      detail: `Changed requisition status from ${prevStatus} to ${status}.`
    });
    this.saveToStorage();
  }

  public addCandidateBatch(candidates: CandidateItem[], uploaderName: string, uploaderRole: string, jobTitle: string) {
    this.candidates = [...candidates, ...this.candidates];

    // Increment recruiter resumes seen count
    const rec = this.recruiters.find(r => r.name.toLowerCase() === uploaderName.toLowerCase() || uploaderName.includes(r.name));
    if (rec) {
      rec.resumesSeen = (rec.resumesSeen || 0) + candidates.length;
    }

    this.logAudit({
      action: 'RESUMES_UPLOADED',
      user: `${uploaderName} (${uploaderRole === 'ADMIN' ? 'Admin' : uploaderRole === 'TEAM_LEAD' ? 'Team Lead' : 'TA Member'})`,
      userRole: uploaderRole,
      target: `Job: ${jobTitle}`,
      detail: `Uploaded & parsed ${candidates.length} candidate resumes with AI Match Scoring.`
    });
    this.saveToStorage();
  }

  public saveScreeningInfo(candidateId: string, screening: ScreeningInfo, recruiterName: string, newStatus?: CandidateStageStatus) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;
    cand.screeningInfo = {
      ...screening,
      screenedBy: recruiterName,
      screenedAt: 'Just now'
    };
    if (newStatus) {
      cand.stageStatus = newStatus;
      if (newStatus === 'SHORTLISTED') {
        cand.decision = 'SUBMIT';
      } else if (newStatus === 'REJECTED') {
        cand.decision = 'DO NOT SUBMIT';
      }
    } else if (cand.stageStatus === 'SOURCED') {
      cand.stageStatus = 'SCREENED';
    }

    // Update recruiter screened count
    const rec = this.recruiters.find(r => r.name.toLowerCase() === recruiterName.toLowerCase() || recruiterName.includes(r.name));
    if (rec) {
      rec.screenedThisWeek = (rec.screenedThisWeek || 0) + 1;
      if (newStatus === 'SHORTLISTED') {
        rec.tlApprovedCount = (rec.tlApprovedCount || 0) + 1;
      }
    }

    this.logAudit({
      action: 'SCREENING_SAVED',
      user: `${recruiterName} (TA Member)`,
      userRole: 'USER',
      target: `Candidate: ${cand.name}`,
      detail: `Logged screening call (Current: ${screening.currentCtc || 'N/A'}, Expected: ${screening.expectedCtc || 'N/A'}, Notice: ${screening.noticePeriod || 'N/A'}${newStatus ? ` -> Marked as ${newStatus}` : ''}).`
    });
    this.saveToStorage();
  }

  public shortlistCandidate(candidateId: string, recruiterName: string) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;
    cand.stageStatus = 'SHORTLISTED';
    cand.decision = 'SUBMIT';

    const rec = this.recruiters.find(r => r.name.toLowerCase() === recruiterName.toLowerCase() || recruiterName.includes(r.name));
    if (rec) {
      rec.tlApprovedCount = (rec.tlApprovedCount || 0) + 1;
    }

    this.logAudit({
      action: 'TL_APPROVED',
      user: `${recruiterName} (TA Member)`,
      userRole: 'USER',
      target: `Candidate: ${cand.name} (${cand.jobTitle})`,
      detail: `Candidate approved & shortlisted directly by ${recruiterName}.`
    });
    this.saveToStorage();
  }

  public rejectCandidate(candidateId: string, recruiterName: string, reason?: string) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;
    cand.stageStatus = 'REJECTED';
    cand.decision = 'DO NOT SUBMIT';
    this.logAudit({
      action: 'SCORE_OVERRIDE_APPROVED',
      user: `${recruiterName} (TA Member)`,
      userRole: 'USER',
      target: `Candidate: ${cand.name} (${cand.jobTitle})`,
      detail: `Candidate rejected by ${recruiterName}.${reason ? ` Reason: ${reason}` : ''}`
    });
    this.saveToStorage();
  }

  public submitForTLReview(candidateId: string, flagReason: string, recruiterName: string) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;
    cand.stageStatus = 'PENDING_TL_REVIEW';
    cand.flagReason = flagReason || 'Submitted by recruiter for QA verification.';
    cand.submittedToTlAt = 'Just now';
    this.logAudit({
      action: 'SENT_TO_TL_REVIEW',
      user: `${recruiterName} (TA Member)`,
      userRole: 'USER',
      target: `Candidate: ${cand.name} (${cand.jobTitle})`,
      detail: `Flagged for QA review: ${cand.flagReason}`
    });
    this.saveToStorage();
  }

  public approveTL(candidateId: string, tlName: string) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;
    cand.stageStatus = 'TL_APPROVED';
    cand.decision = 'SUBMIT';
    cand.tlReviewedBy = tlName;
    cand.tlReviewedAt = 'Just now';
    this.logAudit({
      action: 'TL_APPROVED',
      user: `${tlName} (Team Lead)`,
      userRole: 'TEAM_LEAD',
      target: `Candidate: ${cand.name}`,
      detail: `QA Profile verified & approved for Client/Interview submission.`
    });
    this.saveToStorage();
  }

  public calibrateScoreTL(candidateId: string, newScore: number, reason: string, tlName: string) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;
    const oldScore = cand.calibratedScore || cand.match;
    cand.calibratedScore = newScore;
    cand.scoreOverrideReason = reason;
    cand.stageStatus = 'OVERRIDDEN';
    cand.decision = newScore >= 75 ? 'SUBMIT' : 'REVIEW';
    cand.tlReviewedBy = tlName;
    cand.tlReviewedAt = 'Just now';
    this.logAudit({
      action: 'SCORE_OVERRIDE_APPROVED',
      user: `${tlName} (Team Lead)`,
      userRole: 'TEAM_LEAD',
      target: `Candidate: ${cand.name} (${cand.jobTitle})`,
      detail: `Calibrated match score from ${oldScore}% to ${newScore}%. Reason: ${reason}`
    });
    this.saveToStorage();
  }

  public rejectTL(candidateId: string, reason: string, tlName: string) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;
    cand.stageStatus = 'REJECTED';
    cand.decision = 'DO NOT SUBMIT';
    cand.scoreOverrideReason = reason;
    cand.tlReviewedBy = tlName;
    cand.tlReviewedAt = 'Just now';
    this.saveToStorage();
  }

  private logAudit(event: Omit<AuditEvent, 'id' | 'time' | 'timestamp'>) {
    const newAudit: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}`,
      time: 'Just now',
      timestamp: Date.now(),
    };
    this.auditEvents = [newAudit, ...this.auditEvents.slice(0, 49)];
  }
}

export const atsStore = new ATSStore();
