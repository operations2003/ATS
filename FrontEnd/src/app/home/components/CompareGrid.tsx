'use client';

import React, { useEffect, useRef, useState } from 'react';


interface CompareRow {
  metric: string;
  manual: { value: string; bar: number; note?: string };
  ai:     { value: string; bar: number; note?: string };
}

interface CompareGridProps {
  rows: CompareRow[];
  manualLabel?: string;
  aiLabel?: string;
}

const CompareGrid: React.FC<CompareGridProps> = ({
  rows,
  manualLabel = 'Manual Screening',
  aiLabel = 'HireIQ by TaskNera',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 mb-4">
        <div className="text-[11px] font-700 text-ui-faint uppercase tracking-widest">Metric</div>
        <div className="flex items-center gap-2 text-[11px] font-700 uppercase tracking-widest text-ui-danger/70">
          <span className="w-2 h-2 rounded-full bg-ui-danger/60 inline-block" />
          {manualLabel}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-700 uppercase tracking-widest text-cyan-DEFAULT/80">
          <span className="w-2 h-2 rounded-full bg-cyan-DEFAULT inline-block" />
          {aiLabel}
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={row.metric}
            className="grid grid-cols-[1fr_1fr_1fr] gap-4"
            style={{
              transitionDelay: `${i * 80}ms`,
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            {/* Metric */}
            <div className="flex items-center">
              <span className="text-[13px] font-500 text-ui-muted">{row.metric}</span>
            </div>

            {/* Manual */}
            <div className="compare-cell-bad">
              <p className="text-[16px] font-700 text-ui-danger">{row.manual.value}</p>
              {row.manual.note && (
                <p className="text-[11px] text-ui-faint mt-1">{row.manual.note}</p>
              )}
              <div className="micro-bar mt-2">
                <div
                  className="micro-bar-fill bad"
                  style={{ width: inView ? `${row.manual.bar}%` : '0%' }}
                />
              </div>
            </div>

            {/* AI */}
            <div className="compare-cell-good">
              <p className="text-[16px] font-700 text-cyan-DEFAULT">{row.ai.value}</p>
              {row.ai.note && (
                <p className="text-[11px] text-ui-faint mt-1">{row.ai.note}</p>
              )}
              <div className="micro-bar mt-2">
                <div
                  className="micro-bar-fill good"
                  style={{ width: inView ? `${row.ai.bar}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompareGrid;

