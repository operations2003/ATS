/**
 * Controlled AI Integration: AI-Assisted JD Requirement Completion Service
 * - Extracts requirements reasonably supported by JD text without hallucination.
 * - Retains source evidence, category, confidence, and is_inferred flag.
 * - Inferred requirements are NEVER marked as mandatory knockouts.
 * - 100% Graceful Fallback: If AI is unavailable or times out, returns null/empty array.
 */

import http from 'http';
import https from 'https';
import { getPythonServiceConfig } from './pythonDocumentClient';

export interface ControlledAiRequirement {
  id: string;
  requirement: string;
  category: string;
  source_evidence: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  is_inferred: boolean;
  is_mandatory: boolean;
  weight: number;
}

export interface AiParsedJd {
  companyName: string | null;
  positionTitle: string | null;
  location: string | null;
  workMode: 'Remote' | 'Hybrid' | 'Onsite' | null;
  salary: string | null;
  experience: string | null;
  mandatoryRequirements: Array<{
    requirement: string;
    category: string;
    sourceEvidence?: string;
  }>;
  preferredRequirements: Array<{
    requirement: string;
    category: string;
    sourceEvidence?: string;
  }>;
  responsibilities: string[];
  inferredRequirements?: ControlledAiRequirement[];
}

export const sanitizeAiText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
};

const AI_TIMEOUT_MS = parseInt(process.env.PYTHON_TIMEOUT_MS || '15000', 10);

export const completeJdRequirementsControlled = async (jdText: string): Promise<ControlledAiRequirement[]> => {
  if (!jdText || jdText.trim().length < 20) {
    return [];
  }

  return new Promise((resolve) => {
    try {
      const config = getPythonServiceConfig();
      const httpModule = config.isHttps ? https : http;
      const payload = JSON.stringify({ jd_text: jdText });
      const reqPath = `${config.basePath}/parse-jd-ai`;

      const req = httpModule.request(
        {
          hostname: config.hostname,
          port: config.port,
          path: reqPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: AI_TIMEOUT_MS
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(data);
                resolve(parsed.requirements || []);
              } else {
                console.warn(`[Controlled AI] JD completion returned status ${res.statusCode}. Falling back gracefully.`);
                resolve([]);
              }
            } catch (err) {
              console.warn('[Controlled AI] Parse error on JD completion response. Falling back gracefully.');
              resolve([]);
            }
          });
        }
      );

      req.on('error', (err) => {
        console.warn(`[Controlled AI] Service unavailable (${err.message}). Graceful fallback to deterministic parsing.`);
        resolve([]);
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('[Controlled AI] JD completion timed out. Graceful fallback to deterministic parsing.');
        resolve([]);
      });

      req.write(payload);
      req.end();
    } catch (err: any) {
      console.warn(`[Controlled AI] Unexpected error (${err.message}). Falling back to deterministic parsing.`);
      resolve([]);
    }
  });
};

export const parseJdWithAi = async (rawText: string): Promise<AiParsedJd | null> => {
  try {
    const inferred = await completeJdRequirementsControlled(rawText);
    if (!inferred || inferred.length === 0) return null;

    return {
      companyName: null,
      positionTitle: null,
      location: null,
      workMode: null,
      salary: null,
      experience: null,
      mandatoryRequirements: inferred.filter(r => r.is_mandatory).map(r => ({
        requirement: r.requirement,
        category: r.category,
        sourceEvidence: r.source_evidence
      })),
      preferredRequirements: inferred.filter(r => !r.is_mandatory).map(r => ({
        requirement: r.requirement,
        category: r.category,
        sourceEvidence: r.source_evidence
      })),
      responsibilities: inferred.filter(r => r.category === 'Responsibility').map(r => r.requirement),
      inferredRequirements: inferred
    };
  } catch {
    return null;
  }
};
