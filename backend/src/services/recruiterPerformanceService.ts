import prisma from '../config/prisma';

export interface DailyPipelineMetric {
  date: string;             // Display date, e.g. "Mon, Oct 05"
  rawDate: string;          // ISO YYYY-MM-DD
  dayName: string;          // "Mon", "Tue", etc.
  recruiterId: string;
  recruiterName: string;
  screened: number;         // Unique CVs screened/processed by recruiter
  reviewed: number;         // Unique candidates reviewed/evaluated
  shortlisted: number;      // Candidates with decision = 'SUBMIT' / 'ACCEPT'
  rejected: number;         // Candidates with decision = 'REJECT' / 'DO NOT SUBMIT'
  pending: number;          // Reviewed candidates awaiting decision: reviewed - shortlisted - rejected
  conversionRate: number;   // (shortlisted / reviewed) * 100, rounded to 2 decimals
}

export interface RecruiterPerformanceSummary {
  recruiterId: string;
  recruiterName: string;
  recruiterEmail: string;
  team: string;
  period: 'today' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  totalScreened: number;
  totalReviewed: number;
  totalShortlisted: number;
  totalRejected: number;
  totalPending: number;
  overallConversionRate: number; // (totalShortlisted / totalReviewed) * 100
  performanceIndicator: string;
  dailyMetrics: DailyPipelineMetric[];
}

/**
 * Formats a Date object into YYYY-MM-DD string
 */
function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date into "Mon, Oct 05"
 */
function formatDisplayDate(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[d.getDay()];
  const monthName = months[d.getMonth()];
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${dayName}, ${monthName} ${dayNum}`;
}

/**
 * Generates an array of Date objects for each day in [start, end]
 */
function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const stop = new Date(end);
  stop.setHours(23, 59, 59, 999);

  while (current <= stop) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Calculates recruiter performance and pipeline metrics for a specific user
 */
export async function getRecruiterPerformance(
  userId: string,
  userOrgId: string,
  period: 'today' | 'week' | 'month' | 'custom' = 'week',
  customStart?: string,
  customEnd?: string
): Promise<RecruiterPerformanceSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      team: true,
      organizationId: true
    }
  });

  if (!user) return null;

  const recruiterName = user.name || user.email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase());
  const now = new Date();

  // Determine start & end bounds
  let startDate: Date;
  let endDate: Date = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  if (period === 'today') {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 29); // 30 days
    startDate.setHours(0, 0, 0, 0);
  } else if (period === 'custom' && customStart) {
    startDate = new Date(customStart);
    startDate.setHours(0, 0, 0, 0);
    if (customEnd) {
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
    }
  } else {
    // Default: 'week' (past 7 days)
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
  }

  // Fetch all evaluations created or evaluated by this user in this date range
  const evaluations = await prisma.evaluation.findMany({
    where: {
      OR: [
        { createdByUserId: userId },
        { evaluatedBy: userId },
        { assignedToUserId: userId }
      ],
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      id: true,
      candidateId: true,
      decision: true,
      score: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Fetch candidates uploaded/created by this user in this date range
  const candidates = await prisma.candidate.findMany({
    where: {
      created_by: userId,
      created_at: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      id: true,
      created_at: true
    }
  });

  // Map activities by date string YYYY-MM-DD
  const dateMap = new Map<string, {
    screenedCandidateIds: Set<string>;
    reviewedCandidateIds: Set<string>;
    shortlistedCandidateIds: Set<string>;
    rejectedCandidateIds: Set<string>;
    pendingCandidateIds: Set<string>;
  }>();

  const allDates = getDateRange(startDate, endDate);
  for (const d of allDates) {
    const key = toDateKey(d);
    dateMap.set(key, {
      screenedCandidateIds: new Set<string>(),
      reviewedCandidateIds: new Set<string>(),
      shortlistedCandidateIds: new Set<string>(),
      rejectedCandidateIds: new Set<string>(),
      pendingCandidateIds: new Set<string>()
    });
  }

  // 1. Ingest candidates uploaded by recruiter (Screened)
  for (const c of candidates) {
    const key = toDateKey(new Date(c.created_at));
    const bucket = dateMap.get(key);
    if (bucket) {
      bucket.screenedCandidateIds.add(c.id);
    }
  }

  // 2. Ingest evaluations
  for (const ev of evaluations) {
    const key = toDateKey(new Date(ev.createdAt));
    const bucket = dateMap.get(key);
    if (bucket) {
      bucket.screenedCandidateIds.add(ev.candidateId);
      bucket.reviewedCandidateIds.add(ev.candidateId);

      const decisionUpper = (ev.decision || 'REVIEW').toUpperCase();
      if (decisionUpper === 'SUBMIT' || decisionUpper === 'ACCEPT') {
        bucket.shortlistedCandidateIds.add(ev.candidateId);
      } else if (decisionUpper === 'REJECT' || decisionUpper === 'DO NOT SUBMIT') {
        bucket.rejectedCandidateIds.add(ev.candidateId);
      } else {
        bucket.pendingCandidateIds.add(ev.candidateId);
      }
    }
  }

  // Construct daily metrics
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyMetrics: DailyPipelineMetric[] = [];

  let totalScreened = 0;
  let totalReviewed = 0;
  let totalShortlisted = 0;
  let totalRejected = 0;
  let totalPending = 0;

  for (const d of allDates) {
    const key = toDateKey(d);
    const bucket = dateMap.get(key);

    const screened = bucket ? bucket.screenedCandidateIds.size : 0;
    const reviewed = bucket ? bucket.reviewedCandidateIds.size : 0;
    const shortlisted = bucket ? bucket.shortlistedCandidateIds.size : 0;
    const rejected = bucket ? bucket.rejectedCandidateIds.size : 0;
    
    // Enforce data consistency: Reviewed = Shortlisted + Rejected + Pending
    const pending = Math.max(0, reviewed - shortlisted - rejected);
    
    const conversionRate = reviewed > 0
      ? Math.round(((shortlisted / reviewed) * 100) * 100) / 100
      : 0;

    totalScreened += screened;
    totalReviewed += reviewed;
    totalShortlisted += shortlisted;
    totalRejected += rejected;
    totalPending += pending;

    dailyMetrics.push({
      date: formatDisplayDate(d),
      rawDate: key,
      dayName: daysOfWeek[d.getDay()],
      recruiterId: user.id,
      recruiterName,
      screened,
      reviewed,
      shortlisted,
      rejected,
      pending,
      conversionRate
    });
  }

  // Sort latest dates first for clean dashboard presentation
  dailyMetrics.reverse();

  // Overall aggregate shortlist conversion rate
  const overallConversionRate = totalReviewed > 0
    ? Math.round(((totalShortlisted / totalReviewed) * 100) * 100) / 100
    : 0;

  // Determine descriptive data-driven performance indicator
  let performanceIndicator = 'Consistent Screening Performance';
  if (totalReviewed === 0 && totalScreened === 0) {
    performanceIndicator = 'Awaiting Activity in Period';
  } else if (totalPending > (totalShortlisted + totalRejected) && totalPending >= 3) {
    performanceIndicator = 'Pending Decisions Need Attention';
  } else if (overallConversionRate >= 30 && totalReviewed >= 5) {
    performanceIndicator = 'Strong Shortlisting Rate';
  } else if (totalScreened >= 30) {
    performanceIndicator = 'High Screening Volume';
  } else if (totalReviewed > 0) {
    performanceIndicator = 'Consistent Evaluation Velocity';
  }

  return {
    recruiterId: user.id,
    recruiterName,
    recruiterEmail: user.email,
    team: user.team || 'General',
    period,
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    totalScreened,
    totalReviewed,
    totalShortlisted,
    totalRejected,
    totalPending,
    overallConversionRate,
    performanceIndicator,
    dailyMetrics
  };
}

/**
 * Calculates performance across all recruiters in an organization
 */
export async function getAllRecruitersPerformance(
  userOrgId: string,
  period: 'today' | 'week' | 'month' | 'custom' = 'week',
  customStart?: string,
  customEnd?: string
): Promise<RecruiterPerformanceSummary[]> {
  const users = await prisma.user.findMany({
    where: {
      organizationId: userOrgId,
      role: { notIn: ['SUPER_ADMIN'] }
    },
    select: { id: true }
  });

  const results: RecruiterPerformanceSummary[] = [];
  for (const u of users) {
    const summary = await getRecruiterPerformance(u.id, userOrgId, period, customStart, customEnd);
    if (summary) {
      results.push(summary);
    }
  }

  return results;
}

