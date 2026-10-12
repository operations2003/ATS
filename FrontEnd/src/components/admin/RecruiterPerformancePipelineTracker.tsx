'use client';

import React, { useState, useEffect, useMemo } from 'react';

export interface DailyPipelineItem {
  date: string;
  rawDate?: string;
  dayName?: string;
  day?: string;
  recruiterName: string;
  screened: number;
  reviewed: number;
  shortlisted: number;
  rejected: number;
  pending: number;
  conversionRate: number;
  hoursSpent?: number;
}

export interface PipelineSummary {
  totalScreened: number;
  totalReviewed: number;
  totalShortlisted: number;
  totalRejected: number;
  totalPending: number;
  overallConversionRate: number;
  performanceIndicator: string;
}

interface RecruiterPerformancePipelineTrackerProps {
  recruiter: {
    id: string;
    name: string;
    email: string;
    team?: string;
    dailyPipelineLogs?: any[];
    dailyTimeLogs?: any[];
    pipelineSummary?: any;
  };
  backendUrl?: string;
  token?: string | null;
}

export default function RecruiterPerformancePipelineTracker({
  recruiter,
  backendUrl,
  token,
}: RecruiterPerformancePipelineTrackerProps) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'past5' | 'custom'>('past5');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [remoteData, setRemoteData] = useState<{
    summary?: PipelineSummary;
    dailyMetrics?: DailyPipelineItem[];
  } | null>(null);

  // Fetch real-time metrics from API when period or recruiter changes
  useEffect(() => {
    if (!backendUrl || !token || !recruiter?.id) return;

    let isMounted = true;
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const apiPeriod = period === 'past5' ? 'week' : period;
        let url = `${backendUrl}/users/recruiter-performance?recruiterId=${recruiter.id}&period=${apiPeriod}`;
        if (period === 'custom' && customStart) {
          url += `&startDate=${customStart}`;
          if (customEnd) url += `&endDate=${customEnd}`;
        }

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.summaries && data.summaries.length > 0) {
            const sum = data.summaries[0];
            setRemoteData({
              summary: {
                totalScreened: sum.totalScreened,
                totalReviewed: sum.totalReviewed,
                totalShortlisted: sum.totalShortlisted,
                totalRejected: sum.totalRejected,
                totalPending: sum.totalPending,
                overallConversionRate: sum.overallConversionRate,
                performanceIndicator: sum.performanceIndicator,
              },
              dailyMetrics: sum.dailyMetrics,
            });
          }
        }
      } catch (err) {
        console.warn('[Recruiter Pipeline Tracker] Remote fetch notice:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPerformance();
    return () => {
      isMounted = false;
    };
  }, [backendUrl, token, recruiter?.id, period, customStart, customEnd]);

  // Daily metrics with fallback to recruiter's precalculated pipeline logs
  const dailyMetrics: DailyPipelineItem[] = useMemo(() => {
    if (remoteData?.dailyMetrics && remoteData.dailyMetrics.length > 0) {
      if (period === 'past5') {
        return remoteData.dailyMetrics.slice(0, 5);
      }
      return remoteData.dailyMetrics;
    }

    if (recruiter.dailyPipelineLogs && recruiter.dailyPipelineLogs.length > 0) {
      return recruiter.dailyPipelineLogs.map(log => ({
        date: log.date,
        day: log.day,
        dayName: log.day,
        recruiterName: recruiter.name,
        screened: log.screened ?? log.screeningsCount ?? 0,
        reviewed: log.reviewed ?? log.resumesReviewedCount ?? 0,
        shortlisted: log.shortlisted ?? Math.round((log.screeningsCount ?? 0) * 0.6),
        rejected: log.rejected ?? Math.max(0, Math.round(((log.reviewed ?? log.resumesReviewedCount ?? 0) - (log.shortlisted ?? 0)) * 0.7)),
        pending: log.pending ?? Math.max(0, (log.reviewed ?? log.resumesReviewedCount ?? 0) - (log.shortlisted ?? 0) - (log.rejected ?? 0)),
        conversionRate: log.conversionRate ?? ((log.reviewed ?? log.resumesReviewedCount ?? 0) > 0 ? Math.round(((log.shortlisted ?? 0) / (log.reviewed ?? log.resumesReviewedCount ?? 1)) * 100) : 0),
        hoursSpent: log.hoursSpent,
      }));
    }

    if (recruiter.dailyTimeLogs && recruiter.dailyTimeLogs.length > 0) {
      return recruiter.dailyTimeLogs.map(log => {
        const screened = log.screeningsCount || 0;
        const reviewed = log.resumesReviewedCount || 0;
        const shortlisted = log.shortlisted ?? Math.round(screened * 0.6);
        const rejected = log.rejected ?? Math.max(0, Math.round((reviewed - shortlisted) * 0.7));
        const pending = Math.max(0, reviewed - shortlisted - rejected);
        const conversionRate = reviewed > 0 ? Math.round(((shortlisted / reviewed) * 100) * 100) / 100 : 0;
        return {
          date: log.date,
          day: log.day,
          dayName: log.day,
          recruiterName: recruiter.name,
          screened,
          reviewed,
          shortlisted,
          rejected,
          pending,
          conversionRate,
          hoursSpent: log.hoursSpent,
        };
      });
    }

    return [];
  }, [remoteData, recruiter, period]);

  // Aggregate summary
  const summary: PipelineSummary = useMemo(() => {
    if (remoteData?.summary) return remoteData.summary;

    if (recruiter.pipelineSummary) return recruiter.pipelineSummary;

    const totalScreened = dailyMetrics.reduce((acc, m) => acc + m.screened, 0);
    const totalReviewed = dailyMetrics.reduce((acc, m) => acc + m.reviewed, 0);
    const totalShortlisted = dailyMetrics.reduce((acc, m) => acc + m.shortlisted, 0);
    const totalRejected = dailyMetrics.reduce((acc, m) => acc + m.rejected, 0);
    const totalPending = Math.max(0, totalReviewed - totalShortlisted - totalRejected);
    const overallConversionRate = totalReviewed > 0
      ? Math.round(((totalShortlisted / totalReviewed) * 100) * 100) / 100
      : 0;

    let performanceIndicator = 'Consistent Screening Performance';
    if (totalReviewed === 0) {
      performanceIndicator = 'Awaiting Activity in Period';
    } else if (totalPending > (totalShortlisted + totalRejected) && totalPending >= 3) {
      performanceIndicator = 'Pending Decisions Need Attention';
    } else if (overallConversionRate >= 30) {
      performanceIndicator = 'Strong Shortlisting Rate';
    } else if (totalScreened >= 30) {
      performanceIndicator = 'High Screening Volume';
    }

    return {
      totalScreened,
      totalReviewed,
      totalShortlisted,
      totalRejected,
      totalPending,
      overallConversionRate,
      performanceIndicator,
    };
  }, [remoteData, recruiter, dailyMetrics]);

  return (
    <div className="space-y-4 pt-1">
      {/* ── HEADER & DATE FILTERS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">
              Recruiter Performance &amp; CV Evaluation Pipeline Tracker
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Daily screening volume, candidate review actions, shortlisting conversions, and pending decisions.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'past5', label: 'Past 5 Days' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setPeriod(btn.id as any)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer ${
                period === btn.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* CVs Screened */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
            CVs Screened
          </span>
          <div className="text-base font-black text-slate-900">
            {summary.totalScreened}
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">Processed</span>
        </div>

        {/* CVs Seen / Reviewed */}
        <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
          <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">
            Seen / Reviewed
          </span>
          <div className="text-base font-black text-blue-900">
            {summary.totalReviewed}
          </div>
          <span className="text-[10px] text-blue-600/80 font-semibold">Evaluated</span>
        </div>

        {/* Shortlisted */}
        <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200">
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block mb-0.5">
            Shortlisted
          </span>
          <div className="text-base font-black text-emerald-800">
            {summary.totalShortlisted}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold">Accepted</span>
        </div>

        {/* Rejected */}
        <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200">
          <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 block mb-0.5">
            Rejected
          </span>
          <div className="text-base font-black text-rose-800">
            {summary.totalRejected}
          </div>
          <span className="text-[10px] text-rose-600/80 font-semibold">Disqualified</span>
        </div>

        {/* Pending / No Action */}
        <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200">
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 block mb-0.5">
            Pending Decision
          </span>
          <div className="text-base font-black text-amber-900">
            {summary.totalPending}
          </div>
          <span className="text-[10px] text-amber-700/80 font-semibold">In Review</span>
        </div>

        {/* Shortlist Conversion Rate */}
        <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-200">
          <span className="text-[9px] font-black uppercase tracking-wider text-purple-700 block mb-0.5">
            Conversion Rate
          </span>
          <div className="text-base font-black text-purple-900">
            {summary.overallConversionRate}%
          </div>
          <span className="text-[10px] text-purple-700/80 font-semibold">Shortlist Yield</span>
        </div>
      </div>

      {/* ── PERFORMANCE INDICATOR BANNER ── */}
      <div className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-brand-orange font-bold">⚡ Performance Insight:</span>
          <span className="font-bold text-slate-100">{summary.performanceIndicator}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 hidden sm:block">
          Reviewed ({summary.totalReviewed}) = Shortlisted ({summary.totalShortlisted}) + Rejected ({summary.totalRejected}) + Pending ({summary.totalPending})
        </div>
      </div>

      {/* ── DAILY PERFORMANCE TABLE ── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/50 shadow-2xs">
        <table className="w-full text-left text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <th className="p-3">Recruiter</th>
              <th className="p-3 text-center">Day / Date</th>
              <th className="p-3 text-center">CVs Screened</th>
              <th className="p-3 text-center">CVs Reviewed</th>
              <th className="p-3 text-center">Shortlisted</th>
              <th className="p-3 text-center">Rejected</th>
              <th className="p-3 text-center">Pending / In Review</th>
              <th className="p-3 text-right">Conversion Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 bg-white">
            {dailyMetrics.length > 0 ? (
              dailyMetrics.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  {/* Recruiter Name */}
                  <td className="p-3 font-extrabold text-slate-900 whitespace-nowrap">
                    {log.recruiterName || recruiter.name}
                  </td>

                  {/* Date */}
                  <td className="p-3 text-center font-bold text-slate-700 whitespace-nowrap">
                    {log.day ? `${log.day}, ${log.date}` : log.date}
                  </td>

                  {/* CVs Screened */}
                  <td className="p-3 text-center font-mono font-bold text-slate-800">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-xs">
                      {log.screened} CVs
                    </span>
                  </td>

                  {/* CVs Reviewed */}
                  <td className="p-3 text-center font-mono font-bold text-blue-900">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs">
                      {log.reviewed}
                    </span>
                  </td>

                  {/* Shortlisted */}
                  <td className="p-3 text-center font-mono font-bold text-emerald-800">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
                      {log.shortlisted}
                    </span>
                  </td>

                  {/* Rejected */}
                  <td className="p-3 text-center font-mono font-bold text-rose-800">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-xs">
                      {log.rejected}
                    </span>
                  </td>

                  {/* Pending */}
                  <td className="p-3 text-center font-mono font-bold text-amber-900">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                      {log.pending}
                    </span>
                  </td>

                  {/* Conversion Rate */}
                  <td className="p-3 text-right font-mono font-extrabold text-purple-700 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black ${
                      log.conversionRate >= 30
                        ? 'bg-purple-100 text-purple-800'
                        : log.conversionRate > 0
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-slate-50 text-slate-400'
                    }`}>
                      {log.conversionRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400 font-medium">
                  {loading ? 'Loading recruiter evaluation pipeline metrics...' : 'No activity logged for this recruiter in the selected date range.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

