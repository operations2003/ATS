import http from 'http';
import https from 'https';
import { URL } from 'url';
import { extractTextFromBuffer, cleanAndNormalizeText } from './jdParsingService';

export interface PythonDocumentResponse {
  success: boolean;
  fileName: string;
  fileType: string;
  pageCount: number;
  extractionMethod: string;
  ocrUsed: boolean;
  textQuality: string;
  characterCount: number;
  wordCount: number;
  text: string;
  layoutText?: string;
  normalizedText?: string;
  // Structured CV JSON Fields
  candidateName?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  yearsOfExperience?: string;
  education?: Array<{ degree: string; institution?: string; year?: string }>;
  pastCompanies?: string[];
  currentTitle?: string;
  currentCompany?: string;
  summary?: string;
  rawTextSummary?: string;
  error?: string;
}

export interface PythonBatchResponse {
  success: boolean;
  totalFiles: number;
  successfulCount: number;
  failedCount: number;
  results: PythonDocumentResponse[];
}

const REQUEST_TIMEOUT_MS = parseInt(process.env.PYTHON_TIMEOUT_MS || '25000', 10);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const BATCH_CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY || '3', 10);

let lastPythonHealthCheck = 0;
let pythonServiceAvailable = false;

export const isPythonDocumentProcessorAvailable = async (): Promise<boolean> => {
  const config = getPythonServiceConfig();
  if (!config) return false;
  const now = Date.now();
  // If previously healthy, cache for 30s. If unhealthy, check again after 5s to allow fast recovery on cold start.
  const cacheDuration = pythonServiceAvailable ? 30000 : 5000;
  if (now - lastPythonHealthCheck < cacheDuration) {
    return pythonServiceAvailable;
  }
  return new Promise((resolve) => {
    const httpModule = config.isHttps ? https : http;
    const req = httpModule.request(
      {
        hostname: config.hostname,
        port: config.port,
        path: `${config.basePath}/health`,
        method: 'GET',
        timeout: 6000,
      },
      (res) => {
        pythonServiceAvailable = Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
        lastPythonHealthCheck = Date.now();
        resolve(pythonServiceAvailable);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      pythonServiceAvailable = false;
      lastPythonHealthCheck = Date.now();
      resolve(false);
    });
    req.on('error', () => {
      pythonServiceAvailable = false;
      lastPythonHealthCheck = Date.now();
      resolve(false);
    });
    req.end();
  });
};

export const getPythonServiceConfig = () => {
  const rawUrl = process.env.DOCUMENT_PROCESSOR_URL;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl.trim());
      const isHttps = parsed.protocol === 'https:';
      return {
        isHttps,
        hostname: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80),
        basePath: parsed.pathname.replace(/\/+$/, '')
      };
    } catch (e) {
      console.warn('[Python Client] Invalid DOCUMENT_PROCESSOR_URL provided:', rawUrl);
    }
  }
  // In production, do not attempt to contact 127.0.0.1:8000 if DOCUMENT_PROCESSOR_URL is not provided
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const host = process.env.PYTHON_HOST || '127.0.0.1';
  const port = parseInt(process.env.PYTHON_PORT || '8000', 10);
  return {
    isHttps: false,
    hostname: host,
    port,
    basePath: ''
  };
};

/**
 * Built-in Node.js local document extractor (PDF via pdf-parse, DOCX via mammoth, TXT)
 * Used immediately if Python microservice is offline, busy, or timed out.
 */
export const extractDocumentTextLocally = async (
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<PythonDocumentResponse> => {
  try {
    const res = await extractTextFromBuffer(buffer, mimeType, filename);
    const rawText = res.text || '';
    const normalized = cleanAndNormalizeText(rawText);
    const words = rawText.trim().split(/\s+/).filter(Boolean);
    const isValid = rawText.trim().length > 20;

    return {
      success: isValid,
      fileName: filename,
      fileType: mimeType,
      pageCount: res.pageCount || 1,
      extractionMethod: `node-${res.method || 'direct'}`,
      ocrUsed: res.ocrUsed || false,
      textQuality: isValid ? 'HIGH' : 'LOW',
      characterCount: rawText.length,
      wordCount: words.length,
      text: rawText,
      layoutText: rawText,
      normalizedText: normalized,
      error: isValid ? undefined : 'Document text extraction yielded insufficient characters.',
    };
  } catch (err: any) {
    console.error('[Local Node Extractor Error]:', err);
    return {
      success: false,
      fileName: filename,
      fileType: mimeType,
      pageCount: 1,
      extractionMethod: 'node-error',
      ocrUsed: false,
      textQuality: 'FAILED',
      characterCount: 0,
      wordCount: 0,
      text: '',
      layoutText: '',
      normalizedText: '',
      error: err?.message || 'Local extraction failed',
    };
  }
};

/**
 * Helper to perform single HTTP request to Python /parse-document endpoint
 */
const sendPythonParseRequest = (
  config: { isHttps: boolean; hostname: string; port: number; basePath: string },
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ statusCode: number; responseData: string }> => {
  return new Promise((resolve, reject) => {
    const httpModule = config.isHttps ? https : http;
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([header, buffer, footer]);

    const requestPath = `${config.basePath}/parse-document`;

    const req = httpModule.request(
      {
        hostname: config.hostname,
        port: config.port,
        path: requestPath,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 500, responseData });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Python service timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
};

/**
 * Communicates with the Python FastAPI Document Processing Service (single file extraction)
 * Features bounded retries for transient Render errors (502, 503, 504, cold start).
 * Falls back to Node.js local extractor only if Python service is genuinely unavailable.
 */
export const extractDocumentTextViaPython = async (
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<PythonDocumentResponse> => {
  const config = getPythonServiceConfig();
  if (!config) {
    return extractDocumentTextLocally(buffer, filename, mimeType);
  }

  // Check health (with fast recovery on cold start)
  const isHealthy = await isPythonDocumentProcessorAvailable();
  if (!isHealthy) {
    console.warn(`[Python Document Client] Python service is currently unreachable. Using local extractor for ${filename}.`);
    return extractDocumentTextLocally(buffer, filename, mimeType);
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    attempt++;
    try {
      const { statusCode, responseData } = await sendPythonParseRequest(config, buffer, filename, mimeType);

      if (statusCode >= 200 && statusCode < 300) {
        let rawJson: any;
        try {
          rawJson = JSON.parse(responseData);
        } catch (jsonErr: any) {
          console.warn(`[Document Processor] Python JSON parse failed for ${filename}:`, jsonErr.message);
          return extractDocumentTextLocally(buffer, filename, mimeType);
        }

        const data = rawJson.data || {};
        const cand = data.candidate || {};

        const structuredSkills = rawJson.skills && rawJson.skills.length > 0
          ? rawJson.skills
          : (data.skill_names || (Array.isArray(data.skills) ? data.skills.map((s: any) => typeof s === 'string' ? s : s.skill).filter(Boolean) : []));

        const rawExtractedText = rawJson.text || rawJson.normalizedText || rawJson.layoutText || rawJson.layout_text || (data.raw_sections ? data.raw_sections.map((s: any) => s.content).join('\n\n') : '');

        // If Python explicitly returned failure (e.g. corrupt or empty file), preserve its error!
        if (rawJson.success === false) {
          return {
            success: false,
            fileName: filename,
            fileType: mimeType,
            pageCount: rawJson.pageCount || 0,
            extractionMethod: rawJson.extractionMethod || 'python-fastapi',
            ocrUsed: Boolean(rawJson.ocrUsed),
            textQuality: 'FAILED',
            characterCount: rawExtractedText.length,
            wordCount: rawExtractedText.split(/\s+/).filter(Boolean).length,
            text: rawExtractedText,
            candidateName: rawJson.candidateName || cand.name || undefined,
            email: rawJson.email || cand.email || undefined,
            phone: rawJson.phone || cand.phone || undefined,
            skills: structuredSkills,
            yearsOfExperience: rawJson.yearsOfExperience || data.total_experience_label,
            education: rawJson.education || [],
            pastCompanies: rawJson.pastCompanies || [],
            summary: rawJson.summary || data.summary,
            error: rawJson.error || 'Document text extraction was insufficient.',
          };
        }

        const isGoodText = rawExtractedText.trim().length > 20;
        const result: PythonDocumentResponse = {
          success: Boolean(rawJson.success ?? isGoodText),
          fileName: filename,
          fileType: mimeType,
          pageCount: rawJson.pageCount || data.page_count || 1,
          extractionMethod: rawJson.extractionMethod || rawJson.parser || 'pymupdf-fastapi',
          ocrUsed: Boolean(rawJson.ocrUsed || rawJson.ocr_used),
          textQuality: isGoodText ? (rawJson.textQuality || 'HIGH') : 'LOW',
          characterCount: rawExtractedText.length,
          wordCount: rawExtractedText.split(/\s+/).filter(Boolean).length,
          text: rawExtractedText,
          layoutText: rawJson.layoutText || rawJson.layout_text || rawExtractedText,
          normalizedText: rawJson.normalizedText || rawExtractedText,
          candidateName: rawJson.candidateName || cand.name || undefined,
          email: rawJson.email || cand.email || undefined,
          phone: rawJson.phone || cand.phone || undefined,
          skills: structuredSkills,
          yearsOfExperience: rawJson.yearsOfExperience || (data.total_experience_years ? `${data.total_experience_years} years` : data.total_experience_label),
          education: rawJson.education || [],
          pastCompanies: rawJson.pastCompanies || [],
          currentTitle: rawJson.currentTitle || data.current_title,
          currentCompany: rawJson.currentCompany || data.current_company,
          summary: rawJson.summary || data.summary,
          rawTextSummary: rawJson.rawTextSummary,
          error: isGoodText ? undefined : (rawJson.error || 'Document text extraction yielded insufficient characters.'),
        };

        if (result.success && isGoodText) {
          console.log(`[Python Document Client] Successfully parsed ${filename} (${result.characterCount} chars, method: ${result.extractionMethod})`);
          return result;
        }

        // If Python returned 200 but text was < 20 chars, try local extractor
        console.warn(`[Document Processor] Python returned sparse text for ${filename}. Trying local extractor.`);
        const local = await extractDocumentTextLocally(buffer, filename, mimeType);
        if (local.success && local.text.length > rawExtractedText.length) {
          return local;
        }
        return result;
      }

      // Check for transient server errors (502, 503, 504 - e.g. Render waking up)
      if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
        if (attempt <= MAX_RETRIES) {
          console.warn(`[Python Document Client] Transient HTTP ${statusCode} for ${filename}. Retrying (attempt ${attempt}/${MAX_RETRIES}) in ${RETRY_DELAY_MS}ms...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          continue;
        }
      }

      // Permanent 4xx error or exhausting retries
      console.warn(`[Document Processor] Python returned non-2xx status ${statusCode} for ${filename}. Falling back to local extractor.`);
      return extractDocumentTextLocally(buffer, filename, mimeType);

    } catch (reqErr: any) {
      if (attempt <= MAX_RETRIES && reqErr.message?.includes('timed out')) {
        console.warn(`[Python Document Client] Timeout on ${filename}. Retrying (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }
      console.warn(`[Document Processor] Python request failed for ${filename} (${reqErr.message}). Falling back to local extractor.`);
      return extractDocumentTextLocally(buffer, filename, mimeType);
    }
  }

  return extractDocumentTextLocally(buffer, filename, mimeType);
};

/**
 * Communicates with the Python FastAPI Document Processing Service for batch files
 * Uses controlled concurrency (3 parallel workers) to prevent socket/memory exhaustion.
 */
export const extractBatchDocumentsViaPython = async (
  files: Array<{ buffer: Buffer; filename: string; mimeType: string }>
): Promise<PythonBatchResponse> => {
  if (!files || files.length === 0) {
    return {
      success: true,
      totalFiles: 0,
      successfulCount: 0,
      failedCount: 0,
      results: []
    };
  }

  console.log(`[Batch Extraction] Processing ${files.length} file(s) with controlled concurrency of ${BATCH_CONCURRENCY}...`);

  const results: PythonDocumentResponse[] = new Array(files.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index];
      if (!file) break;

      try {
        const res = await extractDocumentTextViaPython(file.buffer, file.filename, file.mimeType);
        results[index] = res;
      } catch (err: any) {
        console.error(`[Batch Extraction Error] Failed processing ${file.filename}:`, err);
        results[index] = {
          success: false,
          fileName: file.filename,
          fileType: file.mimeType,
          pageCount: 0,
          extractionMethod: 'error',
          ocrUsed: false,
          textQuality: 'FAILED',
          characterCount: 0,
          wordCount: 0,
          text: '',
          error: err.message || 'Processing error',
        };
      }
    }
  };

  const workerCount = Math.min(BATCH_CONCURRENCY, files.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  const successfulCount = results.filter(r => r && r.success).length;

  return {
    success: true,
    totalFiles: results.length,
    successfulCount,
    failedCount: results.length - successfulCount,
    results
  };
};
