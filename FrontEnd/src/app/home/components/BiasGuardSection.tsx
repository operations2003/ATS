'use client';

import React from 'react';
import CompareGrid from './CompareGrid';

const BIAS_ROWS = [
  {
    metric: 'Decision audit trail',
    manual: { value: 'None',      bar: 0,  note: 'Recruiter memory is not a legal record' },
    ai:     { value: 'Full log',  bar: 100, note: 'Every score, every signal, timestamped' },
  },
  {
    metric: 'EEOC alignment',
    manual: { value: 'Ad hoc',    bar: 30, note: 'Depends on individual training compliance' },
    ai:     { value: 'Built-in',  bar: 100, note: 'EEOC-aligned scoring criteria, every role' },
  },
  {
    metric: 'Name/school blind',
    manual: { value: 'Rarely',    bar: 15, note: '78% of recruiters admit affinity bias' },
    ai:     { value: 'Always',    bar: 100, note: 'Demographic signals stripped before scoring' },
  },
  {
    metric: 'Disparate impact testing',
    manual: { value: 'Quarterly', bar: 20, note: 'If legal team requires it' },
    ai:     { value: 'Per batch',  bar: 100, note: 'Statistical parity checked on every run' },
  },
];

const BiasGuardSection: React.FC = () => {
  return (
    <section
      id="bias-guard"
      className="py-20 md:py-28 scroll-mt-32"
      style={{ background: 'linear-gradient(180deg, #0D1E38 0%, #0A1628 100%)' }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mb-14">
          <p className="section-label mb-3">03 · Bias Guard</p>
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-700 text-ui-white leading-tight mb-4">
            The audit trail your{' '}
            <span className="text-cyan-DEFAULT italic">legal team will love.</span>
          </h2>
          <p className="text-[1rem] text-ui-muted leading-relaxed">
            Every screening decision Screen makes is logged, explainable, and EEOC-aligned. Demographic signals are stripped before scoring. Disparate impact is tested on every batch — not just when legal asks.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <CompareGrid rows={BIAS_ROWS} />

          {/* Right: Bias guard visual */}
          <div className="space-y-4">
            {/* Audit log preview */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'rgba(27,42,74,0.5)', border: '1px solid rgba(0,212,255,0.12)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-700 text-ui-faint uppercase tracking-widest">
                  Audit Log · Batch #4821
                </p>
                <span className="match-badge">PASS</span>
              </div>

              {[
                { col: 'Candidate ID',     val: '0x4F2A',         ok: true  },
                { col: 'Name signal',      val: 'STRIPPED',        ok: true  },
                { col: 'School signal',    val: 'STRIPPED',        ok: true  },
                { col: 'EEOC criteria',    val: 'v4.2 applied',    ok: true  },
                { col: 'Disparate impact', val: 'p=0.82 (pass)',   ok: true  },
                { col: 'Score',            val: '94.2 / 100',      ok: true  },
              ].map((row) => (
                <div
                  key={row.col}
                  className="flex items-center justify-between py-2 border-b"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                >
                  <span className="text-[12px] text-ui-faint">{row.col}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-600 text-ui-white font-mono">{row.val}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5.5" stroke="#00E5A0" strokeWidth="1"/>
                      <path d="M3.5 6l1.8 1.8L8.5 4" stroke="#00E5A0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* Stat callout */}
            <div
              className="rounded-xl p-5 flex items-center gap-4"
              style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}
            >
              <div className="score-ring flex-shrink-0">
                <span className="text-[15px] font-800 text-cyan-DEFAULT">99.1</span>
              </div>
              <div>
                <p className="text-[15px] font-700 text-ui-white">% audit pass rate</p>
                <p className="text-[12px] text-ui-muted mt-1">
                  Across 500+ hiring cycles. Every batch tested for statistical parity before results are surfaced.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Spoke CTA */}
        <div className="mt-12 flex items-center gap-4">
          <button className="btn-cyan px-6 py-3 text-[14px] font-700 flex items-center gap-2">
            See Your Candidate Stack
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default BiasGuardSection;

