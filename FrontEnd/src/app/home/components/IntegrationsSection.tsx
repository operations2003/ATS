'use client';

import React from 'react';


const ATS_SYSTEMS = [
  { name: 'Workday',     category: 'ATS',       setup: '15 min', color: '#FF6B35' },
  { name: 'Greenhouse',  category: 'ATS',       setup: '8 min',  color: '#3CB371' },
  { name: 'Lever',       category: 'ATS',       setup: '12 min', color: '#5C6BC0' },
  { name: 'iCIMS',       category: 'ATS',       setup: '20 min', color: '#0072CE' },
  { name: 'BambooHR',    category: 'HRIS',      setup: '10 min', color: '#73C41D' },
  { name: 'Rippling',    category: 'HRIS',      setup: '6 min',  color: '#FF5A36' },
  { name: 'Slack',       category: 'Notify',    setup: '3 min',  color: '#E01E5A' },
  { name: 'Zapier',      category: 'Workflow',  setup: '5 min',  color: '#FF4A00' },
];

const COMPARE_ROWS = [
  {
    metric: 'ATS setup time',
    manual: { value: '2–4 weeks', bar: 100, note: 'Enterprise IT involvement required' },
    ai:     { value: '15 min',    bar: 5,   note: 'OAuth + webhook, no IT ticket' },
  },
  {
    metric: 'API access',
    manual: { value: 'N/A',    bar: 0,  note: 'Manual export/import CSV flows' },
    ai:     { value: 'REST + WebSocket', bar: 100, note: 'Real-time ranked results pushed to your ATS' },
  },
  {
    metric: 'Custom field mapping',
    manual: { value: 'Manual', bar: 20, note: 'Spreadsheet reconciliation per role' },
    ai:     { value: 'Auto-map', bar: 95, note: 'Schema detection on first sync' },
  },
];

const IntegrationsSection: React.FC = () => {
  return (
    <section
      id="integrations"
      className="py-20 md:py-28 scroll-mt-32"
      style={{ background: '#0D1E38' }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-14">
          <div className="max-w-xl">
            <p className="section-label mb-3">04 · Integrations</p>
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-700 text-ui-white leading-tight mb-4">
              Plugs into your stack{' '}
              <span className="text-cyan-DEFAULT italic">in 15 minutes.</span>
            </h2>
            <p className="text-[1rem] text-ui-muted leading-relaxed">
              HireIQ by TaskNera connects to every major ATS via OAuth — no IT ticket, no professional services engagement. Ranked results push directly into Greenhouse, Workday, or Lever the moment the batch completes.
            </p>
          </div>
          {/* Technical docs link */}
          <a
            href="#"
            className="flex items-center gap-2 text-[14px] font-600 text-cyan-DEFAULT hover:text-charcoal transition-colors flex-shrink-0 group"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-1 transition-transform">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Read the integration docs
          </a>
        </div>

        {/* ATS logo grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
          {ATS_SYSTEMS.map((ats) => (
            <div
              key={ats.name}
              className="integration-card px-4 py-4 flex items-center justify-between"
            >
              <div>
                <p className="text-[14px] font-600 text-ui-white">{ats.name}</p>
                <p className="text-[10px] text-ui-faint uppercase tracking-widest mt-0.5">{ats.category}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-ui-success font-600">{ats.setup}</p>
                <p className="text-[9px] text-ui-faint">setup</p>
              </div>
            </div>
          ))}
        </div>

        {/* Compare grid */}
        <div className="max-w-3xl">
          <p className="text-[13px] font-600 text-ui-muted mb-6">Integration complexity: HireIQ by TaskNera vs. traditional setup</p>
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 mb-4">
            <div className="text-[11px] font-700 text-ui-faint uppercase tracking-widest">Metric</div>
            <div className="flex items-center gap-2 text-[11px] font-700 uppercase tracking-widest text-ui-danger/70">
              <span className="w-2 h-2 rounded-full bg-ui-danger/60 inline-block" />
              Traditional
            </div>
            <div className="flex items-center gap-2 text-[11px] font-700 uppercase tracking-widest text-cyan-DEFAULT/80">
              <span className="w-2 h-2 rounded-full bg-cyan-DEFAULT inline-block" />
              HireIQ by TaskNera API
            </div>
          </div>
          {COMPARE_ROWS.map((row, i) => (
            <div key={row.metric} className="grid grid-cols-[1fr_1fr_1fr] gap-4 mb-3">
              <div className="flex items-center">
                <span className="text-[13px] font-500 text-ui-muted">{row.metric}</span>
              </div>
              <div className="compare-cell-bad">
                <p className="text-[15px] font-700 text-ui-danger">{row.manual.value}</p>
                {row.manual.note && <p className="text-[11px] text-ui-faint mt-1">{row.manual.note}</p>}
              </div>
              <div className="compare-cell-good">
                <p className="text-[15px] font-700 text-cyan-DEFAULT">{row.ai.value}</p>
                {row.ai.note && <p className="text-[11px] text-ui-faint mt-1">{row.ai.note}</p>}
              </div>
            </div>
          ))}
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

export default IntegrationsSection;

