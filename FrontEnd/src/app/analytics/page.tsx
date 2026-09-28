'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30');

  const metrics = [
    { 
      label: 'Evaluations Completed', 
      value: '1,847', 
      change: '+23.4%', 
      trend: 'up',
      accent: 'bg-brand-orange text-white',
      bgLight: 'bg-brand-orange-pale text-brand-orange',
      border: 'border-brand-orange-border'
    },
    { 
      label: 'Average Time to Screen', 
      value: '2.8 min', 
      change: '-45.0%', 
      trend: 'down',
      accent: 'bg-blue-600 text-white',
      bgLight: 'bg-blue-50 text-blue-700',
      border: 'border-blue-200'
    },
    { 
      label: 'Submit Acceptance Rate', 
      value: '91.8%', 
      change: '+8.2%', 
      trend: 'up',
      accent: 'bg-emerald-600 text-white',
      bgLight: 'bg-emerald-50 text-emerald-700',
      border: 'border-emerald-200'
    },
    { 
      label: 'Mandatory Compliance', 
      value: '94.2%', 
      change: '+4.5%', 
      trend: 'up',
      accent: 'bg-purple-600 text-white',
      bgLight: 'bg-purple-50 text-purple-700',
      border: 'border-purple-200'
    },
  ];

  const funnelStages = [
    { stage: 'Raw CVs Uploaded', count: 1847, percentage: 100, barColor: 'bg-brand-charcoal' },
    { stage: 'Deterministic Screening', count: 1348, percentage: 73, barColor: 'bg-brand-orange' },
    { stage: 'Mandatory Passed', count: 980, percentage: 53, barColor: 'bg-amber-500' },
    { stage: 'Submit Recommended', count: 776, percentage: 42, barColor: 'bg-emerald-500' },
    { stage: 'Client Interview Stage', count: 312, percentage: 17, barColor: 'bg-blue-500' },
    { stage: 'Offers & Placements', count: 142, percentage: 8, barColor: 'bg-teal-500' },
  ];

  const departments = [
    { dept: 'Enterprise SAP / ERP', openings: 8, evals: 620, avgScore: '82%', topScore: '96%', color: 'border-brand-orange-border bg-brand-orange-pale/30' },
    { dept: 'Cloud & DevOps', openings: 5, evals: 430, avgScore: '78%', topScore: '92%', color: 'border-blue-200 bg-blue-50/40' },
    { dept: 'Full-Stack Software', openings: 7, evals: 510, avgScore: '84%', topScore: '98%', color: 'border-emerald-200 bg-emerald-50/40' },
    { dept: 'Finance & Systems', openings: 4, evals: 287, avgScore: '76%', topScore: '90%', color: 'border-purple-200 bg-purple-50/40' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col selection:bg-brand-orange-pale selection:text-brand-orange">
      <Header />

      <main className="max-w-screen-xl mx-auto px-6 pt-24 pb-16 flex-1 w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-orange-pale rounded-full text-xs font-bold text-brand-orange mb-2">
              <span className="w-2 h-2 rounded-full bg-brand-orange" />
              Recruitment Intelligence & Trends
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">Talent Analytics</h1>
            <p className="text-sm text-brand-charcoal-3 mt-1">Cross-pipeline metrics, screening velocity, score distribution, and funnel conversion rates</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="px-3.5 py-2 bg-white border border-brand-border rounded-xl text-xs font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-orange/30 shadow-xs"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last Quarter (90 Days)</option>
              <option value="365">Past Year</option>
            </select>

            <Link
              href="/reports"
              className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-xl transition-all shadow-orange"
            >
              Export Report PDF
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {metrics.map((m, i) => (
            <div key={i} className="bg-white border border-brand-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all card-hover-lift">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-brand-charcoal-3 uppercase tracking-wider">{m.label}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${m.bgLight}`}>
                  {m.change}
                </span>
              </div>
              <div className="text-3xl font-extrabold text-brand-charcoal tracking-tight mb-2">{m.value}</div>
              <div className="text-[11px] text-brand-charcoal-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                Compared to previous period
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          {/* Hiring Funnel */}
          <div className="lg:col-span-7 bg-white border border-brand-border rounded-3xl shadow-sm p-7">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-brand-border">
              <div>
                <h2 className="text-base font-bold text-brand-charcoal">Recruitment Screening Funnel</h2>
                <p className="text-xs text-brand-charcoal-3 mt-0.5">Conversion stages from bulk upload to verified recommendation</p>
              </div>
              <span className="text-xs font-bold text-brand-orange bg-brand-orange-pale px-3 py-1 rounded-full">
                42% Submit Yield
              </span>
            </div>

            <div className="space-y-4">
              {funnelStages.map((stage, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-bold text-brand-charcoal">{stage.stage}</span>
                    <span className="text-brand-charcoal-3 font-semibold">{stage.count.toLocaleString()} candidates ({stage.percentage}%)</span>
                  </div>
                  <div className="h-3 bg-brand-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stage.barColor} rounded-full transition-all duration-700`}
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Screening Efficiency Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-brand-charcoal to-brand-charcoal-2 rounded-3xl shadow-xl p-7 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-orange/15 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-brand-orange mb-4 border border-white/10">
                AI Efficiency Index
              </div>
              <h3 className="text-xl font-bold mb-2">Deterministic Scoring Engine</h3>
              <p className="text-xs text-white/70 leading-relaxed mb-6">
                Recruiters save an estimated <strong>14.5 hours per job opening</strong> by replacing manual resume skimming with instant requirement verification and exact text citations.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="text-2xl font-extrabold text-brand-orange">860 hrs</div>
                  <div className="text-[11px] text-white/60 mt-0.5">Recruiter Time Saved</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="text-2xl font-extrabold text-emerald-400">0%</div>
                  <div className="text-[11px] text-white/60 mt-0.5">Scoring Variance</div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-white/60">Fully compliant with EEOC rules</span>
              <Link href="/reports" className="text-xs text-brand-orange font-bold hover:underline">
                View Audit Reports →
              </Link>
            </div>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-white border border-brand-border rounded-3xl shadow-sm p-7">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-brand-border">
            <div>
              <h2 className="text-base font-bold text-brand-charcoal">Performance by Practice Area / Department</h2>
              <p className="text-xs text-brand-charcoal-3 mt-0.5">Active job volume, candidate scores, and benchmark metrics</p>
            </div>
            <Link href="/jobs" className="text-xs text-brand-orange font-bold hover:underline">
              Manage Practice Areas →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {departments.map((d, i) => (
              <div key={i} className={`border rounded-3xl p-6 transition-all card-hover-lift ${d.color}`}>
                <h3 className="text-sm font-bold text-brand-charcoal mb-4">{d.dept}</h3>
                
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-brand-charcoal-3">
                    <span>Active Openings</span>
                    <span className="font-bold text-brand-charcoal">{d.openings} reqs</span>
                  </div>
                  <div className="flex items-center justify-between text-brand-charcoal-3">
                    <span>Evaluations Run</span>
                    <span className="font-bold text-brand-charcoal">{d.evals}</span>
                  </div>
                  <div className="flex items-center justify-between text-brand-charcoal-3">
                    <span>Mean Match Score</span>
                    <span className="font-bold text-emerald-600">{d.avgScore}</span>
                  </div>
                  <div className="flex items-center justify-between text-brand-charcoal-3 pt-2 border-t border-brand-border/60">
                    <span>Highest Single Match</span>
                    <span className="font-extrabold text-brand-orange">{d.topScore}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

