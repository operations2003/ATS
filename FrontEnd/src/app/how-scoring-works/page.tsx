'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function HowScoringWorksPage() {
  const [activeTab, setActiveTab] = useState<'weights' | 'determinism' | 'knockout' | 'audit' | 'controlled-ai'>('weights');

  return (
    <div className="min-h-screen bg-[#EEF2F6] flex flex-col justify-between">
      <Header />
      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="max-w-5xl mx-auto mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold tracking-wide uppercase mb-4 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Evaluation Ruleset v2.1 — Frozen & Deterministic
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          How HireIQ by TaskNera Scoring Works
        </h1>
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
          HireIQ by TaskNera evaluates candidates using a <span className="font-semibold text-slate-900">pure arithmetic, auditable scoring engine</span>. 
          The exact same Job Description and CV input will always produce the exact same score and recommendation, byte-for-byte, forever.
        </p>
      </div>

      {/* Main Pillars Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
            <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">Pure Arithmetic Scoring</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            No generative LLM "guesses" or prompt variance. Scores are derived through transparent algebraic point allocations out of 100 maximum points.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
            <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">Mandatory Knock-Out</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            If a non-negotiable mandatory requirement is unmet, the candidate is strictly capped at <span className="font-semibold text-rose-600">DO NOT SUBMIT</span>, preventing unqualified applicants from slipping through.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
            <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">Cryptographic Audit Hash</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every evaluation produces a deterministic SHA-256 hash. Re-running the evaluation independently verifies exact score reproduction.
          </p>
        </div>
      </div>

      {/* Interactive Tabs Section */}
      <div className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden mb-12">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('weights')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'weights'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            1. The 100-Point Formula
          </button>
          <button
            onClick={() => setActiveTab('determinism')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'determinism'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            2. Deterministic vs. LLM ATS
          </button>
          <button
            onClick={() => setActiveTab('knockout')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'knockout'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            3. Mandatory Knock-Out & Negation
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'audit'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            4. Audits & Recruiter Overrides
          </button>
          <button
            onClick={() => setActiveTab('controlled-ai')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'controlled-ai'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            5. Controlled AI Layer
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8">
          {activeTab === 'weights' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">The 100-Point Deterministic Allocation</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every candidate evaluation follows this exact five-tier arithmetic breakdown. The maximum possible total score is 100.0 points.
                </p>
              </div>

              <div className="space-y-4">
                {/* 1. Mandatory */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-amber-900">Mandatory Compliance (Hard Knock-Out)</span>
                    <span className="text-sm font-extrabold text-amber-900">50 Points Max</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Evaluates non-negotiable core requirements (e.g. required degree, critical stack). Each item is graded as FULLY MET, PARTIALLY MET, or NOT MET. Any NOT MET status halts recommendation at DO NOT SUBMIT.
                  </p>
                </div>

                {/* 2. Core Skills */}
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-blue-900">Core Technical Skills</span>
                    <span className="text-sm font-extrabold text-blue-900">20 Points Max</span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Evaluated via exact word-boundary token matching, canonical skill synonym expansion (e.g., K8s ↔ Kubernetes), and RapidFuzz token set ratio. Non-equivalences (Java ≠ JavaScript) are strictly enforced.
                  </p>
                </div>

                {/* 3. Relevant Experience */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-emerald-900">Relevant Experience Tenure</span>
                    <span className="text-sm font-extrabold text-emerald-900">15 Points Max</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    <span className="font-semibold">Crucial distinction:</span> Total career tenure is computed separately from directly relevant tenure. A candidate with 10 years total experience but only 1 year in the target tech stack receives credit only for the 1 relevant year.
                  </p>
                </div>

                {/* 4. Responsibilities */}
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-purple-900">Responsibilities Alignment</span>
                    <span className="text-sm font-extrabold text-purple-900">10 Points Max</span>
                  </div>
                  <p className="text-xs text-purple-800 leading-relaxed">
                    Measures demonstrated day-to-day execution of responsibilities described in previous roles (e.g., architecture, system delivery, cross-team coordination).
                  </p>
                </div>

                {/* 5. Preferred */}
                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-800">Preferred Criteria (Nice-to-Haves)</span>
                    <span className="text-sm font-extrabold text-slate-800">5 Points Max</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Secondary bonus criteria such as certifications, secondary languages, or specialized domain experience.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'determinism' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Deterministic Engine vs. Generative LLM ATS</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Why HireIQ by TaskNera forbids generative AI in matching and scoring.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                      <th className="py-3 px-4">Dimension</th>
                      <th className="py-3 px-4 text-emerald-700 bg-emerald-50/50">HireIQ by TaskNera Deterministic Engine</th>
                      <th className="py-3 px-4 text-rose-700 bg-rose-50/50">Generic LLM / Chatbot ATS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-3 px-4 font-semibold">Reproducibility</td>
                      <td className="py-3 px-4 bg-emerald-50/30 font-medium text-emerald-900">100% byte-for-byte identical forever</td>
                      <td className="py-3 px-4 bg-rose-50/30 text-rose-800">Changes score across identical runs</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold">Hallucination Risk</td>
                      <td className="py-3 px-4 bg-emerald-50/30 font-medium text-emerald-900">0% — Every claim is tied to an exact quote</td>
                      <td className="py-3 px-4 bg-rose-50/30 text-rose-800">Invented qualifications and fake bullet points</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold">Mandatory Compliance</td>
                      <td className="py-3 px-4 bg-emerald-50/30 font-medium text-emerald-900">Strict knockout condition (DO NOT SUBMIT)</td>
                      <td className="py-3 px-4 bg-rose-50/30 text-rose-800">Soft average masks disqualifying gaps</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold">Auditability</td>
                      <td className="py-3 px-4 bg-emerald-50/30 font-medium text-emerald-900">Cryptographic SHA-256 hash & frozen ruleset</td>
                      <td className="py-3 px-4 bg-rose-50/30 text-rose-800">Black box opaque prompt instructions</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold">Explanation Style</td>
                      <td className="py-3 px-4 bg-emerald-50/30 font-medium text-emerald-900">Formulaic audit table with evidence snippets</td>
                      <td className="py-3 px-4 bg-rose-50/30 text-rose-800">Chatty subjective prose</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'knockout' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Mandatory Knock-Out & NegEx Detection</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  How our deterministic pipeline protects against false positives and misleading resume claims.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Negation Scope Detection (NegEx)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    If a candidate writes: <br />
                    <code className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[11px]">"Proficient in AWS, no experience with Azure."</code>
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A naive keyword search extracts "Azure" as a match. HireIQ by TaskNera's spaCy dependency parser detects the negation cue ("no experience with") and marks Azure as <span className="font-semibold text-rose-600">NOT MET</span>.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Strict Non-Equivalence Catalog
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    Generic vector embeddings often erroneously equate related technologies. HireIQ by TaskNera enforces hard negative rules:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                    <li>Java ≠ JavaScript</li>
                    <li>C ≠ C++ ≠ C#</li>
                    <li>React ≠ React Native</li>
                    <li>SQL ≠ NoSQL</li>
                    <li>Apache Kafka ≠ Apache Spark</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Auditability & Human-in-the-Loop Recruiter Overrides</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Recruiters have ultimate authority to adjust any criterion status while maintaining a permanent audit record.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Recruiter Override Ledger
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When a recruiter overrides a machine status (e.g. from <span className="font-semibold text-amber-700">NOT FOUND</span> to <span className="font-semibold text-emerald-700">FULLY MET</span>), the system records:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="block text-slate-400 font-semibold text-[10px] uppercase">Recruiter ID</span>
                    <span className="font-medium text-slate-800">Captured at auth</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="block text-slate-400 font-semibold text-[10px] uppercase">Original & New</span>
                    <span className="font-medium text-slate-800">Status diff logged</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="block text-slate-400 font-semibold text-[10px] uppercase">Recruiter Notes</span>
                    <span className="font-medium text-slate-800">Mandatory rationale</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="block text-slate-400 font-semibold text-[10px] uppercase">Taxonomy Queue</span>
                    <span className="font-medium text-slate-800">Learns new aliases</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'controlled-ai' && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase mb-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  False-Negative Prevention Architecture
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Limited, Controlled AI Integration</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  AI does not replace the deterministic scoring engine. Instead, AI serves as an isolated semantic bridge to eliminate false rejections caused by vocabulary variations, acronyms, and unstructured job descriptions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pillar 1 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-mono font-bold">1</span>
                    AI-Assisted JD Completion
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Extracts requirements directly supported by the JD text when structured sections are missing. 
                    <strong className="text-slate-800"> Zero Hallucination:</strong> Never invents technologies (e.g. will not add Azure if only AWS is mentioned). 
                    Inferred requirements are strictly marked non-mandatory and never cause hard knockouts.
                  </p>
                </div>

                {/* Pillar 2 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-mono font-bold">2</span>
                    Acronym & Synonym Equivalence
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Recognizes interchangeable terminology such as <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">AWS ↔ Amazon Web Services</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">K8s ↔ Kubernetes</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">CI/CD</code>, and <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">JS ↔ JavaScript</code> without penalizing candidates for wording choices.
                  </p>
                </div>

                {/* Pillar 3 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-mono font-bold">3</span>
                    Three-State Evidence Matching
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Replaces binary guesswork with three explicit states: <span className="font-bold text-emerald-700">MATCH</span>, <span className="font-bold text-amber-700">UNCERTAIN</span>, and <span className="font-bold text-slate-700">NO_MATCH</span>. Ambiguous evidence (such as generic "cloud" for specific 5+ years AWS) is tagged as UNCERTAIN for human review.
                  </p>
                </div>

                {/* Pillar 4 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-mono font-bold">4</span>
                    Strict False-Positive Shields
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Guards against improper credit: <code className="text-rose-700 font-mono">Docker ≠ Kubernetes</code>, <code className="text-rose-700 font-mono">React ≠ JavaScript</code>, and <code className="text-rose-700 font-mono">Java ≠ JavaScript</code>. Related technologies are never credited as direct requirement matches.
                  </p>
                </div>
              </div>

              {/* Bounded Adjustment Formula */}
              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h4 className="text-sm font-extrabold text-indigo-950">Bounded AI Semantic Adjustment Formula</h4>
                  <span className="px-2.5 py-1 bg-indigo-200/80 text-indigo-900 rounded-md font-mono text-xs font-bold">
                    Max Adjustment Cap: +8.0 pts
                  </span>
                </div>
                <div className="font-mono text-xs text-indigo-900 bg-white/80 p-3 rounded-xl border border-indigo-200 mb-3 space-y-1">
                  <div>Final Score = min(100.0, Base Deterministic Score + AI Semantic Adjustment)</div>
                  <div className="text-slate-500 text-[11px]">* If any mandatory requirement fails: AI Semantic Adjustment = 0.0 pts & Final Score ≤ 40.0%</div>
                </div>
                <p className="text-xs text-indigo-900/80 leading-relaxed">
                  The AI layer acts exclusively as a false-negative prevention mechanism. It recovers points for legitimate synonym and phrasing variations, but can never arbitrarily boost an unqualified candidate or bypass mandatory conditions.
                </p>
              </div>

              {/* Graceful Fallback Guarantee */}
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-700">
                <span className="font-bold text-slate-900">100% Graceful Fallback Guarantee:</span>
                <span>If the AI service times out, is offline, or encounters an error, the system automatically falls back to pure deterministic scoring. Evaluations never crash.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-900 rounded-3xl text-white">
        <div>
          <h4 className="text-base font-bold">Ready to evaluate a requisition?</h4>
          <p className="text-xs text-slate-400">Run candidate CVs through our deterministic scoring pipeline with zero score drift.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/jobs"
            className="px-4 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white text-xs font-semibold shadow-md transition-colors"
          >
            Go to Requisitions
          </Link>
          <Link
            href="/evaluations"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            View Evaluation Audits
          </Link>
        </div>
      </div>
      </main>
      <Footer />
    </div>
  );
}
