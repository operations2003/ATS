import React, { useState } from 'react';
import { RequirementEvaluation, RequirementStatus, ConfidenceLevel } from '@/types';

interface RequirementTableProps {
  evaluations: RequirementEvaluation[];
  showEvidence?: boolean;
}

export default function RequirementTable({ evaluations, showEvidence = true }: RequirementTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusBadge = (status: any) => {
    const s = String(status || '').toUpperCase().replace(/\s+/g, '_');
    if (s === 'MATCHED' || s === 'FULLY_MET') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs sm:text-sm font-extrabold whitespace-nowrap shadow-2xs">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          MATCHED
        </span>
      );
    }
    if (s === 'PARTIAL' || s === 'PARTIALLY_MET') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs sm:text-sm font-extrabold whitespace-nowrap shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
          PARTIAL
        </span>
      );
    }
    if (s === 'UNKNOWN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 text-xs sm:text-sm font-extrabold whitespace-nowrap shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          UNKNOWN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 text-xs sm:text-sm font-extrabold whitespace-nowrap shadow-2xs">
        <svg className="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
        NOT MATCHED
      </span>
    );
  };

  const getConfidenceText = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case ConfidenceLevel.HIGH:
        return 'High Confidence';
      case ConfidenceLevel.MEDIUM:
        return 'Medium Confidence';
      case ConfidenceLevel.LOW:
        return 'Low Confidence';
      default:
        return String(confidence);
    }
  };

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs font-semibold">
        No specific requirement criteria loaded for this evaluation audit.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evaluations.map((evalItem) => {
        const isExpanded = Boolean(expandedRows[evalItem.id]);
        const hasEvidenceItems = evalItem.hasEvidence && evalItem.evidence && evalItem.evidence.length > 0;

        return (
          <div
            key={evalItem.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 hover:border-slate-300 transition-all shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
          >
            {/* Top row: Priority, Category, Confidence tags + Score pts */}
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {evalItem.requirement.isMandatory ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200">
                    Mandatory
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    Preferred
                  </span>
                )}
                <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {evalItem.requirement.category || 'Technical Skill'}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  • {getConfidenceText(evalItem.confidence)}
                </span>
              </div>

              {/* Large Score Metric on Right */}
              <div className="flex items-center gap-2.5 font-mono text-sm sm:text-base font-black text-slate-900">
                <span>{evalItem.pointsAwarded} / {evalItem.maxPoints} pts</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold ${
                  evalItem.matchPercentage >= 75
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : evalItem.matchPercentage >= 50
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-rose-100 text-rose-900 border border-rose-200'
                }`}>
                  {evalItem.matchPercentage}%
                </span>
              </div>
            </div>

            {/* Middle row: Large Prominent Requirement text + Status Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-2">
              <div className="flex-1 pr-2">
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug tracking-tight">
                  {evalItem.requirement.text}
                </h4>

                {/* Source Evidence Extracted from JD (Primary Matching Context for Mandatory Fields) */}
                {Boolean(evalItem.requirement?.sourceEvidence || (evalItem.requirement as any)?.extractedFrom || (evalItem as any).sourceEvidence) && (
                  <div className={`mt-2 p-2.5 rounded-xl border text-xs ${
                    evalItem.requirement.isMandatory
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 ${evalItem.requirement.isMandatory ? 'text-rose-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${
                        evalItem.requirement.isMandatory ? 'text-rose-700' : 'text-slate-500'
                      }`}>
                        {evalItem.requirement.isMandatory ? 'Mandatory Field Source Evidence (Extracted from JD):' : 'Source Evidence (Extracted from JD):'}
                      </span>
                    </div>
                    <p className="italic text-xs font-mono pl-5">
                      &ldquo;{evalItem.requirement.sourceEvidence || (evalItem.requirement as any).extractedFrom || (evalItem as any).sourceEvidence}&rdquo;
                    </p>
                  </div>
                )}

                {/* AI Semantic Alias & Context Callout */}
                <div className="mt-2 space-y-1.5">
                  {evalItem.matchedAlias && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-900 text-xs font-semibold shadow-2xs">
                      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Semantic AI Match: Verified via synonym/alias <strong className="font-mono text-purple-700 bg-white/70 px-1 py-0.5 rounded border border-purple-200/50">{evalItem.matchedAlias}</strong></span>
                    </div>
                  )}

                  {evalItem.matchReason && !evalItem.matchedAlias && (
                    <div className="text-xs text-slate-600 flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <span className="font-semibold text-slate-700">Verification Match Context: </span>
                        <span>{evalItem.matchReason}</span>
                      </div>
                    </div>
                  )}

                  {evalItem.failureReason && (
                    <div className="text-xs text-rose-800 flex items-start gap-1.5 bg-rose-50/70 p-2 rounded-lg border border-rose-200">
                      <svg className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <span className="font-semibold">Evaluation Flag: </span>
                        <span>{evalItem.failureReason}</span>
                      </div>
                    </div>
                  )}

                  {evalItem.requirement.aliases && evalItem.requirement.aliases.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs text-slate-500">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Accepted Equivalents:</span>
                      {evalItem.requirement.aliases.map((alias, aIdx) => (
                        <span key={aIdx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono border border-slate-200">
                          {alias}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 self-start sm:self-center">
                {getStatusBadge(evalItem.status)}
              </div>
            </div>

            {/* Evidence toggle bar & Progress Bar */}
            {hasEvidenceItems && showEvidence && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => toggleRow(evalItem.id)}
                  className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer border select-none ${
                    isExpanded
                      ? 'bg-orange-50 text-orange-900 border-orange-300 shadow-xs ring-2 ring-orange-500/15'
                      : 'bg-white hover:bg-orange-50/50 text-slate-700 hover:text-orange-900 border-slate-200 hover:border-orange-200 shadow-2xs'
                  }`}
                  aria-expanded={isExpanded}
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-colors duration-200 ${
                      isExpanded ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>

                  <span className="font-semibold">
                    {isExpanded ? 'Hide Verified CV Evidence' : 'Verified Evidence in CV'}
                  </span>

                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold transition-colors ${
                      isExpanded
                        ? 'bg-orange-200/80 text-orange-900'
                        : 'bg-slate-100 group-hover:bg-orange-100 text-slate-600 group-hover:text-orange-800'
                    }`}
                  >
                    {evalItem.evidence.length} {evalItem.evidence.length === 1 ? 'snippet' : 'snippets'}
                  </span>

                  <svg
                    className={`w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600 transition-transform duration-200 ease-out ${
                      isExpanded ? 'rotate-180 text-orange-600' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-400">Match:</span>
                  <div className="w-24 sm:w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        evalItem.matchPercentage >= 75
                          ? 'bg-emerald-600'
                          : evalItem.matchPercentage >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${evalItem.matchPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Expanded Verified Evidence Drawer */}
            {isExpanded && hasEvidenceItems && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] uppercase font-bold tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Extracted CV Verification & Context
                  </span>
                  <span className="text-[10px] lowercase font-normal text-slate-400">
                    {evalItem.evidence.length} {evalItem.evidence.length === 1 ? 'quote found' : 'quotes found'}
                  </span>
                </div>

                {evalItem.evidence.map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/80 to-white text-xs sm:text-sm shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {ev.type || 'Direct Match'}
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {ev.source || 'Candidate Resume Record'}
                        </span>
                      </div>

                      {typeof ev.matchStrength === 'number' && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                          {ev.matchStrength}% Match
                        </span>
                      )}
                    </div>

                    <p className="text-slate-800 font-serif italic text-xs sm:text-sm leading-relaxed pl-3 border-l-2 border-orange-400 bg-orange-50/20 py-1.5 pr-2 rounded-r-md">
                      &ldquo;{ev.text}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
