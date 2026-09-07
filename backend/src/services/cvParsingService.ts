import { PythonDocumentResponse } from './pythonDocumentClient';

export interface SourceEvidenceItem<T = string> {
  value: T;
  sourceEvidence?: string;
}

export interface CandidateEducation {
  degree: string | null;
  field?: string | null;
  institution: string | null;
  year?: string | null;
  details?: string | null;
  sourceEvidence?: string;
}

export interface CandidateExperience {
  title: string | null;
  company: string | null;
  duration?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
  highlights?: string[];
  sourceEvidence?: string;
}

export interface CandidateProject {
  name: string | null;
  description?: string | null;
  technologies?: string[];
  role?: string | null;
  sourceEvidence?: string;
}

export interface CandidateCertification {
  name: string;
  issuer?: string | null;
  year?: string | null;
  sourceEvidence?: string;
}

export interface CandidateCareerGap {
  fromCompany?: string;
  toCompany?: string;
  startDate: string;
  endDate: string;
  gapMonths: number;
  gapLabel: string;
}

export interface CandidateGapAnalysis {
  hasGap: boolean;
  totalGapMonths: number;
  gaps: CandidateCareerGap[];
  statusText: string;
}

export interface CandidateParsedProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  totalExperience: string | null;
  totalExperienceMonths?: number;
  totalExperienceYears?: number;
  relevantExperience?: string | null;
  summary: string | null;
  professionalSummary?: string | null;
  skills: string[];
  technologies: string[];
  tools: string[];
  industries: string[];
  education: CandidateEducation[];
  certifications: (string | CandidateCertification)[];
  languages: string[];
  experience: CandidateExperience[];
  gapAnalysis?: CandidateGapAnalysis;
  responsibilities: string[];
  achievements: string[];
  projects: CandidateProject[];
  sourceEvidence?: Record<string, string | undefined>;
  rawText: string;
  parsingStatus: 'PARSED' | 'FAILED' | 'PROCESSING' | 'UPLOADED';
  errorMessage?: string;
  validationErrors: string[];
  parsingMetadata: {
    fileName: string;
    fileType: string;
    pageCount: number;
    extractionMethod: string;
    ocrUsed: boolean;
    characterCount: number;
    wordCount: number;
  };
  debug?: {
    rawTextPreview: string;
    extractionMethod: string;
    ocrUsed: boolean;
    characterCount: number;
    wordCount: number;
    parserInputPreview: string;
    parsedCandidate: Record<string, any>;
    validationErrors: string[];
  };
}

/**
 * Validates whether the raw text is legitimate CV text or garbage (HTML, code, binary junk).
 */
export function validateCvTextQuality(rawText: string): { isValid: boolean; reason?: string } {
  if (!rawText || typeof rawText !== 'string') {
    return { isValid: false, reason: 'Extracted text is empty.' };
  }

  const text = rawText.trim();
  if (text.length < 20) {
    return { isValid: false, reason: 'Extracted text length is too short (< 20 characters).' };
  }

  const htmlPatterns = [
    /<!doctype\s+html/i,
    /<html[\s>]/i,
    /<head[\s>]/i,
    /<body[\s>]/i,
    /<script[\s>]/i,
    /<style[\s>]/i,
    /<\/div>/i,
    /<\/span>/i,
  ];
  for (const pattern of htmlPatterns) {
    if (pattern.test(text)) {
      return { isValid: false, reason: 'Extracted text contains HTML/web markup instead of CV document content.' };
    }
  }

  const codePatterns = [
    /import\s+React/i,
    /from\s+['"]react['"]/i,
    /export\s+default\s+function/i,
    /function\s+\w+\s*\(.*?\)\s*\{/,
    /const\s+\w+\s*=\s*\(\)\s*=>/,
  ];
  for (const pattern of codePatterns) {
    if (pattern.test(text)) {
      return { isValid: false, reason: 'Extracted text appears to be application source code.' };
    }
  }

  const unprintableCount = (text.match(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g) || []).length;
  if (unprintableCount > text.length * 0.25) {
    return { isValid: false, reason: 'Extracted text contains excessive unprintable binary characters.' };
  }

  return { isValid: true };
}

/**
 * Validates email format strictly according to RFC standards.
 */
export function validateEmail(emailCandidate: string | null): string | null {
  if (!emailCandidate) return null;
  const email = emailCandidate.trim().toLowerCase().replace(/^mailto:/i, '');

  if (
    email.includes('<') ||
    email.includes('>') ||
    email.includes('doctype') ||
    email.startsWith('.') ||
    email.endsWith('.') ||
    email.includes('..') ||
    (email.includes('@email.com') && email.startsWith('.'))
  ) {
    return null;
  }

  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!strictEmailRegex.test(email)) {
    return null;
  }

  return email;
}

/**
 * Validates and normalizes phone number string.
 */
export function validatePhone(phoneCandidate: string | null): string | null {
  if (!phoneCandidate) return null;
  const raw = phoneCandidate.trim();

  if (/[a-zA-Z<>]/.test(raw)) return null;

  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return null;
  }

  if (/^(\d)\1+$/.test(digitsOnly)) {
    return null;
  }

  if (digitsOnly === '1234567890' || digitsOnly === '0123456789') {
    return null;
  }

  return raw;
}

/**
 * Extracts candidate name from the top lines of the CV.
 */
export function extractCandidateName(lines: string[], cleanText: string, fileName?: string): { name: string | null; evidence?: string } {
  const invalidNameKeywords = [
    'curriculum', 'vitae', 'resume', 'profile', 'summary', 'contact', 'email',
    'phone', 'address', 'page', 'objective', 'education', 'experience', 'skills',
    'developer', 'engineer', 'consultant', 'manager', 'specialist', 'doctype',
    'html', 'http', 'https', 'www', 'linkedin', 'github', 'portfolio', 'gender',
    'date of birth', 'nationality', 'languages', 'projects', 'declaration', 'career'
  ];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    let line = lines[i].trim();
    line = line.replace(/^(?:name|full\s*name|candidate\s*name)\s*[:\-–]\s*/i, '').trim();

    if (!line || line.length < 2 || line.length > 50) continue;
    if (line.includes('@') || /\d/.test(line) || line.includes('/') || line.includes('|') || line.includes(':')) continue;

    const lower = line.toLowerCase();
    const hasInvalidKeyword = invalidNameKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
    if (hasInvalidKeyword) continue;

    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 4) {
      const allAlpha = words.every(w => /^[a-zA-Z'.-]+$/.test(w));
      if (allAlpha) {
        const formatted = words
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return { name: formatted, evidence: lines[i] };
      }
    }
  }

  if (fileName) {
    const rawBase = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/\(\d+\)/g, '')
      .replace(/^(?:resume|cv|profile|candidate)[\s_-]*/i, '')
      .replace(/[\s_-]*(?:resume|cv|profile|candidate)$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim();

    const nameTokens = rawBase.split(/\s+/).filter(t => t.length >= 2 && /^[a-zA-Z]+$/.test(t));
    if (nameTokens.length >= 2) {
      const formatted = nameTokens
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      return { name: formatted, evidence: `Derived from document (${rawBase})` };
    }
  }

  return { name: 'Candidate' };
}

/**
 * Helper: extracts structured sections from CV text with case-insensitivity, markdown tolerance, and flexible headers.
 */
function extractSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  const sectionDefinitions: { canonical: string; patterns: RegExp[] }[] = [
    {
      canonical: 'SUMMARY',
      patterns: [
        /^(?:professional\s+summary|summary|profile|about\s+me|career\s+objective|objective|executive\s+summary|about|summary\s+statement)$/i,
        /^(?:professional\s+summary|summary)[:\s\-–]/i,
      ]
    },
    {
      canonical: 'SKILLS',
      patterns: [
        /^(?:technical\s+skills|skills\s*&\s*abilities|skills\s*&\s*competencies|skills\s*&\s*expertise|technical\s+competencies|core\s+competencies(?:\s*(?:&|and)\s*skills)?|key\s+skills|areas\s+of\s+expertise|skills|technologies|technical\s+stack|tech\s+stack|competencies|proficiencies)$/i,
        /^(?:technical\s+skills|core\s+competencies(?:\s*(?:&|and)\s*skills)?|skills|technologies|tech\s+stack)[:\s\-–]/i,
      ]
    },
    {
      canonical: 'EXPERIENCE',
      patterns: [
        /^(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history|experience|internships?|internship\s+experience|internship\s+history|work\s*&\s*internship\s*experience|career\s+history|relevant\s+experience)$/i,
        /^(?:work\s+experience|professional\s+experience|experience|internship\s+experience|internships?)[:\s\-–]/i,
      ]
    },
    {
      canonical: 'EDUCATION',
      patterns: [
        /^(?:education|academic\s+background|academics|qualifications|educational\s+qualifications|degrees?|education\s*&\s*training|academic\s+history)$/i,
        /^(?:education|academic\s+background)[:\s\-–]/i,
      ]
    },
    {
      canonical: 'PROJECTS',
      patterns: [
        /^(?:projects|key\s+projects|academic\s+projects|personal\s+projects|notable\s+projects|selected\s+projects|technical\s+projects)$/i,
        /^(?:projects|key\s+projects)[:\s\-–]/i,
      ]
    },
    {
      canonical: 'CERTIFICATIONS',
      patterns: [
        /^(?:certifications?|certificates?|achievements\s*&\s*certifications|achievements|awards\s*&\s*certifications|licenses\s*&\s*certifications|courses\s*&\s*certifications)$/i,
        /^(?:certifications?|certificates?)[:\s\-–]/i,
      ]
    },
    {
      canonical: 'LANGUAGES',
      patterns: [
        /^(?:languages|languages\s+known|spoken\s+languages)$/i,
        /^(?:languages|languages\s+known)[:\s\-–]/i,
      ]
    }
  ];

  const lines = text.split('\n');
  const sectionMarkers: { canonical: string; lineIndex: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.length > 55) continue;

    const cleaned = rawLine
      .replace(/^[\#\*\-\s]+/, '')
      .replace(/[:\-–—\s]+$/, '')
      .trim();

    for (const def of sectionDefinitions) {
      if (def.patterns.some(p => p.test(cleaned) || p.test(rawLine))) {
        sectionMarkers.push({ canonical: def.canonical, lineIndex: i });
        break;
      }
    }
  }

  for (let i = 0; i < sectionMarkers.length; i++) {
    const current = sectionMarkers[i];
    const nextLineIndex = i < sectionMarkers.length - 1 ? sectionMarkers[i + 1].lineIndex : lines.length;
    const contentLines = lines.slice(current.lineIndex + 1, nextLineIndex);
    sections[current.canonical] = contentLines.join('\n').trim();
  }

  return sections;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseDateToYearMonth(str: string): { year: number; month: number } | null {
  if (!str) return null;
  const trimmed = str.trim().toLowerCase();
  if (['present', 'current', 'now', 'till date', 'ongoing', 'active', 'continue', 'continuing'].includes(trimmed)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  
  // Format: "Apr 2025", "April 2025", "Apr '25", "Apr 25"
  const mMatch = trimmed.match(/([a-z]{3})[a-z]*\.?\s*'?(\d{2,4})/i);
  if (mMatch) {
    const monthKey = mMatch[1].toLowerCase().replace(/[^a-z]/g, '');
    const month = MONTH_MAP[monthKey] !== undefined ? MONTH_MAP[monthKey] : 0;
    let year = parseInt(mMatch[2], 10);
    if (year < 100) year += 2000;
    if (year >= 1970 && year <= 2035) {
      return { year, month };
    }
  }

  // Format: "04/2021", "4/2021", "04-2021", "04.2021"
  const slashMatch = trimmed.match(/(\d{1,2})\s*[\/\.-]\s*(\d{2,4})/);
  if (slashMatch) {
    const month = Math.max(0, Math.min(11, parseInt(slashMatch[1], 10) - 1));
    let year = parseInt(slashMatch[2], 10);
    if (year < 100) year += 2000;
    if (year >= 1970 && year <= 2035) {
      return { year, month };
    }
  }

  // Format: "2021/04", "2021-04"
  const yearFirstMatch = trimmed.match(/(\d{4})\s*[\/\.-]\s*(\d{1,2})/);
  if (yearFirstMatch) {
    const year = parseInt(yearFirstMatch[1], 10);
    const month = Math.max(0, Math.min(11, parseInt(yearFirstMatch[2], 10) - 1));
    return { year, month };
  }

  // Format: "2021"
  const yMatch = trimmed.match(/\b(19\d\d|20\d\d)\b/);
  if (yMatch) {
    return { year: parseInt(yMatch[1], 10), month: 0 };
  }

  return null;
}

export function calculateExperienceMonths(startDateStr: string | null | undefined, endDateStr: string | null | undefined): number {
  if (!startDateStr) return 0;
  const start = parseDateToYearMonth(startDateStr);
  const end = parseDateToYearMonth(endDateStr || 'Present');
  if (!start || !end) return 0;
  
  const months = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  return months > 0 ? months : 1;
}

export function formatNumericExperience(totalMonths: number): string {
  if (totalMonths <= 0) return '0 yrs';
  if (totalMonths < 12) {
    return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`;
  }
  const years = parseFloat((totalMonths / 12).toFixed(1));
  const remainderMonths = totalMonths % 12;
  if (remainderMonths === 0) {
    return `${years} yrs`;
  }
  return `${years} yrs (${Math.floor(totalMonths / 12)}y ${remainderMonths}m)`;
}

/**
 * Extracts date range from a string (e.g., "Apr 2025 – Nov 2025", "10/2021 - 04/2023", "2021 - 2023")
 */
export function extractDateRange(text: string): { duration: string | null; startDate: string | null; endDate: string | null; cleanedText: string } {
  const dateRangePattern = /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*'?\d{2,4}|\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}|\d{4}))\s*(?:[–—\-\~]|to|until)\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*'?\d{2,4}|\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}|\d{4}|Present|Current|Now|Ongoing|Till\s*Date))\b/i;
  const match = text.match(dateRangePattern);

  if (match) {
    const duration = match[0].trim();
    const startDate = match[1].trim();
    const endDate = match[2].trim();
    const cleanedText = text.replace(dateRangePattern, '').trim();
    return { duration, startDate, endDate, cleanedText };
  }

  return { duration: null, startDate: null, endDate: null, cleanedText: text };
}

/**
 * Calculates Career Gap between consecutive job experiences with raw text fallback
 */
export function calculateCareerGaps(experiences: CandidateExperience[], rawText?: string): CandidateGapAnalysis {
  // Parse start/end dates for each experience
  const datedExps: { exp?: CandidateExperience; title?: string | null; company?: string | null; start: { year: number; month: number }; end: { year: number; month: number }; rawStart: string; rawEnd: string }[] = [];

  if (experiences && experiences.length > 0) {
    for (const exp of experiences) {
      let startStr = exp.startDate;
      let endStr = exp.endDate;

      if (!startStr && exp.duration) {
        const parsedRange = extractDateRange(exp.duration);
        if (parsedRange.startDate) {
          startStr = parsedRange.startDate;
          endStr = parsedRange.endDate || 'Present';
        }
      }

      if (!startStr && exp.sourceEvidence) {
        const parsedRange = extractDateRange(exp.sourceEvidence);
        if (parsedRange.startDate) {
          startStr = parsedRange.startDate;
          endStr = parsedRange.endDate || 'Present';
        }
      }

      if (startStr) {
        const s = parseDateToYearMonth(startStr);
        const e = parseDateToYearMonth(endStr || 'Present');
        if (s && e) {
          datedExps.push({
            exp,
            title: exp.title,
            company: exp.company,
            start: s,
            end: e,
            rawStart: startStr,
            rawEnd: endStr || 'Present'
          });
        }
      }
    }
  }

  // If experiences didn't yield at least 2 dated roles, scan only the EXPERIENCE section of rawText
  if (datedExps.length < 2 && rawText) {
    const expMatch = rawText.match(/(?:PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT\s+HISTORY|EXPERIENCE)[\s\S]*?(?=(?:TECHNICAL\s+SKILLS|SKILLS|PROJECTS|EDUCATION|ACADEMICS|CERTIFICATIONS|ACHIEVEMENTS|LANGUAGES|ADDITIONAL\s+INFORMATION)|$)/i);
    const expSegment = expMatch ? expMatch[0] : '';
    if (expSegment) {
      const rangeRegex = /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*'?\d{2,4}|\d{1,2}[\/\.-]\d{2,4}|\d{4}))\s*(?:[–—\-\~]|to)\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*'?\d{2,4}|\d{1,2}[\/\.-]\d{2,4}|\d{4}|Present|Current|Now|Ongoing))\b/ig;
      let match: RegExpExecArray | null;
      const seenSpans = new Set<string>();

      while ((match = rangeRegex.exec(expSegment)) !== null) {
        const sStr = match[1].trim();
        const eStr = match[2].trim();
        const spanKey = `${sStr.toLowerCase()}_${eStr.toLowerCase()}`;
        if (seenSpans.has(spanKey)) continue;
        seenSpans.add(spanKey);

        const s = parseDateToYearMonth(sStr);
        const e = parseDateToYearMonth(eStr);
        if (s && e && s.year >= 1990 && e.year >= 1990) {
          const matchIndex = match.index;
          const lineStart = expSegment.lastIndexOf('\n', matchIndex) + 1;
          const lineEnd = expSegment.indexOf('\n', matchIndex + match[0].length);
          const surroundingLine = expSegment.substring(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
          const cleanedTitle = surroundingLine.replace(match[0], '').replace(/[|•–—]/g, ' ').trim();

          datedExps.push({
            title: cleanedTitle || 'Employment Period',
            company: 'Role',
            start: s,
            end: e,
            rawStart: sStr,
            rawEnd: eStr
          });
        }
      }
    }
  }

  if (datedExps.length <= 1) {
    return {
      hasGap: false,
      totalGapMonths: 0,
      gaps: [],
      statusText: 'Continuous work history (No gap identified)'
    };
  }

  // Sort chronological (oldest to newest)
  datedExps.sort((a, b) => {
    const aVal = a.start.year * 12 + a.start.month;
    const bVal = b.start.year * 12 + b.start.month;
    return aVal - bVal;
  });

  const foundGaps: CandidateCareerGap[] = [];
  let totalGapMonths = 0;

  for (let i = 0; i < datedExps.length - 1; i++) {
    const prev = datedExps[i];
    const next = datedExps[i + 1];

    const prevEndVal = prev.end.year * 12 + prev.end.month;
    const nextStartVal = next.start.year * 12 + next.start.month;

    const diffMonths = nextStartVal - prevEndVal;

    // A gap is recognized if there are >= 2 months between employment periods
    if (diffMonths >= 2) {
      const gapYears = (diffMonths / 12).toFixed(1);
      const prevComp = prev.company || prev.title || 'Previous Position';
      const nextComp = next.company || next.title || 'Next Position';
      const gapLabel = diffMonths >= 12
        ? `${gapYears} yrs (${diffMonths} mos) gap between ${prevComp} and ${nextComp}`
        : `${diffMonths} mos gap between ${prevComp} and ${nextComp}`;

      foundGaps.push({
        fromCompany: prevComp,
        toCompany: nextComp,
        startDate: prev.rawEnd,
        endDate: next.rawStart,
        gapMonths: diffMonths,
        gapLabel
      });
      totalGapMonths += diffMonths;
    }
  }

  if (foundGaps.length === 0) {
    return {
      hasGap: false,
      totalGapMonths: 0,
      gaps: [],
      statusText: 'Continuous work history (No gap identified)'
    };
  }

  return {
    hasGap: true,
    totalGapMonths,
    gaps: foundGaps,
    statusText: `${foundGaps.length} career gap${foundGaps.length > 1 ? 's' : ''} identified (${totalGapMonths} mos total)`
  };
}

/**
 * Robust Work Experience Parser (Handles multi-line titles, companies, locations, and date lines)
 */
function parseExperienceSection(expText: string, fullText: string): CandidateExperience[] {
  let textToScan = expText;
  if (!textToScan || textToScan.trim().length < 20) {
    const expMatch = fullText.match(/(?:PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT\s+HISTORY|EXPERIENCE)[\s\S]*?(?=(?:TECHNICAL\s+SKILLS|SKILLS|PROJECTS|EDUCATION|ACADEMICS|CERTIFICATIONS|ACHIEVEMENTS|LANGUAGES|ADDITIONAL\s+INFORMATION)|$)/i);
    textToScan = expMatch ? expMatch[0] : fullText;
  }
  if (!textToScan) return [];

  const rawLines = textToScan.split('\n').map(l => l.trim()).filter(Boolean);
  const lines = rawLines.filter(l => !/^(?:professional\s+experience|work\s+experience|employment\s+history|experience)$/i.test(l));

  interface RawJobHeader {
    lineIndex: number;
    consumedNextLine?: boolean;
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate: string;
    duration: string;
  }

  const jobHeaders: RawJobHeader[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateInfo = extractDateRange(line);

    if (dateInfo.startDate) {
      let title = '';
      let company = '';
      let location = '';

      const cleanedLine = dateInfo.cleanedText.replace(/^[\#\*\-\•\–\—\s|]+|[\#\*\-\•\–\—\s|]+$/g, '').trim();

      if (cleanedLine.length >= 3) {
        if (cleanedLine.includes('|')) {
          const parts = cleanedLine.split('|').map(p => p.trim());
          title = parts[0];
          company = parts[1] || '';
          location = parts[2] || '';
        } else if (cleanedLine.includes('—') || cleanedLine.includes('–')) {
          const parts = cleanedLine.split(/[—–]/).map(p => p.trim());
          title = parts[0];
          company = parts[1] || '';
        } else if (/\s+at\s+/i.test(cleanedLine)) {
          const parts = cleanedLine.split(/\s+at\s+/i).map(p => p.trim());
          title = parts[0];
          company = parts[1] || '';
        } else {
          title = cleanedLine;
        }
      }

      // Check preceding 1-3 lines before date line
      const prevNonBulletLines: string[] = [];
      for (let prevIdx = i - 1; prevIdx >= 0 && prevIdx >= i - 4; prevIdx--) {
        const prevLine = lines[prevIdx];
        if (/^[•*\-–—▪▫➢✓✔\d\.\)]\s*/.test(prevLine)) break;
        if (extractDateRange(prevLine).startDate) break;
        prevNonBulletLines.unshift(prevLine);
      }

      if (prevNonBulletLines.length === 1) {
        const pLine = prevNonBulletLines[0];
        if (pLine.includes('|') || pLine.includes('—') || pLine.includes('–') || /\s+at\s+/i.test(pLine)) {
          const sep = pLine.includes('|') ? '|' : pLine.includes('—') ? '—' : pLine.includes('–') ? '–' : ' at ';
          const parts = pLine.split(sep).map(p => p.trim());
          if (!title) title = parts[0];
          if (!company) company = parts[1] || '';
          if (parts[2] && !location) location = parts[2];
        } else if (!title && /developer|engineer|intern|lead|architect|manager|consultant|specialist|founder|analyst|designer|director/i.test(pLine)) {
          title = pLine;
        } else if (!company) {
          company = pLine;
        }
      } else if (prevNonBulletLines.length >= 2) {
        const pLine1 = prevNonBulletLines[prevNonBulletLines.length - 2];
        const pLine2 = prevNonBulletLines[prevNonBulletLines.length - 1];

        if (!title) title = pLine1;
        if (!company) {
          if (pLine2.includes(',')) {
            const parts = pLine2.split(',').map(p => p.trim());
            company = parts[0];
            location = parts.slice(1).join(', ');
          } else {
            company = pLine2;
          }
        }
      }

      // Check following line (i + 1) if title/company was on the date line
      let consumedNextLine = false;
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !/^[•*\-–—▪▫➢✓✔\d\.\)]\s*/.test(nextLine) && !extractDateRange(nextLine).startDate) {
          const isNextTitle = /developer|engineer|intern|lead|architect|manager|consultant|specialist|founder|analyst|designer|director|programmer|tester|administrator|scientist/i.test(nextLine);
          const isCleanCompany = /LLP|Inc|Ltd|Limited|Technologies|Media|Digital|Solutions|Systems|Labs|Corp|Services|Software|Pvt|Company/i.test(cleanedLine) || !/developer|engineer|intern|consultant|manager|analyst/i.test(cleanedLine);

          if (!company || company === 'Company') {
            if (isNextTitle && isCleanCompany) {
              company = cleanedLine;
              title = nextLine;
              consumedNextLine = true;
            } else if (!isNextTitle && !isCleanCompany) {
              title = cleanedLine;
              company = nextLine;
              consumedNextLine = true;
            }
          }
        }
      }

      if (company && company.includes(',') && !location) {
        const cParts = company.split(',').map(p => p.trim());
        company = cParts[0];
        location = cParts.slice(1).join(', ');
      }

      const durMonths = calculateExperienceMonths(dateInfo.startDate, dateInfo.endDate);
      const formattedDur = dateInfo.duration
        ? `${dateInfo.duration}${durMonths > 0 ? ` • ${durMonths < 12 ? `${durMonths} mos` : `${parseFloat((durMonths/12).toFixed(1))} yrs`}` : ''}`
        : '';

      jobHeaders.push({
        lineIndex: i,
        consumedNextLine,
        title: title.trim() || 'Software Engineer',
        company: company.trim() || 'Company',
        location: location.trim() || undefined,
        startDate: dateInfo.startDate,
        endDate: dateInfo.endDate || 'Present',
        duration: formattedDur
      });
    }
  }

  const experiences: CandidateExperience[] = [];
  for (let j = 0; j < jobHeaders.length; j++) {
    const jh = jobHeaders[j];
    const startBulletLine = jh.lineIndex + (jh.consumedNextLine ? 2 : 1);
    const endBulletLine = j < jobHeaders.length - 1 ? jobHeaders[j + 1].lineIndex : lines.length;

    const bullets: string[] = [];
    for (let k = startBulletLine; k < endBulletLine; k++) {
      const bLine = lines[k];
      if (/^[•*\-–—▪▫➢✓✔\d\.\)]\s*/.test(bLine) || bLine.length > 20) {
        bullets.push(bLine.replace(/^[•*\-–—▪▫➢✓✔\d\.\)]\s*/, '').trim());
      }
    }

    experiences.push({
      title: jh.title,
      company: jh.company,
      location: jh.location,
      startDate: jh.startDate,
      endDate: jh.endDate,
      duration: jh.duration,
      description: bullets.join('\n'),
      highlights: bullets,
      sourceEvidence: `${jh.title} at ${jh.company} (${jh.startDate} – ${jh.endDate})`
    });
  }

  return experiences;
}

/**
 * Robust Education Section Parser & Fallback
 */
function parseEducationSection(eduText: string, fullText: string): CandidateEducation[] {
  const educationList: CandidateEducation[] = [];
  const textToScan = eduText || fullText;
  if (!textToScan) return [];

  const lines = textToScan.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateInfo = extractDateRange(line);
    let cleaned = dateInfo.cleanedText.replace(/^[•*\-–—▪▫➢✓✔]\s*/, '').trim();

    // Check if line mentions degree keywords
    const isEduLine = /bachelor|master|b\.?tech|b\.?e\.?|bca|mca|b\.?sc|m\.?sc|mba|diploma|degree|ph\.?d|high\s*school|secondary|university|college|institute|engineering/i.test(cleaned);

    if (isEduLine || eduText) {
      let degreeStr = '';
      let institutionStr = '';
      let cgpaStr = '';

      const cgpaMatch = cleaned.match(/(?:CGPA|GPA|Percentage|Score|Marks?)[:\s]+([\d.]+(?:\s*\/\s*\d+)?%?)/i);
      if (cgpaMatch) {
        cgpaStr = cgpaMatch[0];
        cleaned = cleaned.replace(cgpaMatch[0], '').replace(/[-–—|]\s*$/, '').trim();
      }

      if (cleaned.includes('|')) {
        const parts = cleaned.split('|').map(p => p.trim());
        degreeStr = parts[0].replace(/[-–—]\s*$/, '').trim();
        institutionStr = parts.slice(1).join(' ').trim();
      } else if (cleaned.includes('—') || cleaned.includes('–')) {
        const parts = cleaned.split(/[—–]/).map(p => p.trim());
        degreeStr = parts[0].trim();
        institutionStr = parts.slice(1).join(' ').trim();
      } else {
        degreeStr = cleaned;
      }

      if (!institutionStr && i + 1 < lines.length && !lines[i + 1].startsWith('•')) {
        const nextLine = lines[i + 1].trim();
        if (/college|university|institute|school|academy/i.test(nextLine)) {
          institutionStr = nextLine;
          i++;
        }
      }

      if (degreeStr && degreeStr.length >= 3 && !/experience|summary|skills|projects/i.test(degreeStr)) {
        educationList.push({
          degree: degreeStr,
          institution: institutionStr || 'University / Institute',
          year: dateInfo.duration,
          details: cgpaStr || null,
          sourceEvidence: line
        });
      }
    }
  }

  return educationList;
}

/**
 * Robust Projects Section Parser & Fallback
 */
function parseProjectsSection(projText: string, fullText: string): CandidateProject[] {
  const projects: CandidateProject[] = [];
  const textToScan = projText || '';
  if (!textToScan) return [];

  const lines = textToScan.split('\n').map(l => l.trim()).filter(Boolean);

  let currentProject: CandidateProject | null = null;
  const descLines: string[] = [];

  for (const line of lines) {
    const isBullet = /^[•*\-–—▪▫➢✓✔\d\.\)]\s*/.test(line);

    if (!isBullet && (line.includes('|') || line.includes('–') || line.includes('—') || /^[A-Z][A-Za-z0-9\s_-]{2,45}$/.test(line))) {
      if (currentProject) {
        currentProject.description = descLines.join('\n');
        projects.push(currentProject);
        descLines.length = 0;
      }

      let name = line;
      let techArray: string[] = [];

      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        name = parts[0];
        if (parts[1]) {
          techArray = parts[1].split(/[,|•*]\s*/).map(t => t.trim()).filter(Boolean);
        }
      } else if (line.includes('–') || line.includes('—')) {
        const parts = line.split(/[–—]/).map(p => p.trim());
        name = parts[0];
        if (parts[1]) {
          techArray = parts[1].split(/[,|•*]\s*/).map(t => t.trim()).filter(Boolean);
        }
      }

      currentProject = {
        name: name.trim(),
        technologies: techArray,
        description: '',
        sourceEvidence: line
      };
      continue;
    }

    descLines.push(line.replace(/^[•*\-–—▪▫➢✓✔]\s*/, '').trim());
  }

  if (currentProject) {
    currentProject.description = descLines.join('\n');
    projects.push(currentProject);
  }

  return projects;
}

/**
 * Robust Skills Extractor from Technical Skills Section & Full Text
 */
export function parseSkillsFromText(cleanText: string, skillsSectionText?: string): string[] {
  const skillSet = new Set<string>();

  if (skillsSectionText) {
    const skillLines = skillsSectionText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of skillLines) {
      const cleaned = line.replace(/^[A-Za-z0-9\s&/]+:\s*/, '').replace(/^[•*\-–—▪▫➢✓✔]\s*/, '').trim();
      const tokens = cleaned.split(/[,|•*·;]\s*/).map(t => t.trim()).filter(t => t.length >= 1 && t.length <= 40);
      for (const token of tokens) {
        const pureSkill = token.replace(/\s*\([^)]*\)/g, '').trim();
        if (pureSkill.length >= 1 && !/^(skills|technical\s+skills|core\s+competencies)$/i.test(pureSkill)) {
          skillSet.add(pureSkill);
        }
      }
    }
  }

  const knownSkillCatalog = [
    'React', 'React.js', 'Next.js', 'TypeScript', 'JavaScript', 'HTML5', 'HTML', 'CSS3', 'CSS', 'Tailwind CSS',
    'Tailwind', 'ShadCN UI', 'Redux', 'Redux Toolkit', 'Node.js', 'Express', 'Express.js', 'MERN', 'MERN Stack',
    'MEAN Stack', 'Python', 'FastAPI', 'Django', 'Flask', 'Java', 'Spring Boot', 'Spring', 'C', 'C++', 'C#',
    '.NET', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Supabase', 'Firebase', 'AWS', 'Azure', 'GCP',
    'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'REST APIs', 'REST API',
    'Prisma ORM', 'Prisma', 'GraphQL', 'Microservices', 'Postman', 'Vercel', 'Render', 'Neon', 'Figma', 'UI/UX',
    'Bootstrap', 'Jest', 'Cypress', 'Webpack', 'Vite', 'Kafka', 'RabbitMQ', 'Linux', 'Nginx', 'Artificial Intelligence',
    'AI', 'Machine Learning', 'GenAI', 'LLM', 'Web Development', 'Full Stack', 'Frontend', 'Backend',
    'Salesforce', 'Apex', 'LWC', 'Visualforce', 'Manufacturing Cloud', 'HubSpot', 'Zoho CRM', 'CRM',
    'B2B Sales', 'B2B', 'Lead Generation', 'Cold Calling', 'Pipeline Management',
    'SAP PP', 'SAP QM', 'SAP MM', 'SAP SD', 'SAP CO', 'SAP FI', 'SAP FICO', 'SAP PM', 'SAP WM', 'SAP EWM',
    'SAP HANA', 'SAP S/4HANA', 'S/4HANA', 'SAP ERP', 'SAP ECC', 'SAP ABAP', 'SAP BASIS', 'SAP',
    'MRP', 'Material Requirements Planning', 'Quality Management', 'Production Planning', 'Shop Floor Control',
    'Master Data', 'Quality Notifications', 'Quality Inspection', 'Defects Recording', 'Inspection Plans',
    'BOM', 'Bill of Materials', 'Routing', 'Work Center', 'Batch Management', 'Six Sigma', 'Lean Manufacturing',
    'ISO 9001', 'GMP', 'LIMS', 'Supply Chain', 'Procurement', 'Excel'
  ];

  for (const skill of knownSkillCatalog) {
    const escaped = skill.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}(?:[^a-zA-Z0-9_]|$)`, 'i');
    if (regex.test(cleanText)) {
      skillSet.add(skill);
    }
  }

  // Deduplicate case-insensitively and normalize (e.g. keep "React" if "React.js" is present, or keep both clean)
  const result: string[] = [];
  const seen = new Set<string>();
  for (const s of skillSet) {
    const norm = s.trim();
    if (!norm) continue;
    const lower = norm.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(norm);
    }
  }

  return result;
}

/**
 * Extracts candidate location accurately without consuming preceding text
 */
export function extractCandidateLocation(lines: string[], cleanText: string): string | null {
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();
    const explicitMatch = line.match(/(?:location|address|city|residence|based in)[:\s\-–]+([^|•\n]{2,40})/i);
    if (explicitMatch && explicitMatch[1]) {
      const loc = explicitMatch[1].trim().replace(/^[:|\s\-–]+/, '').replace(/[,|\s]+$/, '');
      if (loc.length >= 2 && !/developer|engineer|summary|skills|experience/i.test(loc)) {
        return loc;
      }
    }
  }

  const cityPatterns = [
    /\b(Navi\s+Mumbai(?:,\s*Maharashtra)?|Mumbai(?:,\s*Maharashtra)?|Pune(?:,\s*Maharashtra)?|Bengaluru|Bangalore|Hyderabad|Delhi|New\s+Delhi|Noida|Gurgaon|Gurugram|Chennai|Kolkata|Ahmedabad|Jaipur|Thane|Ghansoli|Kalyan|Maharashtra|India|USA|UK|Canada|San\s+Francisco|Austin|New\s+York|London|Singapore)\b/i
  ];

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i];
    if (/summary|experience|education|skills|projects/i.test(line)) continue;
    for (const pat of cityPatterns) {
      const m = line.match(pat);
      if (m && m[1]) {
        const fullLocMatch = line.match(new RegExp(`${m[1]}(?:,\\s*[A-Za-z\\s]+)?`, 'i'));
        return (fullLocMatch ? fullLocMatch[0] : m[1]).trim();
      }
    }
  }

  return null;
}

/**
 * Parses CV text strictly using evidence present in the text.
 */
export function extractStructuredCandidateFromText(
  rawText: string,
  fileName: string,
  docMetrics: {
    fileType: string;
    pageCount: number;
    extractionMethod: string;
    ocrUsed: boolean;
    characterCount: number;
    wordCount: number;
  }
): CandidateParsedProfile {
  const validationErrors: string[] = [];

  const qualityCheck = validateCvTextQuality(rawText);
  if (!qualityCheck.isValid) {
    validationErrors.push(qualityCheck.reason || 'Invalid CV text quality');
    return {
      name: null,
      email: null,
      phone: null,
      location: null,
      currentTitle: null,
      currentCompany: null,
      totalExperience: null,
      relevantExperience: null,
      summary: null,
      professionalSummary: null,
      skills: [],
      technologies: [],
      tools: [],
      industries: [],
      education: [],
      certifications: [],
      languages: [],
      experience: [],
      gapAnalysis: {
        hasGap: false,
        totalGapMonths: 0,
        gaps: [],
        statusText: 'No gap identified'
      },
      responsibilities: [],
      achievements: [],
      projects: [],
      sourceEvidence: {},
      rawText: rawText || '',
      parsingStatus: 'FAILED',
      errorMessage: qualityCheck.reason || 'Unable to extract valid CV text from this document.',
      validationErrors,
      parsingMetadata: {
        fileName,
        fileType: docMetrics.fileType || 'application/pdf',
        pageCount: docMetrics.pageCount || 1,
        extractionMethod: docMetrics.extractionMethod || 'failed',
        ocrUsed: docMetrics.ocrUsed || false,
        characterCount: docMetrics.characterCount || 0,
        wordCount: docMetrics.wordCount || 0,
      },
      debug: {
        rawTextPreview: (rawText || '').substring(0, 300),
        extractionMethod: docMetrics.extractionMethod || 'failed',
        ocrUsed: docMetrics.ocrUsed || false,
        characterCount: docMetrics.characterCount || 0,
        wordCount: docMetrics.wordCount || 0,
        parserInputPreview: (rawText || '').substring(0, 200),
        parsedCandidate: {},
        validationErrors,
      },
    };
  }

  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
  const sourceEvidence: Record<string, string | undefined> = {};

  // 1. Extract discrete sections
  const sections = extractSections(cleanText);

  // 2. Email Extraction
  let email: string | null = null;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emailMatches = cleanText.match(emailRegex);
  if (emailMatches) {
    for (const match of emailMatches) {
      const validated = validateEmail(match);
      if (validated) {
        email = validated;
        sourceEvidence['email'] = match;
        break;
      }
    }
  }

  // 3. Phone Extraction
  let phone: string | null = null;
  const phonePatterns = [
    /(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}\b/g,
    /(?:\+\d{1,3}[\-\s]?)?\(?\d{3}\)?[\-\s]?\d{3}[\-\s]?\d{4}\b/g,
    /\+\d{10,14}\b/g,
  ];

  for (const pattern of phonePatterns) {
    const matches = cleanText.match(pattern);
    if (matches) {
      for (const m of matches) {
        const validated = validatePhone(m);
        if (validated) {
          phone = validated;
          sourceEvidence['phone'] = m;
          break;
        }
      }
    }
    if (phone) break;
  }

  // 4. Candidate Name Extraction
  const nameResult = extractCandidateName(lines, cleanText, fileName);
  const name = nameResult.name;
  if (nameResult.evidence) {
    sourceEvidence['name'] = nameResult.evidence;
  }

  // 5. Work Experience Extraction
  const experienceText = sections['EXPERIENCE'] || '';
  const experience = parseExperienceSection(experienceText, cleanText);

  // 6. Career Gap Analysis
  const gapAnalysis = calculateCareerGaps(experience, cleanText);

  // 7. Current Title & Company Extraction
  let currentTitle: string | null = null;
  let currentCompany: string | null = null;

  const isInvalidCompany = (c?: string | null): boolean => {
    if (!c) return true;
    const s = c.trim().toLowerCase();
    return [
      'company', 'the company', 'role', 'the role', 'this role', 'position', 'the position',
      'organization', 'experience', 'present', 'employment', 'project', 'projects',
      'self-employed', 'freelance', 'unknown', 'not specified', 'candidate profile', 'verified organization'
    ].includes(s) || s.length < 2;
  };

  if (experience.length > 0) {
    currentTitle = experience[0].title;
    for (const exp of experience) {
      if (exp.company && !isInvalidCompany(exp.company)) {
        currentCompany = exp.company;
        break;
      }
    }
    if (!currentCompany) {
      currentCompany = experience[0].company;
    }
  }

  if (isInvalidCompany(currentCompany)) {
    currentCompany = null;
  }

  if (!currentTitle || currentTitle.trim().length === 0) {
    const titleCandidates = [
      'Web Development Intern', 'Software Development Intern', 'Software Engineer Intern', 'Engineering Intern',
      'Full Stack Developer', 'Full-Stack Developer', 'Full Stack Engineer', 'Full-Stack Engineer',
      'Senior Frontend Engineer', 'Senior Frontend Developer', 'Frontend Engineer', 'Frontend Developer',
      'Senior Backend Engineer', 'Senior Backend Developer', 'Backend Engineer', 'Backend Developer',
      'Senior Software Engineer', 'Software Engineer', 'Software Developer', 'Web Developer', 'Web Developer Intern',
      'React Developer', 'Java Developer', 'Python Developer', 'DevOps Engineer', 'Cloud Architect',
      'UI/UX Designer', 'Product Designer', 'Data Scientist', 'Data Engineer', 'Intern'
    ];

    const headerText = lines.slice(0, 8).join('\n');
    for (const t of titleCandidates) {
      const reg = new RegExp(`\\b${t.replace('/', '\\/')}\\b`, 'i');
      if (reg.test(headerText)) {
        currentTitle = t;
        sourceEvidence['currentTitle'] = t;
        break;
      }
    }
  }

  // Check if company is mentioned in summary (e.g. "Founder of SJ Tech Works")
  if (!currentCompany || isInvalidCompany(currentCompany)) {
    const founderMatch = cleanText.match(/(?:founder\s+of|co-founder\s+of|working\s+at|employed\s+at)\s+([A-Za-z0-9\s&]{2,35})/i);
    if (founderMatch && founderMatch[1] && !isInvalidCompany(founderMatch[1])) {
      currentCompany = founderMatch[1].trim().replace(/[,|.\n]+$/, '');
    }
  }

  if (currentCompany && !isInvalidCompany(currentCompany)) {
    sourceEvidence['currentCompany'] = currentCompany;
  } else {
    currentCompany = null;
  }

  // 8. Total Experience Calculation (Comprehensive Multi-Pass Extractor)
  let totalExperience: string | null = null;
  let totalExperienceMonths = 0;
  let totalExperienceYears = 0;

  // Pass A: Explicit Total Experience labeled lines (e.g. "Total Experience: 3 Years 6 Months", "Experience: 3+ years")
  const explicitHeaderMatch = cleanText.match(/(?:total\s+experience|relevant\s+experience|work\s+experience|overall\s+experience|experience|career\s+history)[:\s]+(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?|y)?(?:\s*(?:and\s*)?(\d+)\s*(?:months?|mos?|m)?)?/i);
  if (explicitHeaderMatch) {
    const yrs = parseFloat(explicitHeaderMatch[1]);
    const mos = explicitHeaderMatch[2] ? parseInt(explicitHeaderMatch[2], 10) : 0;
    if (!isNaN(yrs) && yrs > 0) {
      totalExperienceMonths = Math.round(yrs * 12) + mos;
      totalExperienceYears = parseFloat((totalExperienceMonths / 12).toFixed(1));
      totalExperience = formatNumericExperience(totalExperienceMonths);
      sourceEvidence['totalExperience'] = `${explicitHeaderMatch[0]} -> ${totalExperience}`;
    }
  }

  // Pass B: Inline text mentions (e.g. "3+ years of experience", "over 3 years of hands-on experience", "3.5 yrs experience")
  if (!totalExperience) {
    const inlineExpMatch = cleanText.match(/(?:over|more\s+than|about|around|approx(?:\.|imately)?|with)?\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s*(?:and\s*)?(\d+)\s*(?:months?|mos?))?(?:\s*(?:of\s*)?(?:hands-on\s*|industry\s*|professional\s*|relevant\s*|total\s*|software\s*|work\s*)?(?:experience|exp|background|track\s*record))?/i);
    if (inlineExpMatch) {
      const parsedYears = parseFloat(inlineExpMatch[1]);
      const addMonths = inlineExpMatch[2] ? parseInt(inlineExpMatch[2], 10) : 0;
      if (!isNaN(parsedYears) && parsedYears > 0 && parsedYears <= 45) {
        totalExperienceMonths = Math.round(parsedYears * 12) + addMonths;
        totalExperienceYears = parseFloat((totalExperienceMonths / 12).toFixed(1));
        totalExperience = formatNumericExperience(totalExperienceMonths);
        sourceEvidence['totalExperience'] = `${inlineExpMatch[0]} -> ${totalExperience}`;
      }
    }
  }

  // Pass C: Word numeral mentions (e.g. "Three years of experience", "Four+ years")
  if (!totalExperience) {
    const wordNumbers: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12
    };
    const wordExpMatch = cleanText.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:\(\d+\)\s*)?(?:\+?\s*years?|\+?\s*yrs?)(?:\s*(?:of\s*)?(?:hands-on\s*|industry\s*|professional\s*|relevant\s*)?experience)?/i);
    if (wordExpMatch && wordNumbers[wordExpMatch[1].toLowerCase()]) {
      const parsedYears = wordNumbers[wordExpMatch[1].toLowerCase()];
      totalExperienceYears = parsedYears;
      totalExperienceMonths = parsedYears * 12;
      totalExperience = formatNumericExperience(totalExperienceMonths);
      sourceEvidence['totalExperience'] = `${wordExpMatch[0]} -> ${totalExperience}`;
    }
  }

  // Pass D: Calculate from parsed work experience entries
  if (experience.length > 0) {
    let sumMonths = 0;
    let earliestStartYear = 9999;
    let latestEndYear = 0;

    for (const exp of experience) {
      // 1. Calculate from explicit start and end dates
      if (exp.startDate) {
        const m = calculateExperienceMonths(exp.startDate, exp.endDate);
        if (m > 0) sumMonths += m;

        const sY = parseDateToYearMonth(exp.startDate)?.year;
        const eY = exp.endDate && /present|current|now|ongoing/i.test(exp.endDate)
          ? new Date().getFullYear()
          : parseDateToYearMonth(exp.endDate || '')?.year;
        if (sY && sY >= 1980 && sY <= new Date().getFullYear()) {
          earliestStartYear = Math.min(earliestStartYear, sY);
        }
        if (eY && eY >= 1980) {
          latestEndYear = Math.max(latestEndYear, eY);
        }
      }
      // 2. Parse from duration string if start date is missing
      else if (exp.duration) {
        const dMatch = exp.duration.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
        if (dMatch) sumMonths += Math.round(parseFloat(dMatch[1]) * 12);
        else {
          const moMatch = exp.duration.match(/(\d+)\s*(?:months?|mos?)/i);
          if (moMatch) sumMonths += parseInt(moMatch[1], 10);
        }
      }
    }

    // If sumMonths was calculated from explicit role dates/durations, use that directly.
    // Year span calculation is ONLY a fallback when individual role dates lacked month granularity.
    let calculatedMonths = sumMonths;
    if (calculatedMonths === 0 && earliestStartYear < 9999 && latestEndYear >= earliestStartYear) {
      calculatedMonths = latestEndYear === earliestStartYear ? 6 : Math.max(6, (latestEndYear - earliestStartYear) * 12);
    }

    if (calculatedMonths > 0) {
      totalExperienceMonths = calculatedMonths;
      totalExperienceYears = parseFloat((calculatedMonths / 12).toFixed(1));
      totalExperience = formatNumericExperience(calculatedMonths);
      sourceEvidence['totalExperience'] = `Calculated from work history (${experience.length} roles): ${calculatedMonths} months (~${totalExperienceYears} yrs)`;
    }
  }

  // Pass E: Fallback if candidate has work experience items but dates were unformatted
  if (!totalExperience && experience.length > 0) {
    const estimatedMonths = experience.length * 24; // estimate ~2 yrs per documented position
    totalExperienceMonths = estimatedMonths;
    totalExperienceYears = parseFloat((estimatedMonths / 12).toFixed(1));
    totalExperience = formatNumericExperience(estimatedMonths);
    sourceEvidence['totalExperience'] = `Estimated from ${experience.length} position(s): ~${totalExperienceYears} yrs`;
  }

  if (!totalExperience) {
    totalExperience = '0 yrs';
  }

  // 9. Location Extraction
  const location = extractCandidateLocation(lines, cleanText);
  if (location) {
    sourceEvidence['location'] = location;
  }

  // 10. Skills Extraction
  const skillsText = sections['SKILLS'] || '';
  const skills = parseSkillsFromText(cleanText, skillsText);
  if (skills.length > 0) {
    sourceEvidence['skills'] = skills.join(', ');
  }

  // 11. Summary Extraction
  let summary: string | null = null;
  const summaryText = sections['SUMMARY'] || '';
  if (summaryText) {
    summary = summaryText.replace(/\n+/g, ' ').trim();
    sourceEvidence['summary'] = summary;
  } else {
    // If no explicit summary header, extract intro paragraph if it looks like a summary
    for (const l of lines.slice(1, 6)) {
      if (l.length > 50 && !l.includes('@') && !l.includes('|') && /developer|engineer|experienced|passionate|specialist/i.test(l)) {
        summary = l;
        break;
      }
    }
  }

  // 12. Education Extraction
  const educationText = sections['EDUCATION'] || '';
  const education = parseEducationSection(educationText, cleanText);

  // 13. Projects Extraction
  const projectsText = sections['PROJECTS'] || '';
  const projects = parseProjectsSection(projectsText, cleanText);

  // 14. Certifications Extraction
  const certsText = sections['CERTIFICATIONS'] || '';
  const certifications: string[] = [];
  const certSource = certsText || cleanText;

  if (certsText) {
    const certLines = certsText.split('\n').map(l => l.replace(/^[•*\-–—▪▫➢✓✔\d\.\)]\s*/, '').trim()).filter(Boolean);
    for (const l of certLines) {
      certifications.push(l.replace(/^Certifications?:\s*/i, '').trim());
    }
  } else {
    // Scan whole text for certification lines
    const certMatches = certSource.match(/^[•*\-–—▪▫➢✓✔]?\s*(?:Certified|Certificate|AWS\s+Certified|Meta\s+Certified|Oracle\s+Certified|Google\s+Certified|Microsoft\s+Certified)[^\n]+/gim);
    if (certMatches) {
      for (const cm of certMatches) {
        const cleanedCert = cm.replace(/^[•*\-–—▪▫➢✓✔\d\.\)]\s*/, '').trim();
        if (cleanedCert.length > 5 && !certifications.includes(cleanedCert)) {
          certifications.push(cleanedCert);
        }
      }
    }
  }

  // 15. Languages Extraction
  const languagesText = sections['LANGUAGES'] || '';
  const languages: string[] = [];
  const langList = ['English', 'Hindi', 'Marathi', 'Spanish', 'French', 'German', 'Gujarati', 'Tamil', 'Telugu', 'Kannada', 'Bengali'];
  for (const lang of langList) {
    if (new RegExp(`\\b${lang}\\b`, 'i').test(languagesText || cleanText)) {
      languages.push(lang);
    }
  }

  const parsedProfile: CandidateParsedProfile = {
    name,
    email,
    phone,
    location,
    currentTitle,
    currentCompany,
    totalExperience,
    totalExperienceMonths,
    totalExperienceYears,
    relevantExperience: totalExperience,
    summary,
    professionalSummary: summary,
    skills,
    technologies: skills.filter(s => ['React', 'React.js', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Express.js', 'Python', 'Java', 'MongoDB', 'PostgreSQL', 'Supabase', 'Docker', 'AWS'].includes(s)),
    tools: skills.filter(s => ['Git', 'GitHub', 'Docker', 'Postman', 'Vercel', 'Render', 'Figma', 'Jest', 'Tailwind CSS'].includes(s)),
    industries: [],
    education,
    certifications,
    languages,
    experience,
    gapAnalysis,
    responsibilities: [],
    achievements: [],
    projects,
    sourceEvidence,
    rawText,
    parsingStatus: 'PARSED',
    errorMessage: undefined,
    validationErrors: [],
    parsingMetadata: {
      fileName,
      fileType: docMetrics.fileType || 'application/pdf',
      pageCount: docMetrics.pageCount || 1,
      extractionMethod: docMetrics.extractionMethod || 'direct-text',
      ocrUsed: docMetrics.ocrUsed || false,
      characterCount: docMetrics.characterCount || rawText.length,
      wordCount: docMetrics.wordCount || rawText.split(/\s+/).filter(Boolean).length,
    },
    debug: {
      rawTextPreview: rawText.substring(0, 400),
      extractionMethod: docMetrics.extractionMethod || 'direct-text',
      ocrUsed: docMetrics.ocrUsed || false,
      characterCount: docMetrics.characterCount || rawText.length,
      wordCount: docMetrics.wordCount || rawText.split(/\s+/).filter(Boolean).length,
      parserInputPreview: rawText.substring(0, 250),
      parsedCandidate: {
        name,
        email,
        phone,
        currentTitle,
        currentCompany,
        totalExperience,
        skillsCount: skills.length,
        experienceCount: experience.length,
        educationCount: education.length,
        projectsCount: projects.length,
        gapAnalysis,
      },
      validationErrors: [],
    },
  };

  return parsedProfile;
}
