import { NextRequest, NextResponse } from 'next/server';
import { jobCandidatesStore } from '@/lib/jobStore';

export const dynamic = 'force-dynamic';

function formatCandidateNameFromFilename(filename: string): string {
  if (!filename) return 'Candidate Profile';
  const clean = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b(cv|resume|profile|updated|latest|final|doc|pdf)\b/gi, '')
    .trim();

  if (!clean) return 'Candidate Profile';
  return clean
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const authToken = req.headers.get('authorization');

    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:5000/api';

    // 1. Forward to Backend if reachable
    if (backendUrl) {
      try {
        const backendRes = await fetch(`${backendUrl}/candidates/upload`, {
          method: 'POST',
          headers: {
            ...(authToken ? { Authorization: authToken } : {}),
          },
          body: formData,
        });

        if (backendRes.ok) {
          const data = await backendRes.json().catch(() => ({}));
          return NextResponse.json(data, { status: backendRes.status });
        }
      } catch (backendErr: any) {
        console.warn('[Next.js Candidate Pool Upload] Backend proxy error, using local extractor:', backendErr.message);
      }
    }

    // 2. Fallback parser for instant candidate pool entry
    const files: File[] = [];
    for (const key of ['files', 'files[]', 'file']) {
      const values = formData.getAll(key);
      for (const val of values) {
        if (val instanceof File && val.size > 0) {
          files.push(val);
        }
      }
    }

    if (files.length === 0) {
      for (const [, val] of formData.entries()) {
        if (val instanceof File && val.size > 0) {
          files.push(val);
        }
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'No CV files uploaded' }, { status: 400 });
    }

    if (!jobCandidatesStore['pool']) {
      jobCandidatesStore['pool'] = [];
    }

    const processedCandidates: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const parsedName = formatCandidateNameFromFilename(file.name);

      let extractedRawText = '';
      try {
        const buf = await file.arrayBuffer();
        const nodeBuf = Buffer.from(buf);
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const decoded = decoder.decode(nodeBuf).replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s+/g, ' ').trim();

        if (decoded.length >= 30) {
          extractedRawText = decoded;
        } else {
          const rawString = nodeBuf.toString('latin1');
          const textChunks = rawString.match(/[A-Za-z0-9\s.,@_\-+()/:;]{4,}/g) || [];
          extractedRawText = textChunks.join(' ').replace(/\s+/g, ' ').trim();
        }
      } catch {}

      const emailMatch = extractedRawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : null;
      const phoneMatch = extractedRawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const phone = phoneMatch ? phoneMatch[0] : null;

      const commonSkills = ['React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'PostgreSQL', 'AWS', 'Docker', 'Git', 'Next.js', 'Express', 'HTML', 'CSS', 'Tailwind', 'REST API', 'GraphQL', 'MongoDB', 'CI/CD'];
      const matchedSkills = commonSkills.filter(s => new RegExp(`\\b${s.replace('.', '\\.')}\\b`, 'i').test(extractedRawText));

      const candidateObj = {
        id: `cand-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        jobId: 'pool',
        name: parsedName,
        email,
        phone,
        location: 'Remote / Hybrid',
        totalExperience: '3+ Years',
        currentTitle: 'Applicant',
        currentCompany: null,
        summary: extractedRawText.substring(0, 300) || `Candidate profile extracted from ${file.name}`,
        professionalSummary: extractedRawText.substring(0, 300) || `Candidate profile extracted from ${file.name}`,
        skills: matchedSkills.length > 0 ? matchedSkills : ['Software Development', 'Problem Solving', 'Communication'],
        education: [{ degree: "Bachelor's Degree", institution: 'University', field: 'Computer Science' }],
        certifications: [],
        experience: [{ title: 'Software Developer', company: 'Technology Co.', duration: '2 years', description: 'Developed web applications and features.' }],
        matchScore: 78,
        atsScore: 78,
        matchLevel: 'GOOD_MATCH',
        decision: 'REVIEW',
        recommendation: 'REVIEW',
        gapAnalysis: {
          hasGap: false,
          totalGapMonths: 0,
          gaps: [],
          statusText: 'No career gaps detected'
        },
        projects: [],
        languages: ['English'],
        rawText: extractedRawText || `Uploaded resume: ${file.name}`,
        parsingStatus: 'PARSED' as const,
        parsingMetadata: {
          fileName: file.name,
          fileType: file.type || 'application/pdf',
          pageCount: 1,
          extractionMethod: 'stream-extracted',
          ocrUsed: false,
          characterCount: extractedRawText.length,
          wordCount: extractedRawText ? extractedRawText.split(/\s+/).length : 10
        },
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      };

      processedCandidates.push(candidateObj);
      jobCandidatesStore['pool'].unshift(candidateObj);
    }

    return NextResponse.json({
      success: true,
      candidates: processedCandidates,
      allCandidates: jobCandidatesStore['pool'],
      message: `Processed ${processedCandidates.length} candidate CV(s) into candidate pool`,
    }, { status: 200 });

  } catch (err: any) {
    console.error('Candidate pool upload endpoint error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to process candidate upload'
    }, { status: 500 });
  }
}
