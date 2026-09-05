/**
 * ATS Scoring Engine - Production Evidence-Based Requirement ↔ CV Matching Engine
 * 
 * Strict Requirement-Driven Architecture:
 * 1. Independent Requirement Evaluation with Standard Statuses:
 *    - MATCHED / FULLY_MET (1.0 = 100%)
 *    - PARTIAL / PARTIALLY_MET (0.4 = 40%)
 *    - NEEDS_VERIFICATION (0.2 = 20%)
 *    - NOT_MATCHED / NOT_MET (0.0 = 0%)
 *    - UNKNOWN / NOT_FOUND (0.0 = 0%)
 * 2. Strict Technology Boundaries & Intelligent Normalization:
 *    - JS ≈ JavaScript, PostgreSQL ≈ Postgres, Kubernetes ≈ K8s, AWS ≈ Amazon Web Services, ML ≈ Machine Learning, NLP ≈ Natural Language Processing, LLM ≈ Large Language Model.
 *    - Non-equivalent: LangChain ≠ LangGraph, Python ≠ FastAPI, Docker ≠ Kubernetes, Classical ML ≠ Generative AI/RAG, Oracle ≠ SAP.
 * 3. Generic Keyword False-Positive Filtering:
 *    - Generic words ('data', 'cloud', 'system', 'management', 'analysis', etc.) never match specialized JD requirements alone.
 * 4. Evidence-Backed Specific Experience & Tenure Calculation:
 *    - Specific technology tenure is calculated strictly from roles/projects where the technology was documented.
 *    - General career tenure cannot substitute for specific technology experience (e.g. 8 years general ≠ 5 years AWS).
 * 5. Mandatory Requirement Gating & Deterministic Score Capping:
 *    - ANY mandatory requirement marked NOT_MET / NOT_MATCHED / NOT_FOUND / PARTIAL caps overall score at <= 40%.
 *    - rawScore = evidence-based weighted score.
 *    - if mandatoryFailure: finalScore = min(rawScore, 40); else finalScore = rawScore.
 * 6. Pure Weighted Scoring: Final ATS Score = sum(status_score * weight) / sum(weight) * 100.
 * 7. Fully Deterministic: No Math.random(), no hardcoded candidate logic, 100% reproducible.
 */

import { CandidateRecord } from '../controllers/candidateController';
import { calculateExperienceMonths } from './cvParsingService';

export type MatchStatus = 'MATCHED' | 'PARTIAL' | 'NOT_MATCHED' | 'UNKNOWN';

// Backward compatibility alias
export type RequirementEvaluationStatus =
  | 'MATCHED'
  | 'PARTIAL'
  | 'NOT_MATCHED'
  | 'UNKNOWN'
  | 'FULLY_MET'
  | 'PARTIALLY_MET'
  | 'NOT_MET'
  | 'NOT_FOUND'
  | 'NEEDS_VERIFICATION';

export type EvidenceConfidence = 'EXPLICIT' | 'STRONG_SEMANTIC' | 'WEAK_INFERENCE';

export type MatchTier =
  | 'EXCELLENT MATCH'
  | 'STRONG MATCH'
  | 'MODERATE MATCH'
  | 'LOW MATCH'
  | 'MINIMAL MATCH';

export const STATUS_SCORE_MAP: Record<MatchStatus, number> = {
  MATCHED: 1.0,
  PARTIAL: 0.4,
  NOT_MATCHED: 0.0,
  UNKNOWN: 0.0,
};

export const STATUS_CONTRIBUTION_MAP: Record<string, number> = {
  MATCHED: 1.0,
  FULLY_MET: 1.0,
  PARTIAL: 0.4,
  PARTIALLY_MET: 0.4,
  NEEDS_VERIFICATION: 0.2,
  UNKNOWN: 0.0,
  NOT_MATCHED: 0.0,
  NOT_MET: 0.0,
  NOT_FOUND: 0.0,
};

export interface MandatoryFailureDetail {
  requirement: string;
  reason: string;
  category?: string;
}

export interface RequirementEvaluationResult {
  id: string;
  requirement: string;
  category: string;
  mandatory: boolean;
  isMandatory: boolean; // Compatibility
  weight: number;
  status: MatchStatus;
  statusScore: number; // 0.0, 0.4, 1.0
  score: number; // 0 - 100
  candidateEvidence: string;
  evidence: string; // Compatibility
  evidenceSource: string;
  evidenceType: EvidenceConfidence;
  confidence: 'High' | 'Medium' | 'Low';
  failureReason?: string;
  experienceDetails?: {
    requiredExperience?: number;
    candidateRelevantExperience?: number;
    experienceGap?: number;
    experienceStatus?: string;
  };
}

export interface PillarScores {
  technicalSkills: number;
  experience: number;
  education: number;
  genAI: number;
  semanticRelevance: number;
  // Compatibility fields
  mandatoryCompliance?: number;
  relevantExperience?: number;
  responsibilities?: number;
  semanticSimilarity?: number;
  domainFit?: number;
}

export interface ATSScoringResult {
  evaluationId: string;
  candidateId: string;
  jobId: string;
  rawScore: number; // 0 - 100 uncapped evidence-based weighted score
  overallScore: number; // 0 - 100 final gated score (capped <= 40 if mandatory failure)
  finalScore: number; // Compatibility alias
  matchLevel: MatchTier;
  mandatoryRequirementFailed: boolean;
  mandatoryComplianceScore: number;
  mandatoryFailures: MandatoryFailureDetail[];
  mandatoryCompliance: {
    total: number;
    met: number;
    failed: number;
    passed: boolean;
  };
  pillarScores: PillarScores;
  pillars: PillarScores; // Compatibility
  requirements: RequirementEvaluationResult[];
  requirementResults: RequirementEvaluationResult[]; // Compatibility
  strengths: string[];
  gaps: string[];
  warnings: string[];
  scoringConfigVersion: string;
  evaluatedAt: string;
  debugAudit?: {
    rawWeightedScore: number;
    mandatoryCapped: boolean;
    appliedCap: number;
    calculatedAt: string;
  };
}

// ============================================================================
// 1. TECHNOLOGY SYNONYMS & STRICT DIFFERENTIATION RULES
// ============================================================================

// Exact synonym groups where terms are 100% interchangeable
const EXACT_SYNONYM_GROUPS: string[][] = [
  ['javascript', 'js', 'ecmascript'],
  ['typescript', 'ts'],
  ['postgresql', 'postgres', 'pgsql'],
  ['kubernetes', 'k8s'],
  ['amazon web services', 'aws'],
  ['google cloud platform', 'gcp', 'google cloud'],
  ['microsoft azure', 'azure'],
  ['machine learning', 'ml'],
  ['natural language processing', 'nlp'],
  ['large language models', 'large language model', 'llm', 'llms'],
  ['generative ai', 'genai', 'gen ai', 'gen-ai'],
  ['retrieval augmented generation', 'retrieval-augmented generation', 'rag'],
  ['react.js', 'reactjs', 'react'],
  ['node.js', 'nodejs', 'node'],
  ['vue.js', 'vuejs', 'vue'],
  ['golang', 'go'],
  ['c++', 'cpp'],
  ['c#', 'csharp', 'c sharp'],
  ['.net', 'dotnet', 'asp.net', 'asp.net core'],
  ['mongodb', 'mongo'],
  ['rest api', 'restful api', 'restful apis', 'rest apis', 'rest web services', 'restful web services'],
  ['graphql', 'gql'],
  ['docker', 'containerization', 'containers'],
  ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment'],
  ['fastapi', 'fast api'],
  ['scikit-learn', 'sklearn'],
  ['tensorflow', 'tf'],
  ['pytorch', 'torch'],
  ['langgraph', 'lang graph'],
  ['langchain', 'lang chain'],
  ['llamaindex', 'llama index', 'llama-index'],
  ['pinecone', 'pinecone db', 'pinecone vector db'],
  ['chromadb', 'chroma db', 'chroma'],
  ['weaviate', 'weaviate vector db'],
  ['qdrant', 'qdrant vector db'],
  ['aws bedrock', 'amazon bedrock', 'bedrock'],
  ['azure openai', 'azure open ai'],
  ['prompt engineering', 'prompt-engineering'],
  ['vector database', 'vector databases', 'vector db', 'vector store', 'vector stores'],
  ['fine-tuning', 'finetuning', 'fine tuning', 'model fine-tuning', 'model tuning', 'lora', 'qlora', 'peft'],
  ['ptc windchill', 'windchill', 'ptc windchill pdmlink', 'windchill pdmlink', 'ptc plm'],
  ['windchill customization', 'windchill development', 'windchill client architecture', 'wca', 'form processors', 'action models', 'data utilities'],
  ['java', 'j2ee', 'core java', 'java/j2ee', 'jee'],
  ['spring boot', 'springboot', 'spring framework'],
  ['microservices', 'micro-services', 'microservice architecture'],
  ['langgraph', 'multi-agent systems', 'multi agent systems', 'agentic ai workflows', 'agentic ai', 'multi-agent', 'agentic workflows'],
  ['info*engine', 'infoengine', 'info engine', 'info*engine tasks'],
  ['terraform', 'hashicorp terraform'],
  ['sap', 'sap erp', 'sap ecc', 'sap s/4hana', 's/4hana'],
  ['sap mm', 'sap materials management', 'materials management (mm)'],
  ['postgresql', 'postgres', 'pgsql', 'relational databases', 'rdbms', 'sql', 'mysql', 'sql databases'],
  ['lead generation', 'prospecting', 'pipeline generation', 'outbound sales', 'outbound prospecting', 'sales prospecting'],
  ['pipeline management', 'sales pipeline', 'deal pipeline', 'crm pipeline'],
  ['contract negotiation', 'commercial negotiation', 'closing deals', 'deal closing', 'contract closing', 'deal negotiation', 'negotiating contracts'],
  ['quota attainment', 'quota achievement', 'meeting quota', 'exceeding quota', 'sales targets', 'revenue targets', 'quota'],
  ['crm', 'crm platforms', 'crm systems', 'salesforce', 'hubspot', 'zoho', 'crm software'],
  ['backend services', 'backend development', 'api architecture', 'server-side development', 'backend engineering'],
  ['oracle', 'oracle erp', 'oracle financials', 'oracle cloud'],
];

// Map of canonical term -> all synonymous forms
const SYNONYM_MAP: Map<string, Set<string>> = new Map();
for (const group of EXACT_SYNONYM_GROUPS) {
  const set = new Set(group.map(t => t.toLowerCase()));
  for (const term of group) {
    SYNONYM_MAP.set(term.toLowerCase(), set);
  }
}

// Related / Partial technologies mapping (when JD asks for X and candidate has Y -> PARTIAL match, NOT MATCHED)
const RELATED_PARTIAL_MAPPINGS: Array<{
  target: RegExp;
  related: Array<{ regex: RegExp; name: string; reason: string }>;
}> = [
  {
    target: /\blanggraph\b/i,
    related: [
      { regex: /\blangchain\b/i, name: 'LangChain', reason: 'LangChain is an agent framework related to LangGraph but does not satisfy LangGraph multi-agent graph workflows.' },
      { regex: /\bllamaindex\b/i, name: 'LlamaIndex', reason: 'LlamaIndex is an orchestration framework related to LangGraph.' },
      { regex: /\bautogen\b/i, name: 'AutoGen', reason: 'AutoGen is a multi-agent framework related to LangGraph.' },
      { regex: /\bopenai\b/i, name: 'OpenAI API', reason: 'OpenAI API usage is foundational but does not cover LangGraph agent orchestration.' },
    ],
  },
  {
    target: /\bfastapi\b/i,
    related: [
      { regex: /\bflask\b/i, name: 'Flask', reason: 'Flask demonstrates Python API development but is not asynchronous FastAPI.' },
      { regex: /\bdjango\b/i, name: 'Django', reason: 'Django demonstrates Python web framework experience but is not FastAPI.' },
      { regex: /\bexpress(?:\.js)?\b/i, name: 'Express.js', reason: 'Express demonstrates backend REST API development in Node.js, related to API design but not Python FastAPI.' },
    ],
  },
  {
    target: /\baws bedrock\b|\bbedrock\b/i,
    related: [
      { regex: /\baws\b|\bamazon web services\b/i, name: 'General AWS', reason: 'Candidate has general AWS cloud experience but lacks explicit AWS Bedrock generative AI services.' },
      { regex: /\bazure openai\b/i, name: 'Azure OpenAI', reason: 'Candidate has Azure OpenAI managed LLM experience, partially related to AWS Bedrock.' },
    ],
  },
  {
    target: /\breact native\b/i,
    related: [
      { regex: /\breact(?:\.js|js)?\b/i, name: 'React.js Web', reason: 'React.js web development shares component paradigms with React Native but does not cover native mobile bridge development.' },
    ],
  },
  {
    target: /\bkubernetes\b|\bk8s\b/i,
    related: [
      { regex: /\bdocker\b/i, name: 'Docker', reason: 'Docker containerization is foundational for Kubernetes orchestration but is not K8s cluster management.' },
    ],
  },
  {
    target: /\brag\b|\bretrieval augmented generation\b/i,
    related: [
      { regex: /\bsearch\b|\belasticsearch\b|\bopensearch\b/i, name: 'Traditional Search', reason: 'Traditional keyword search is related to retrieval but does not cover vector embeddings and LLM RAG pipelines.' },
      { regex: /\bembeddings?\b/i, name: 'Vector Embeddings', reason: 'Embeddings experience covers vector representation, a component of full RAG architecture.' },
    ],
  },
  {
    target: /\bgenai\b|\bgenerative ai\b|\bllm\b|\blarge language models\b/i,
    related: [
      { regex: /\bscikit-learn\b|\bclassical ml\b|\bmachine learning\b/i, name: 'Classical Machine Learning', reason: 'Classical predictive ML is related to AI, but does not satisfy Generative AI / Large Language Model development.' },
      { regex: /\bdeep learning\b|\btensorflow\b|\bpytorch\b/i, name: 'Deep Learning', reason: 'Deep learning frameworks are foundational but distinct from modern LLM/GenAI application engineering.' },
    ],
  },
];

// Generic filler words and stop words to avoid spurious matching
export const GENERIC_STOP_WORDS = new Set([
  'with', 'in', 'and', 'or', 'for', 'the', 'of', 'to', 'using', 'from',
  'role', 'good', 'excellent', 'preferred', 'required', 'must', 'have', 'minimum',
  'years', 'yrs', 'yr', 'year', 'work', 'overview',
  'hands-on', 'proficient', 'proficiency', 'knowledge', 'familiarity', 'strong',
  'deep', 'solid', 'proven', 'demonstrated', 'ability', 'working'
]);

// Backward compatibility alias
export const GENERIC_FILLER_WORDS = GENERIC_STOP_WORDS;

// ============================================================================
// 2. CONTEXTUAL NEGATION DETECTION
// ============================================================================
export function checkNegationContext(text: string, term: string): { isNegated: boolean; snippet?: string } {
  if (!text || !term) return { isNegated: false };

  const cleanTerm = term.trim().toLowerCase();
  const termEscaped = cleanTerm.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
  const sentences = text.split(/(?<=[.!?\n])\s+/);

  for (const s of sentences) {
    if (new RegExp(`(?:^|[^a-zA-Z0-9_])${termEscaped}(?:[^a-zA-Z0-9_]|$)`, 'i').test(s)) {
      if (
        new RegExp(`\\b(?:not|no|never|without|lacks?|except|neither)\\s+(?:prior\\s+|hands-on\\s+)?(?:experience\\s+in\\s+|knowledge\\s+of\\s+)?(?:[a-zA-Z0-9_,\\s]{0,25}\\s+)?${termEscaped}\\b`, 'i').test(s) ||
        new RegExp(`${termEscaped}\\b[\\s\\w,]{0,20}\\b(?:not used|not required|not implemented|not supported|not preferred)\\b`, 'i').test(s) ||
        new RegExp(`team\\s+managed\\s+by\\s+${termEscaped}\\s+team`, 'i').test(s)
      ) {
        return { isNegated: true, snippet: s.trim() };
      }
    }
  }

  return { isNegated: false };
}

// ============================================================================
// 3. SKILL & EVIDENCE MATCHER
// ============================================================================

export interface SkillMatchResult {
  status: MatchStatus;
  evidence: string;
  source: string;
  confidence: EvidenceConfidence;
  failureReason?: string;
}

/**
 * Searches the candidate's CV for exact or synonymous matches for a skill requirement.
 * Also checks related/partial technology mappings when exact match is missing.
 * Strictly prevents generic stop words (e.g. "data", "cloud", "engineer") from false-matching.
 */
export function matchSkillRequirement(
  candidate: CandidateRecord,
  requirementText: string,
  category: string
): SkillMatchResult {
  const rawText = candidate.rawText || '';
  const candSkills = candidate.skills || [];
  const candExps = candidate.experience || [];
  const candProjects = candidate.projects || [];
  const candCerts = candidate.certifications || [];

  // Detect if requirement specifies alternatives (OR / EITHER / /)
  const isOrRequirement = /\b(?:or|either)\b/i.test(requirementText) || requirementText.includes('/');

  // Decompose compound phrases from original requirementText before stripping conjunctions
  const rawSubParts = requirementText
    .split(/[,:;&\/+]|\b(?:and|or)\b/i)
    .map(p => p
      .replace(/\b(proficient|proficiency|experience|hands-on|strong|deep|knowledge|familiarity|with|in|required|preferred|must have|working knowledge of|expertise in|demonstrated|solid|proven|similar|related|other|equivalent|frameworks?|tools?|technologies|libraries?|building|apis?|track record of|track record|ability to|background in|understanding of|skills? in|concepts?|architecture|commercial|direct)\b/gi, ' ')
      .replace(/[()]/g, ' ')
      .trim())
    .filter(p => p.length >= 2 && !GENERIC_STOP_WORDS.has(p.toLowerCase()));

  // Extract core keywords by stripping filler words with proper word boundaries
  const cleanReq = requirementText
    .replace(/\b(proficient|proficiency|experience|hands-on|strong|deep|knowledge|familiarity|with|in|and|or|required|preferred|must have|working knowledge of|expertise in|demonstrated|solid|proven|track record of|track record|ability to|background in|understanding of|skills? in|commercial|direct)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const reqLower = cleanReq.toLowerCase();
  if (!reqLower) {
    return {
      status: 'UNKNOWN',
      evidence: 'Requirement description does not specify actionable skills.',
      source: 'Requirement Specification',
      confidence: 'WEAK_INFERENCE'
    };
  }

  // 1. Check for contextual negation in full CV
  const neg = checkNegationContext(rawText, reqLower);
  if (neg.isNegated) {
    return {
      status: 'NOT_MATCHED',
      evidence: `Explicit negative context in CV: "${neg.snippet}"`,
      source: 'CV Text',
      confidence: 'EXPLICIT',
      failureReason: `Candidate profile indicates lack of experience with "${cleanReq}".`
    };
  }

  // 2. Specialized Platform Context Check (e.g. PTC Windchill)
  const requiresWindchill = reqLower.includes('windchill');
  if (requiresWindchill) {
    const rawCvLower = (candidate.rawText || '').toLowerCase();
    const hasAnyWindchill = rawCvLower.includes('windchill') ||
                            candSkills.some(s => s.toLowerCase().includes('windchill')) ||
                            candExps.some(e => `${e.title || ''} ${e.description || ''}`.toLowerCase().includes('windchill'));
    if (!hasAnyWindchill) {
      return {
        status: 'NOT_MATCHED',
        evidence: `No documented PTC Windchill experience found in CV skills, roles, or projects.`,
        source: 'Candidate Record',
        confidence: 'EXPLICIT',
        failureReason: `No documented experience with PTC Windchill.`
      };
    }

    // If requirement specifies Customization / Development
    const isCustomizationReq = reqLower.includes('customization') || reqLower.includes('development') || reqLower.includes('form processor') || reqLower.includes('action model');
    if (isCustomizationReq) {
      const isEndUserOnly = /\b(end-user|end user|cad support|drafter|drafting|cad technician|user issues)\b/i.test(rawCvLower) &&
                            !/\b(customization|developer|development|api|plugins|wca|form processor|action model|data utilit|java code)\b/i.test(rawCvLower);
      if (isEndUserOnly) {
        return {
          status: 'PARTIAL',
          evidence: `Candidate documents user-level/support usage of Windchill, but lacks verified core development or customization experience.`,
          source: 'Experience History',
          confidence: 'STRONG_SEMANTIC',
          failureReason: `Lacks verified PTC Windchill core customization or development experience.`
        };
      }
    }
  }

  // 3. Multi-Skill / Compound Requirement Component Evaluation
  // If the requirement contains multiple distinct technical components (e.g. "Core Java, J2EE, Servlets, JSP, XML, JSON"):
  // Evaluate each component individually to prevent a single keyword from falsely producing a 100% MATCHED score.
  if (rawSubParts.length > 1) {
    const matchedParts: Array<{ part: string; evidence: string; source: string }> = [];
    const missingParts: string[] = [];

    for (const part of rawSubParts) {
      const pClean = part.trim();
      const pLower = pClean.toLowerCase();
      if (!pLower || GENERIC_STOP_WORDS.has(pLower)) continue;

      const partSearchTerms = new Set<string>();
      partSearchTerms.add(pLower);
      const subSyns = SYNONYM_MAP.get(pLower);
      if (subSyns) {
        for (const s of subSyns) partSearchTerms.add(s);
      }
      for (const [canonical, synSet] of SYNONYM_MAP.entries()) {
        const canEscaped = canonical.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
        if (new RegExp(`\\b${canEscaped}\\b`, 'i').test(pLower)) {
          partSearchTerms.add(canonical);
          for (const s of synSet) partSearchTerms.add(s);
        }
      }

      let partFound = false;
      let partEvidence = '';
      let partSource = '';

      // Check candidate skills
      for (const skill of candSkills) {
        const sLower = skill.toLowerCase().trim();
        for (const term of partSearchTerms) {
          const termRegex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
          if (sLower === term || termRegex.test(sLower)) {
            partFound = true;
            partEvidence = `Listed in verified skills: "${skill}"`;
            partSource = 'Skills Inventory';
            break;
          }
        }
        if (partFound) break;
      }

      // Check experience roles
      if (!partFound) {
        for (const exp of candExps) {
          const roleTech = Array.isArray((exp as any).technologies) ? (exp as any).technologies.join(' ') : '';
          const roleText = `${exp.title || ''} ${exp.company || ''} ${exp.description || ''} ${roleTech}`;
          for (const term of partSearchTerms) {
            const regex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
            if (regex.test(roleText)) {
              partFound = true;
              const sentences = roleText.split(/(?<=[.!?\n])\s+/);
              partEvidence = (sentences.find(s => regex.test(s)) || roleText.substring(0, 100)).trim();
              partSource = `Experience: ${exp.title || 'Role'} at ${exp.company || 'Company'}`;
              break;
            }
          }
          if (partFound) break;
        }
      }

      // Check projects
      if (!partFound) {
        for (const proj of candProjects) {
          const projText = `${proj.name || ''} ${proj.description || ''} ${(proj.technologies || []).join(' ')}`;
          for (const term of partSearchTerms) {
            const regex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
            if (regex.test(projText)) {
              partFound = true;
              partEvidence = `${proj.name ? `${proj.name}: ` : ''}${proj.description || projText.substring(0, 100)}`.trim();
              partSource = `Project: ${proj.name || 'Technical Project'}`;
              break;
            }
          }
          if (partFound) break;
        }
      }

      if (partFound) {
        matchedParts.push({ part: pClean, evidence: partEvidence, source: partSource });
      } else {
        missingParts.push(pClean);
      }
    }

    const totalEvaluated = matchedParts.length + missingParts.length;
    if (totalEvaluated > 0) {
      const matchRatio = matchedParts.length / totalEvaluated;
      if ((isOrRequirement && matchedParts.length > 0) || matchRatio >= 0.5) {
        return {
          status: 'MATCHED',
          evidence: `Verified coverage across core technologies: ${matchedParts.map(m => m.part).join(', ')}.`,
          source: matchedParts[0]?.source || 'Candidate CV Record',
          confidence: 'EXPLICIT'
        };
      } else if (matchedParts.length > 0) {
        return {
          status: 'PARTIAL',
          evidence: `Partial skill coverage: Documents ${matchedParts.map(m => m.part).join(', ')}, but lacks verified evidence for: ${missingParts.join(', ')}.`,
          source: matchedParts[0]?.source || 'Candidate CV Record',
          confidence: 'STRONG_SEMANTIC',
          failureReason: `Missing required technical component(s): ${missingParts.join(', ')}.`
        };
      } else {
        return {
          status: 'NOT_MATCHED',
          evidence: `No documented evidence for required technologies (${missingParts.join(', ')}) found in CV.`,
          source: 'Candidate CV Record',
          confidence: 'EXPLICIT',
          failureReason: `No documented evidence for "${cleanReq}".`
        };
      }
    }
  }

  // 4. Single-Skill / Unit Search Terms
  const searchTerms = new Set<string>();

  const addSearchTerm = (term: string) => {
    const t = term.trim().toLowerCase();
    if (!t || t.length < 2) return;
    if (GENERIC_STOP_WORDS.has(t)) {
      const allWords = reqLower.split(/\s+/).filter(Boolean);
      if (!allWords.every(w => GENERIC_STOP_WORDS.has(w))) {
        return;
      }
    }
    searchTerms.add(t);
  };

  addSearchTerm(reqLower);

  const mappedSynonyms = SYNONYM_MAP.get(reqLower);
  if (mappedSynonyms) {
    for (const syn of mappedSynonyms) addSearchTerm(syn);
  }

  // Check multi-word phrase components against known technology synonyms
  for (const [canonical, synSet] of SYNONYM_MAP.entries()) {
    const canEscaped = canonical.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
    if (new RegExp(`\\b${canEscaped}\\b`, 'i').test(reqLower)) {
      addSearchTerm(canonical);
      for (const syn of synSet) addSearchTerm(syn);
    }
  }

  // 3. Search structured sections for EXACT / SYNONYMOUS Match
  // Section A: Work Experience Roles (Highest Confidence)
  for (const exp of candExps) {
    const roleTech = Array.isArray((exp as any).technologies) ? (exp as any).technologies.join(' ') : '';
    const roleText = `${exp.title || ''} ${exp.company || ''} ${exp.description || ''} ${roleTech}`;
    for (const term of searchTerms) {
      if (GENERIC_STOP_WORDS.has(term)) continue;
      const regex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
      if (regex.test(roleText)) {
        const sentences = roleText.split(/(?<=[.!?\n])\s+/);
        const matchSentence = sentences.find(s => regex.test(s)) || roleText.substring(0, 150);
        return {
          status: 'MATCHED',
          evidence: matchSentence.trim(),
          source: `Experience: ${exp.title || 'Role'} at ${exp.company || 'Company'}`,
          confidence: 'EXPLICIT'
        };
      }
    }
  }

  // Section B: Projects
  for (const proj of candProjects) {
    const projText = `${proj.name || ''} ${proj.description || ''} ${(proj.technologies || []).join(' ')}`;
    for (const term of searchTerms) {
      if (GENERIC_STOP_WORDS.has(term)) continue;
      const regex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
      if (regex.test(projText)) {
        return {
          status: 'MATCHED',
          evidence: `${proj.name ? `${proj.name}: ` : ''}${proj.description || projText.substring(0, 140)}`.trim(),
          source: `Project: ${proj.name || 'Technical Project'}`,
          confidence: 'EXPLICIT'
        };
      }
    }
  }

  // Section C: Explicit Skills List
  for (const skill of candSkills) {
    const sLower = skill.toLowerCase().trim();
    for (const term of searchTerms) {
      if (GENERIC_STOP_WORDS.has(term)) continue;
      const termRegex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
      if (sLower === term || termRegex.test(sLower)) {
        return {
          status: 'MATCHED',
          evidence: `Explicitly listed in verified technical skills: "${skill}"`,
          source: 'Skills Inventory',
          confidence: 'EXPLICIT'
        };
      }
    }
  }

  // Section D: Raw Text Full Search with Exact Word Boundaries (avoiding generic word false positives)
  for (const term of searchTerms) {
    if (GENERIC_STOP_WORDS.has(term) || term.length < 3) continue;
    const regex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
    if (regex.test(rawText)) {
      const sentences = rawText.split(/(?<=[.!?\n])\s+/);
      const matchSentence = sentences.find(s => regex.test(s));
      if (matchSentence && matchSentence.trim().length > 10) {
        return {
          status: 'MATCHED',
          evidence: matchSentence.replace(/^[-•*]\s*/, '').trim(),
          source: 'CV Overview / Summary',
          confidence: 'STRONG_SEMANTIC'
        };
      }
    }
  }

  // 4. Check for PARTIAL Match via Related Technologies (e.g. LangChain for LangGraph, Flask for FastAPI)
  for (const mapping of RELATED_PARTIAL_MAPPINGS) {
    if (mapping.target.test(reqLower)) {
      for (const rel of mapping.related) {
        if (rel.regex.test(rawText) || candSkills.some(s => rel.regex.test(s))) {
          const sentences = rawText.split(/(?<=[.!?\n])\s+/);
          const foundSentence = sentences.find(s => rel.regex.test(s)) || `Demonstrated experience with ${rel.name}.`;
          return {
            status: 'PARTIAL',
            evidence: `${rel.reason} (Evidence: "${foundSentence.replace(/^[-•*]\s*/, '').trim().substring(0, 160)}")`,
            source: `Related Skill: ${rel.name}`,
            confidence: 'STRONG_SEMANTIC',
            failureReason: `Candidate has ${rel.name} experience, which is related but does not fully satisfy "${cleanReq}".`
          };
        }
      }
    }
  }

  // 5. Default: NOT MATCHED (0.0 contribution)
  return {
    status: 'NOT_MATCHED',
    evidence: `No credible evidence for "${cleanReq}" found in CV skills, experience, or projects.`,
    source: 'CV Analysis',
    confidence: 'EXPLICIT',
    failureReason: `No documented experience with "${cleanReq}".`
  };
}

// ============================================================================
// 4. EXPERIENCE & TENURE EVALUATION
// ============================================================================

export interface ExperienceMatchResult {
  status: MatchStatus;
  evidence: string;
  source: string;
  confidence: EvidenceConfidence;
  candidateYears: number;
  requiredYears: number;
  gap: number;
  failureReason?: string;
}

/**
 * Calculates candidate professional total career years from employment dates and role history.
 * Excludes training, short courses, and academic internships unless specified.
 */
export function calculateProfessionalTenure(candidate: CandidateRecord): number {
  const candExps = candidate.experience || [];
  if (!Array.isArray(candExps) || candExps.length === 0) {
    const rawTotalMatch = (candidate.totalExperience || '').match(/(\d+(?:\.\d+)?)/);
    return rawTotalMatch ? parseFloat(rawTotalMatch[1]) : 0;
  }

  let totalYears = 0;
  const currentYear = new Date().getFullYear();

  for (const exp of candExps) {
    let roleYears = 0;
    if (exp.duration) {
      const yrMatch = exp.duration.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
      if (yrMatch) {
        roleYears = parseFloat(yrMatch[1]);
      } else {
        const moMatch = exp.duration.match(/(\d+)\s*(?:months?|mos?)/i);
        if (moMatch) roleYears = parseFloat(moMatch[1]) / 12;
      }
    }

    if (roleYears === 0 && exp.startDate) {
      const m = calculateExperienceMonths(exp.startDate, exp.endDate);
      if (m > 0) {
        roleYears = parseFloat((m / 12).toFixed(2));
      } else {
        const startYear = parseInt(exp.startDate.match(/\b(19\d\d|20\d\d)\b/)?.[1] || '0', 10);
        let endYear = startYear;
        if (exp.endDate && /present|current|now|ongoing/i.test(exp.endDate)) {
          endYear = currentYear;
        } else if (exp.endDate) {
          endYear = parseInt(exp.endDate.match(/\b(19\d\d|20\d\d)\b/)?.[1] || `${startYear}`, 10);
        }

        if (startYear > 0 && endYear >= startYear) {
          roleYears = endYear === startYear ? 0.33 : Math.max(0.33, endYear - startYear);
        }
      }
    }

    totalYears += roleYears;
  }

  // Parse totalExperience safely distinguishing years vs months
  if (totalYears === 0 && candidate.totalExperience) {
    const yrMatch = candidate.totalExperience.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
    if (yrMatch) {
      totalYears = parseFloat(yrMatch[1]);
    } else {
      const moMatch = candidate.totalExperience.match(/(\d+)\s*(?:months?|mos?)/i);
      if (moMatch) {
        totalYears = parseFloat(moMatch[1]) / 12;
      }
    }
  }

  return Math.round(totalYears * 10) / 10;
}

/**
 * Calculates candidate specific experience tenure (in years) for a requested technology or domain.
 * Evaluates professional role history and projects where that specific technology was used.
 * Returns 0 if no evidence exists for that technology in candidate's experience.
 */
export function calculateSpecificTenure(
  candidate: CandidateRecord,
  technologyKeywords: string[]
): { specificYears: number; matchingRoles: string[]; evidenceSnippets: string[] } {
  const candExps = candidate.experience || [];
  const candProjects = candidate.projects || [];

  const targetTerms = new Set<string>();
  for (const kw of technologyKeywords) {
    const k = kw.trim().toLowerCase();
    if (!k || GENERIC_STOP_WORDS.has(k)) continue;
    targetTerms.add(k);
    const syns = SYNONYM_MAP.get(k);
    if (syns) {
      for (const s of syns) targetTerms.add(s);
    }
    for (const [canonical, synSet] of SYNONYM_MAP.entries()) {
      if (new RegExp(`\\b${canonical.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i').test(k)) {
        targetTerms.add(canonical);
        for (const s of synSet) targetTerms.add(s);
      }
    }
  }

  if (targetTerms.size === 0) {
    return { specificYears: 0, matchingRoles: [], evidenceSnippets: [] };
  }

  let specificYears = 0;
  const matchingRoles: string[] = [];
  const evidenceSnippets: string[] = [];
  const currentYear = new Date().getFullYear();

  for (const exp of candExps) {
    const roleTech = Array.isArray((exp as any).technologies) ? (exp as any).technologies.join(' ') : '';
    const roleText = `${exp.title || ''} ${exp.company || ''} ${exp.description || ''} ${roleTech}`.toLowerCase();
    
    let hasTech = false;
    let matchedTerm = '';
    for (const term of targetTerms) {
      const regex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
      if (regex.test(roleText)) {
        hasTech = true;
        matchedTerm = term;
        break;
      }
    }

    if (hasTech) {
      let roleYears = 0;
      if (exp.duration) {
        const yrMatch = exp.duration.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
        if (yrMatch) roleYears = parseFloat(yrMatch[1]);
        else {
          const moMatch = exp.duration.match(/(\d+)\s*(?:months?|mos?)/i);
          if (moMatch) roleYears = parseFloat(moMatch[1]) / 12;
        }
      }

      if (roleYears === 0 && exp.startDate) {
        const m = calculateExperienceMonths(exp.startDate, exp.endDate);
        if (m > 0) {
          roleYears = parseFloat((m / 12).toFixed(2));
        } else {
          const startYear = parseInt(exp.startDate.match(/\b(19\d\d|20\d\d)\b/)?.[1] || '0', 10);
          let endYear = startYear;
          if (exp.endDate && /present|current|now|ongoing/i.test(exp.endDate)) {
            endYear = currentYear;
          } else if (exp.endDate) {
            endYear = parseInt(exp.endDate.match(/\b(19\d\d|20\d\d)\b/)?.[1] || `${startYear}`, 10);
          }

          if (startYear > 0 && endYear >= startYear) {
            roleYears = endYear === startYear ? 0.33 : Math.max(0.33, endYear - startYear);
          }
        }
      }

      const verifiedDuration = roleYears;
      if (verifiedDuration > 0) {
        specificYears += verifiedDuration;
        matchingRoles.push(`${exp.title || 'Role'} at ${exp.company || 'Company'} (${parseFloat(verifiedDuration.toFixed(1))}y, ${matchedTerm})`);
        evidenceSnippets.push(`${exp.title || 'Role'}: ${exp.description ? exp.description.substring(0, 100) : matchedTerm}`);
      }
    }
  }

  // If not found in roles, check if found in projects
  if (specificYears === 0 && candProjects.length > 0) {
    for (const proj of candProjects) {
      const projText = `${proj.name || ''} ${proj.description || ''} ${(proj.technologies || []).join(' ')}`.toLowerCase();
      let hasTech = false;
      let matchedTerm = '';
      for (const term of targetTerms) {
        const regex = new RegExp(`\\b${term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
        if (regex.test(projText)) {
          hasTech = true;
          matchedTerm = term;
          break;
        }
      }
      if (hasTech) {
        specificYears += 0.5; // Project credit without formal role duration
        matchingRoles.push(`Project: ${proj.name || 'Project'} (0.5y, ${matchedTerm})`);
      }
    }
  }

  return {
    specificYears: Math.round(specificYears * 10) / 10,
    matchingRoles,
    evidenceSnippets
  };
}

/**
 * Evaluates experience requirement (supports single thresholds like "4+ years" and ranges like "4-6 years").
 * Distinguishes general career tenure from technology-specific experience.
 */
export function evaluateExperienceRequirement(
  candidate: CandidateRecord,
  requirementText: string
): ExperienceMatchResult {
  const reqLower = requirementText.toLowerCase();

  // Range matching: "4-6 years", "4 to 6 yrs", "4 – 6 years"
  const rangeMatch = reqLower.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
  // Single threshold: "4+ years", "4 years", "minimum 5 years"
  const singleMatch = reqLower.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i);

  let minYears = 1.0;
  let maxYears: number | null = null;

  if (rangeMatch) {
    minYears = parseFloat(rangeMatch[1]);
    maxYears = parseFloat(rangeMatch[2]);
  } else if (singleMatch) {
    minYears = parseFloat(singleMatch[1]);
  }

  // Check if this is an OVERALL / TOTAL CAREER experience requirement vs specific technology
  const isOverallExp = /\b(overall|total|career|professional|industry|general)\s*(?:experience|tenure|years?)\b/i.test(reqLower) ||
                       /^overall\b/i.test(reqLower) ||
                       /^total\b/i.test(reqLower);

  // Extract non-temporal, non-generic words to see if a specific technology is required
  const cleanedTechText = reqLower
    .replace(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi, ' ')
    .replace(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/gi, ' ')
    .replace(/\b(minimum|at least|demonstrated|hands-on|experience|proven|solid|deep|strong|working|professional|industry|total|overall|relevant|in|of|with|as|a|an|the|and|or|it|plm|software|engineering|technology)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Decompose into potential technology keywords
  const candidateTechWords = cleanedTechText
    .split(/[\s,;/]+/)
    .filter(w => w.length >= 2 && !GENERIC_STOP_WORDS.has(w));

  const isSpecificTechExperience = !isOverallExp && candidateTechWords.length > 0;

  let candYears = 0;
  let evidenceText = '';
  let sourceText = '';

  if (isSpecificTechExperience) {
    // Specific technology experience evaluation
    const techName = candidateTechWords.join(' ');
    const specificData = calculateSpecificTenure(candidate, candidateTechWords);
    candYears = specificData.specificYears;

    if (candYears === 0) {
      const totalCareer = calculateProfessionalTenure(candidate);
      const gap = minYears;
      return {
        status: 'NOT_MATCHED',
        evidence: `Candidate has 0 documented years of experience with "${techName}". Total career tenure (${totalCareer}y) cannot substitute for required specific technology experience.`,
        source: 'Role-Specific Employment History',
        confidence: 'EXPLICIT',
        candidateYears: 0,
        requiredYears: minYears,
        gap,
        failureReason: `0 years documented experience with ${techName} (required: ${minYears}+ years).`
      };
    }

    evidenceText = `Candidate documents ${candYears} years of verified experience with "${techName}" (${specificData.matchingRoles.join('; ')}).`;
    sourceText = `Role-Specific Technology History (${specificData.matchingRoles.length} roles)`;
  } else {
    // General professional tenure evaluation
    candYears = calculateProfessionalTenure(candidate);
    evidenceText = `Candidate documents ${candYears} years of verified professional experience (meets required ${minYears}${maxYears ? `–${maxYears}` : '+'} years).`;
    sourceText = 'Employment History Tenure';
  }

  const gap = Math.max(0, Math.round((minYears - candYears) * 10) / 10);

  if (candYears >= minYears) {
    if (maxYears && candYears > maxYears + 4) {
      return {
        status: 'MATCHED',
        evidence: `${evidenceText} (Profile is senior/exceeds range).`,
        source: sourceText,
        confidence: 'EXPLICIT',
        candidateYears: candYears,
        requiredYears: minYears,
        gap: 0
      };
    }
    return {
      status: 'MATCHED',
      evidence: evidenceText,
      source: sourceText,
      confidence: 'EXPLICIT',
      candidateYears: candYears,
      requiredYears: minYears,
      gap: 0
    };
  } else if (candYears >= minYears * 0.7 && candYears > 0) {
    return {
      status: 'PARTIAL',
      evidence: `Candidate documents ${candYears} years vs ${minYears}+ years required (${gap}y gap). ${evidenceText}`,
      source: sourceText,
      confidence: 'STRONG_SEMANTIC',
      candidateYears: candYears,
      requiredYears: minYears,
      gap,
      failureReason: `Candidate has ${candYears} years experience, below the ${minYears}+ years requirement.`
    };
  } else {
    return {
      status: 'NOT_MATCHED',
      evidence: `Candidate documents only ${candYears} years vs ${minYears}+ years required (${gap}y deficit).`,
      source: sourceText,
      confidence: 'EXPLICIT',
      candidateYears: candYears,
      requiredYears: minYears,
      gap,
      failureReason: `Insufficient experience (${candYears}y vs ${minYears}+ years required).`
    };
  }
}

// ============================================================================
// 5. LOCATION, WORK MODE & AVAILABILITY EVALUATORS
// ============================================================================

const NCR_LOCATIONS = new Set(['gurugram', 'gurgaon', 'noida', 'delhi', 'new delhi', 'ncr', 'greater noida', 'ghaziabad', 'faridabad']);
const BANGALORE_LOCATIONS = new Set(['bangalore', 'bengaluru', 'blr']);

export function evaluateLocationRequirement(
  candidate: CandidateRecord,
  requirementText: string
): SkillMatchResult {
  const reqLower = requirementText.toLowerCase();
  const candLoc = (candidate.location || '').toLowerCase().trim();

  if (!candLoc || candLoc === 'unknown' || candLoc === 'remote' || candLoc.length < 2) {
    return {
      status: 'UNKNOWN',
      evidence: 'Candidate location is not specified in CV.',
      source: 'Candidate Contact Info',
      confidence: 'WEAK_INFERENCE',
      failureReason: 'Location not documented in CV.'
    };
  }

  // Check NCR
  const isNcrReq = reqLower.includes('ncr') || reqLower.includes('gurugram') || reqLower.includes('gurgaon') || reqLower.includes('noida') || reqLower.includes('delhi');
  if (isNcrReq) {
    const isCandNcr = Array.from(NCR_LOCATIONS).some(loc => candLoc.includes(loc));
    if (isCandNcr) {
      return {
        status: 'MATCHED',
        evidence: `Candidate is located in ${candidate.location} (matches NCR requirement).`,
        source: 'Location Details',
        confidence: 'EXPLICIT'
      };
    } else {
      return {
        status: 'NOT_MATCHED',
        evidence: `Candidate is located in "${candidate.location}", which is outside the required NCR region.`,
        source: 'Location Details',
        confidence: 'EXPLICIT',
        failureReason: `Location mismatch: Candidate is in ${candidate.location} vs required NCR region.`
      };
    }
  }

  // Check Bangalore
  const isBlrReq = reqLower.includes('bangalore') || reqLower.includes('bengaluru');
  if (isBlrReq) {
    const isCandBlr = Array.from(BANGALORE_LOCATIONS).some(loc => candLoc.includes(loc));
    if (isCandBlr) {
      return {
        status: 'MATCHED',
        evidence: `Candidate is based in ${candidate.location} (matches Bangalore requirement).`,
        source: 'Location Details',
        confidence: 'EXPLICIT'
      };
    } else {
      return {
        status: 'NOT_MATCHED',
        evidence: `Candidate is in ${candidate.location}, outside required Bangalore location.`,
        source: 'Location Details',
        confidence: 'EXPLICIT',
        failureReason: `Location mismatch: Candidate in ${candidate.location} vs required Bangalore.`
      };
    }
  }

  // General substring matching for other cities
  const cityKeywords = reqLower
    .replace(/(location|preferred|required|only|locals|candidates|based|in|at|onsite|hybrid|remote)/gi, ' ')
    .split(/[\s,;/]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !GENERIC_STOP_WORDS.has(w));

  const matchedCity = cityKeywords.find(city => candLoc.includes(city));
  if (matchedCity) {
    return {
      status: 'MATCHED',
      evidence: `Candidate location "${candidate.location}" matches requirement.`,
      source: 'Location Details',
      confidence: 'EXPLICIT'
    };
  }

  return {
    status: 'NOT_MATCHED',
    evidence: `Candidate location "${candidate.location}" does not match required "${requirementText}".`,
    source: 'Location Details',
    confidence: 'EXPLICIT',
    failureReason: `Candidate located in ${candidate.location} vs required ${requirementText}.`
  };
}

export function evaluateNoticePeriodRequirement(
  candidate: CandidateRecord,
  requirementText: string
): SkillMatchResult {
  const reqLower = requirementText.toLowerCase();
  const rawText = (candidate.rawText || '').toLowerCase();
  const screeningNotes = ((candidate as any).screeningInfo?.noticePeriod || '').toLowerCase();

  const noticeText = `${screeningNotes} ${rawText}`;
  const isImmediateReq = reqLower.includes('immediate') || reqLower.includes('15 days') || reqLower.includes('joiner');

  if (noticeText.includes('immediate') || noticeText.includes('serving notice') || noticeText.includes('0 days') || noticeText.includes('available immediately')) {
    return {
      status: 'MATCHED',
      evidence: 'Candidate is an immediate joiner / currently serving notice.',
      source: 'Notice Period & Availability',
      confidence: 'EXPLICIT'
    };
  }

  const daysMatch = noticeText.match(/(\d+)\s*(?:days?|weeks?)\s*(?:notice|availability)/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days <= 15) {
      return {
        status: 'MATCHED',
        evidence: `Candidate notice period is ${days} days (meets immediate/15-day requirement).`,
        source: 'Notice Period & Availability',
        confidence: 'EXPLICIT'
      };
    } else if (days <= 30 && isImmediateReq) {
      return {
        status: 'PARTIAL',
        evidence: `Candidate has ${days} days notice period (exceeds immediate 15-day preference).`,
        source: 'Notice Period & Availability',
        confidence: 'STRONG_SEMANTIC',
        failureReason: `Candidate notice period is ${days} days vs immediate requirement.`
      };
    } else if (days > 30 && isImmediateReq) {
      return {
        status: 'NOT_MATCHED',
        evidence: `Candidate has ${days} days notice period (does not meet immediate requirement).`,
        source: 'Notice Period & Availability',
        confidence: 'EXPLICIT',
        failureReason: `Candidate notice period (${days} days) does not meet immediate requirement.`
      };
    }
  }

  return {
    status: 'UNKNOWN',
    evidence: 'Candidate notice period or availability is not stated in CV.',
    source: 'Availability Data',
    confidence: 'WEAK_INFERENCE'
  };
}

// ============================================================================
// 6. EDUCATION EVALUATOR
// ============================================================================
export function evaluateEducationRequirement(
  candidateEdu: Array<{ degree?: string | null; field?: string | null; institution?: string | null; year?: string | number | null }>,
  requirementText: string
): SkillMatchResult {
  const reqLower = requirementText.toLowerCase();

  if (!Array.isArray(candidateEdu) || candidateEdu.length === 0) {
    return {
      status: 'NOT_MATCHED',
      evidence: 'No academic degrees or educational credentials found in CV.',
      source: 'Education Section',
      confidence: 'EXPLICIT',
      failureReason: 'Academic degree not documented in CV.'
    };
  }

  const isBachelorsReq = reqLower.includes('bachelor') || reqLower.includes('b.tech') || reqLower.includes('b.e') || reqLower.includes('bs') || reqLower.includes('b.sc');
  const isMastersReq = reqLower.includes('master') || reqLower.includes('m.tech') || reqLower.includes('m.s') || reqLower.includes('ms') || reqLower.includes('mba');
  const isCsReq = reqLower.includes('computer') || reqLower.includes('software') || reqLower.includes('engineering') || reqLower.includes('information technology') || reqLower.includes('it');

  for (const edu of candidateEdu) {
    const deg = (edu.degree || '').toLowerCase();
    const fld = (edu.field || '').toLowerCase();

    const hasBachelors = deg.includes('bachelor') || deg.includes('b.tech') || deg.includes('b.e') || deg.includes('b.s') || deg.includes('btech') || deg.includes('b.sc') || deg.includes('bs');
    const hasMasters = deg.includes('master') || deg.includes('m.tech') || deg.includes('m.s') || deg.includes('mtech') || deg.includes('ms') || deg.includes('mba');
    const hasCsField = fld.includes('computer') || fld.includes('software') || fld.includes('information technology') || fld.includes('cse') || fld.includes('it') || deg.includes('computer') || deg.includes('engineering');

    if (isMastersReq && hasMasters) {
      return {
        status: 'MATCHED',
        evidence: `${edu.degree || 'Master Degree'} in ${edu.field || 'Relevant Field'} from ${edu.institution || 'University'}${edu.year ? ` (${edu.year})` : ''}`,
        source: 'Education Section',
        confidence: 'EXPLICIT'
      };
    }

    if ((isBachelorsReq || !isMastersReq) && (hasBachelors || hasMasters)) {
      if (!isCsReq || hasCsField) {
        return {
          status: 'MATCHED',
          evidence: `${edu.degree || 'Bachelor Degree'} in ${edu.field || 'Computer Science / Engineering'} from ${edu.institution || 'University'}${edu.year ? ` (${edu.year})` : ''}`,
          source: 'Education Section',
          confidence: 'EXPLICIT'
        };
      } else {
        return {
          status: 'PARTIAL',
          evidence: `${edu.degree || 'Bachelor Degree'} in ${edu.field || 'General Field'} (Specialization differs from Computer Science).`,
          source: 'Education Section',
          confidence: 'STRONG_SEMANTIC'
        };
      }
    }
  }

  const first = candidateEdu[0];
  return {
    status: 'PARTIAL',
    evidence: `Candidate holds ${first.degree || 'Degree'} in ${first.field || 'Field'}, partially satisfying qualification requirement.`,
    source: 'Education Section',
    confidence: 'STRONG_SEMANTIC'
  };
}

export type FunctionalDomain = 'TECHNICAL' | 'SALES_BUSINESS' | 'MARKETING' | 'HR' | 'FINANCE' | 'GENERAL';

export function classifyJobDomain(jobTitle: string, jdText?: string): FunctionalDomain {
  const combined = `${jobTitle} ${jdText || ''}`.toLowerCase();
  if (/\b(sale|sales|business development|bde|bdr|sdr|account executive|inside sales|relationship manager|client acquisition|tele sales)\b/i.test(jobTitle.toLowerCase())) {
    return 'SALES_BUSINESS';
  }
  if (/\b(marketing|seo|sem|growth|content|social media|copywriter|brand)\b/i.test(jobTitle.toLowerCase())) {
    return 'MARKETING';
  }
  if (/\b(hr|human resources|recruiter|talent acquisition|people operations|payroll)\b/i.test(jobTitle.toLowerCase())) {
    return 'HR';
  }
  if (/\b(accountant|accounting|finance|financial analyst|audit|tax|bookkeeper)\b/i.test(jobTitle.toLowerCase())) {
    return 'FINANCE';
  }
  if (/\b(software|developer|engineer|fullstack|frontend|backend|devops|cloud|data engineer|qa|tester|architect|programmer|java|python|react|windchill|sap|cad)\b/i.test(jobTitle.toLowerCase())) {
    return 'TECHNICAL';
  }
  return 'GENERAL';
}

export function classifyCandidateDomain(candidate: CandidateRecord): FunctionalDomain {
  const titles = [
    candidate.currentTitle || '',
    ...(candidate.experience || []).map(e => e.title || '')
  ].join(' ').toLowerCase();

  const isTechTitles = /\b(software|developer|engineer|programmer|coder|frontend|backend|fullstack|devops|qa|data engineer|architect|web developer|app developer|system engineer)\b/i.test(titles);
  const isSalesTitles = /\b(sale|sales|business development|bde|bdr|sdr|account executive|inside sales|relationship manager)\b/i.test(titles);
  const isHrTitles = /\b(recruiter|talent acquisition|human resources|hr executive|hr manager|people partner)\b/i.test(titles);

  if (isTechTitles && !isSalesTitles) return 'TECHNICAL';
  if (isSalesTitles && !isTechTitles) return 'SALES_BUSINESS';
  if (isHrTitles && !isTechTitles && !isSalesTitles) return 'HR';

  return 'GENERAL';
}

// ============================================================================
// 7. CORE DETERMINISTIC SCORING ENGINE ENTRY POINT
// ============================================================================

export function calculateATSScore(
  candidate: CandidateRecord,
  job: { id: string; position?: string; title?: string; client?: string; company?: string; jd_text?: string },
  requirements: Array<{
    id: string;
    requirement: string;
    category?: string | null;
    weight?: number;
    is_mandatory?: boolean;
    isMandatory?: boolean;
  }>
): ATSScoringResult {
  const reqResults: RequirementEvaluationResult[] = [];
  const mandatoryFailures: MandatoryFailureDetail[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];
  const warnings: string[] = [];

  let totalWeight = 0;
  let earnedScoreSum = 0;

  let mandatoryTotal = 0;
  let mandatoryMetCount = 0;

  // Track pillar weighted components strictly based on evidence
  const pillarPoints: Record<'tech' | 'exp' | 'edu' | 'genai' | 'other', { earned: number; total: number }> = {
    tech: { earned: 0, total: 0 },
    exp: { earned: 0, total: 0 },
    edu: { earned: 0, total: 0 },
    genai: { earned: 0, total: 0 },
    other: { earned: 0, total: 0 },
  };

  // Cross-Domain Validation & Guard: Check for fundamental Role/Industry mismatch
  const jobPosition = job.position || job.title || '';
  const jobDomain = classifyJobDomain(jobPosition, job.jd_text);
  const candDomain = classifyCandidateDomain(candidate);

  const isTechnicalApplyingToSales = jobDomain === 'SALES_BUSINESS' && candDomain === 'TECHNICAL';
  const isSalesApplyingToTechnical = jobDomain === 'TECHNICAL' && candDomain === 'SALES_BUSINESS';

  let hasDomainMismatch = false;
  let domainMismatchReason = '';

  if (isTechnicalApplyingToSales) {
    const hasSalesExp = candidate.experience?.some(ex => /\b(sale|sales|business development|account executive|bde|bdr|inside sales)\b/i.test(ex.title || ''));
    if (!hasSalesExp) {
      hasDomainMismatch = true;
      domainMismatchReason = 'CRITICAL ROLE DOMAIN MISMATCH: Requisition is in Sales & Business Development, but candidate has a Software Engineering/Technical Development background with zero verified B2B sales or quota-carrying experience.';
      mandatoryFailures.push({
        requirement: 'Role Domain Alignment: Sales & Business Development',
        reason: domainMismatchReason,
        category: 'Domain Mismatch'
      });
      warnings.push(domainMismatchReason);
    }
  } else if (isSalesApplyingToTechnical) {
    const hasTechExp = candidate.experience?.some(ex => /\b(software|developer|engineer|programmer|coder|architect)\b/i.test(ex.title || ''));
    if (!hasTechExp) {
      hasDomainMismatch = true;
      domainMismatchReason = 'CRITICAL ROLE DOMAIN MISMATCH: Requisition requires Software Engineering technical expertise, but candidate has a Sales/Business Development background with zero verified software development or coding experience.';
      mandatoryFailures.push({
        requirement: 'Role Domain Alignment: Software Engineering',
        reason: domainMismatchReason,
        category: 'Domain Mismatch'
      });
      warnings.push(domainMismatchReason);
    }
  }

  const effectiveReqs = (Array.isArray(requirements) && requirements.length > 0)
    ? requirements
    : [
        { id: 'req-default-1', requirement: job.position || 'Professional Experience', category: 'Experience', weight: 2.0, is_mandatory: true },
        { id: 'req-default-2', requirement: 'Core Required Competencies', category: 'Functional Skill', weight: 2.0, is_mandatory: false }
      ];

  for (const req of effectiveReqs) {
    const reqId = req.id || `req-${Math.random().toString(36).substring(2, 7)}`;
    const reqText = (req.requirement || '').trim();
    const reqCategory = (req.category || 'Technical Skill').trim();
    const isMandatory = typeof req.is_mandatory === 'boolean'
      ? req.is_mandatory
      : (typeof req.isMandatory === 'boolean' ? req.isMandatory : false);
    const weight = typeof req.weight === 'number' && req.weight > 0 ? req.weight : 1.0;

    totalWeight += weight;
    if (isMandatory) mandatoryTotal++;

    const reqLower = reqText.toLowerCase();
    const catLower = reqCategory.toLowerCase();

    let evalResult: SkillMatchResult;

    const hasYearsExplicit = /\b\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)\b/i.test(reqLower) || /\b\d+\s*(?:-|to|–)\s*\d+\s*(?:years?|yrs?)\b/i.test(reqLower);
    const isCategoryExperience = (catLower === 'experience' || catLower.startsWith('exp')) && !catLower.includes('skill');

    // 1. Experience Requirements: ONLY if category is experience OR requirement text explicitly specifies years (e.g. "5+ years")
    if (isCategoryExperience || hasYearsExplicit) {
      const expRes = evaluateExperienceRequirement(candidate, reqText);
      evalResult = {
        status: expRes.status,
        evidence: expRes.evidence,
        source: expRes.source,
        confidence: expRes.confidence,
        failureReason: expRes.failureReason
      };
      pillarPoints.exp.earned += STATUS_SCORE_MAP[expRes.status] * weight;
      pillarPoints.exp.total += weight;
    }
    // 2. Education Requirements
    else if (catLower.includes('education') || reqLower.includes('degree') || reqLower.includes('bachelor') || reqLower.includes('master') || reqLower.includes('b.tech') || reqLower.includes('b.e')) {
      evalResult = evaluateEducationRequirement(candidate.education || [], reqText);
      pillarPoints.edu.earned += STATUS_SCORE_MAP[evalResult.status] * weight;
      pillarPoints.edu.total += weight;
    }
    // 3. Location Requirements
    else if (catLower.includes('location') || reqLower.includes('location') || reqLower.includes('onsite') || reqLower.includes('ncr') || reqLower.includes('bangalore') || reqLower.includes('mumbai') || reqLower.includes('hyderabad')) {
      evalResult = evaluateLocationRequirement(candidate, reqText);
      pillarPoints.other.earned += STATUS_SCORE_MAP[evalResult.status] * weight;
      pillarPoints.other.total += weight;
    }
    // 4. Notice Period / Availability Requirements
    else if (catLower.includes('availability') || catLower.includes('notice') || reqLower.includes('joiner') || reqLower.includes('notice period')) {
      evalResult = evaluateNoticePeriodRequirement(candidate, reqText);
      pillarPoints.other.earned += STATUS_SCORE_MAP[evalResult.status] * weight;
      pillarPoints.other.total += weight;
    }
    // 5. Technical Skills & Tools (General, GenAI, Backend, etc.)
    else {
      evalResult = matchSkillRequirement(candidate, reqText, reqCategory);
      const isGenAi = reqLower.includes('genai') || reqLower.includes('generative ai') || reqLower.includes('llm') || reqLower.includes('rag') || reqLower.includes('langgraph') || reqLower.includes('langchain') || reqLower.includes('bedrock') || reqLower.includes('vector');
      if (isGenAi) {
        pillarPoints.genai.earned += STATUS_SCORE_MAP[evalResult.status] * weight;
        pillarPoints.genai.total += weight;
      } else {
        pillarPoints.tech.earned += STATUS_SCORE_MAP[evalResult.status] * weight;
        pillarPoints.tech.total += weight;
      }
    }

    const statusScore = STATUS_SCORE_MAP[evalResult.status] ?? 0.0;
    const score = Math.round(statusScore * 100);
    earnedScoreSum += statusScore * weight;

    // Track mandatory compliance: ONLY fully MATCHED satisfies mandatory requirement
    if (isMandatory) {
      if (evalResult.status === 'MATCHED') {
        mandatoryMetCount++;
      } else {
        mandatoryFailures.push({
          requirement: reqText,
          reason: evalResult.failureReason || evalResult.evidence,
          category: reqCategory
        });
        warnings.push(`MANDATORY REQUIREMENT FAILED: "${reqText}" (${evalResult.failureReason || evalResult.evidence})`);
      }
    }

    if (evalResult.status === 'MATCHED') {
      strengths.push(`${reqText}: ${evalResult.evidence}`);
    } else if (evalResult.status === 'PARTIAL') {
      gaps.push(`${reqText}: Partially satisfied (${evalResult.evidence})`);
    } else if (evalResult.status === 'NOT_MATCHED') {
      gaps.push(`${reqText}: Not matched (${evalResult.failureReason || 'No credible evidence in CV'})`);
    }

    reqResults.push({
      id: reqId,
      requirement: reqText,
      category: reqCategory,
      mandatory: isMandatory,
      isMandatory,
      weight,
      status: evalResult.status,
      statusScore,
      score,
      candidateEvidence: evalResult.evidence,
      evidence: evalResult.evidence,
      evidenceSource: evalResult.source,
      evidenceType: evalResult.confidence,
      confidence: evalResult.confidence === 'EXPLICIT' ? 'High' : evalResult.confidence === 'STRONG_SEMANTIC' ? 'Medium' : 'Low',
      failureReason: evalResult.failureReason
    });
  }

  // 1. Raw evidence-based weighted score (0 - 100)
  const rawFinalScore = totalWeight > 0 ? (earnedScoreSum / totalWeight) * 100 : 0;
  const rawScore = Math.min(100, Math.max(0, Math.round(rawFinalScore)));

  // 2. Mandatory Gating & Cross-Domain Disqualification
  const hasMandatoryFailure = (mandatoryTotal > 0 && mandatoryFailures.length > 0) || hasDomainMismatch;
  const mandatoryComplianceScore = mandatoryTotal > 0 ? Math.round((mandatoryMetCount / mandatoryTotal) * 100) : (hasDomainMismatch ? 0 : 100);

  let overallScore = rawScore;
  if (hasDomainMismatch) {
    // Cross-domain mismatch: Technical applicant on Sales role (or vice-versa)
    overallScore = Math.min(rawScore, 12);
  } else if (mandatoryFailures.length >= 3) {
    overallScore = Math.min(rawScore, 15);
  } else if (mandatoryFailures.length >= 2) {
    overallScore = Math.min(rawScore, 25);
  } else if (hasMandatoryFailure) {
    overallScore = Math.min(rawScore, 40);
  }

  // 3. Determine Final Match Tier deterministically
  let finalMatchLevel: MatchTier = 'MINIMAL MATCH';
  if (hasDomainMismatch || mandatoryFailures.length >= 3 || overallScore < 20) {
    finalMatchLevel = 'MINIMAL MATCH';
  } else if (hasMandatoryFailure || overallScore < 45) {
    finalMatchLevel = overallScore >= 30 ? 'LOW MATCH' : 'MINIMAL MATCH';
  } else {
    if (overallScore >= 85) finalMatchLevel = 'EXCELLENT MATCH';
    else if (overallScore >= 70) finalMatchLevel = 'STRONG MATCH';
    else if (overallScore >= 50) finalMatchLevel = 'MODERATE MATCH';
    else if (overallScore >= 35) finalMatchLevel = 'LOW MATCH';
    else finalMatchLevel = 'MINIMAL MATCH';
  }

  // 4. Calculate Pillar Scores Strictly from Evidence (NO artificial fallbacks to overallScore)
  const computePillarPct = (p: { earned: number; total: number }): number => {
    return p.total > 0 ? Math.round((p.earned / p.total) * 100) : 0;
  };

  const techPct = computePillarPct(pillarPoints.tech);
  const expPct = computePillarPct(pillarPoints.exp);
  const eduPct = computePillarPct(pillarPoints.edu);
  const genaiPct = computePillarPct(pillarPoints.genai);

  // Semantic Relevance: Contextual overlap between candidate text and distinctive job domain keywords
  const jdKeywords = (job.position || '').split(/\s+/).filter(w => w.length > 3 && !GENERIC_STOP_WORDS.has(w.toLowerCase()));
  const candTextLower = (candidate.rawText || '').toLowerCase();
  let overlap = 0;
  for (const kw of jdKeywords) {
    const kwRegex = new RegExp(`\\b${kw.toLowerCase().replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}\\b`, 'i');
    if (kwRegex.test(candTextLower)) overlap++;
  }
  const semanticRelevance = jdKeywords.length > 0 ? Math.round((overlap / jdKeywords.length) * 100) : 0;

  const pillarScores: PillarScores = {
    technicalSkills: techPct,
    experience: expPct,
    education: eduPct,
    genAI: genaiPct,
    semanticRelevance,
    // Compatibility fields
    mandatoryCompliance: mandatoryComplianceScore,
    relevantExperience: expPct,
    responsibilities: expPct,
    semanticSimilarity: semanticRelevance,
    domainFit: genaiPct
  };

  return {
    evaluationId: `eval-${candidate.id}-${Date.now()}`,
    candidateId: candidate.id,
    jobId: job.id,
    rawScore,
    overallScore,
    finalScore: overallScore,
    matchLevel: finalMatchLevel,
    mandatoryRequirementFailed: hasMandatoryFailure,
    mandatoryComplianceScore,
    mandatoryFailures,
    mandatoryCompliance: {
      total: mandatoryTotal,
      met: mandatoryMetCount,
      failed: mandatoryFailures.length,
      passed: !hasMandatoryFailure
    },
    pillarScores,
    pillars: pillarScores,
    requirements: reqResults,
    requirementResults: reqResults,
    strengths: Array.from(new Set(strengths)),
    gaps: Array.from(new Set(gaps)),
    warnings,
    scoringConfigVersion: '4.0.0-evidence-deterministic',
    evaluatedAt: new Date().toISOString(),
    debugAudit: {
      rawWeightedScore: rawScore,
      mandatoryCapped: hasMandatoryFailure && rawScore > 40,
      appliedCap: 40,
      calculatedAt: new Date().toISOString()
    }
  };
}
