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
 * Communicates with the Python FastAPI Document Processing Service (single file extraction)
 * Automatically and instantly falls back to Node.js local parser on timeout/failure.
 */
export const extractDocumentTextViaPython = async (
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<PythonDocumentResponse> => {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (res: PythonDocumentResponse) => {
      if (!resolved) {
        resolved = true;
        resolve(res);
      }
    };

    const config = getPythonServiceConfig();
    const httpModule = config.isHttps ? https : http;

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    // Build multipart payload
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

        res.on('end', async () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const rawJson: any = JSON.parse(responseData);
              const data = rawJson.data || {};
              const cand = data.candidate || {};
              
              const structuredSkills = data.skill_names || (Array.isArray(data.skills) ? data.skills.map((s: any) => typeof s === 'string' ? s : s.skill).filter(Boolean) : []);
              const rawExtractedText = rawJson.text || rawJson.normalizedText || rawJson.layout_text || (data.raw_sections ? data.raw_sections.map((s: any) => s.content).join('\n\n') : '');

              const json: PythonDocumentResponse = {
                success: Boolean(rawJson.success ?? true),
                fileName: filename,
                fileType: mimeType,
                pageCount: rawJson.pageCount || data.page_count || 1,
                extractionMethod: rawJson.extractionMethod || rawJson.parser || 'pymupdf-fastapi',
                ocrUsed: Boolean(rawJson.ocrUsed || rawJson.ocr_used),
                textQuality: rawExtractedText.length > 20 ? 'HIGH' : 'LOW',
                characterCount: rawExtractedText.length,
                wordCount: rawExtractedText.split(/\s+/).filter(Boolean).length,
                text: rawExtractedText,
                layoutText: rawJson.layoutText || rawJson.layout_text || rawExtractedText,
                normalizedText: rawJson.normalizedText || rawExtractedText,
                candidateName: cand.name || rawJson.candidateName,
                email: cand.email || rawJson.email,
                phone: cand.phone || rawJson.phone,
                skills: structuredSkills.length > 0 ? structuredSkills : rawJson.skills,
                yearsOfExperience: data.total_experience_years ? `${data.total_experience_years} years` : (data.total_experience_label || rawJson.yearsOfExperience),
                currentTitle: data.current_title || rawJson.currentTitle,
                currentCompany: data.current_company || rawJson.currentCompany,
                summary: data.summary || rawJson.summary,
              };

              if (json.success && json.text && json.text.trim().length > 20) {
                console.log(`[Python Document Client] Successfully parsed ${filename} (length: ${json.text.length} chars, method: ${json.extractionMethod})`);
                return safeResolve(json);
              }
            }
            console.warn(`[Document Processor] Python returned status ${res.statusCode} or empty text for ${filename}. Falling back gracefully to local Node extractor.`);
            const localFallback = await extractDocumentTextLocally(buffer, filename, mimeType);
            safeResolve(localFallback);
          } catch (jsonErr: any) {
            console.warn(`[Document Processor] Python JSON parse failed for ${filename}, falling back to local extractor:`, jsonErr.message);
            const localFallback = await extractDocumentTextLocally(buffer, filename, mimeType);
            safeResolve(localFallback);
          }
        });
      }
    );

    req.on('timeout', async () => {
      req.destroy();
      console.warn(`[Document Processor] Python service timed out (${REQUEST_TIMEOUT_MS}ms) for ${filename}. Falling back gracefully to local Node extractor.`);
      const localFallback = await extractDocumentTextLocally(buffer, filename, mimeType);
      safeResolve(localFallback);
    });

    req.on('error', async (err) => {
      console.warn(`[Document Processor] Python service unavailable (${err.message}) for ${filename}. Falling back gracefully to local Node extractor.`);
      const localFallback = await extractDocumentTextLocally(buffer, filename, mimeType);
      safeResolve(localFallback);
    });

    req.write(payload);
    req.end();
  });
};

/**
 * Communicates with the Python FastAPI Document Processing Service for batch files
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

  // Process files concurrently with individual safety
  const results = await Promise.all(
    files.map(f => extractDocumentTextViaPython(f.buffer, f.filename, f.mimeType))
  );

  const successfulCount = results.filter(r => r.success).length;

  return {
    success: true,
    totalFiles: results.length,
    successfulCount,
    failedCount: results.length - successfulCount,
    results
  };
};
