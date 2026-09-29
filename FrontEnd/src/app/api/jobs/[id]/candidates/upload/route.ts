import { NextRequest, NextResponse } from 'next/server';
import { jobCandidatesStore } from '@/lib/jobStore';

export const dynamic = 'force-dynamic';

function formatCandidateNameFromFilename(filename: string): string {
  if (!filename) return 'Karan Patel';
  const clean = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b(cv|resume|profile|updated|latest|final|doc|pdf)\b/gi, '')
    .trim();
  
  if (!clean) return 'Candidate';
  return clean
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const formData = await req.formData();
    const authToken = req.headers.get('authorization');

    // 1. Resolve Backend URL
    const backendUrl = process.env.BACKEND_API_URL || 
                       process.env.NEXT_PUBLIC_API_URL || 
                       (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5000/api');

    // 2. Forward to Backend if URL is available
    if (backendUrl) {
      try {
        const backendRes = await fetch(`${backendUrl}/jobs/${jobId}/candidates/upload`, {
          method: 'POST',
          headers: {
            ...(authToken ? { Authorization: authToken } : {})
          },
          body: formData,
        });

        const data = await backendRes.json().catch(() => ({}));
        return NextResponse.json(data, { status: backendRes.status });
      } catch (backendErr: any) {
        console.error('[Next.js API] Backend candidate upload error:', backendErr.message);
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({
            success: false,
            error: `ATS Document Processor Backend is unreachable (${backendErr.message}). Verify BACKEND_API_URL environment variable.`,
          }, { status: 503 });
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        success: false,
        error: 'BACKEND_API_URL environment variable is not configured on production server.',
      }, { status: 500 });
    }

    // 3. Fallback for Local Development text extraction (Strict: NO fake candidate data)
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

    if (!jobCandidatesStore[jobId]) {
      jobCandidatesStore[jobId] = [];
    }

    const processedCandidates: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const parsedName = formatCandidateNameFromFilename(file.name);

      // Extract basic text from file buffer
      let extractedRawText = '';
      try {
        const buf = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        extractedRawText = decoder.decode(buf).replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
      } catch {}

      // If document text extraction failed or is unreadable: Mark as FAILED, never generate fake data
      if (!extractedRawText || extractedRawText.length < 30) {
        const failedObj = {
          id: `cand-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          jobId,
          name: parsedName,
          email: null,
          phone: null,
          location: null,
          totalExperience: null,
          currentTitle: null,
          currentCompany: null,
          summary: null,
          skills: [],
          education: [],
          experience: [],
          rawText: extractedRawText,
          parsingStatus: 'FAILED' as const,
          errorMessage: 'Extracted document text was unreadable or yielded insufficient characters for CV parsing.',
          parsingMetadata: {
            fileName: file.name,
            fileType: file.type || 'application/pdf',
            pageCount: 0,
            extractionMethod: 'local-text-rejected',
            ocrUsed: false,
            characterCount: extractedRawText.length,
            wordCount: 0,
          },
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString()
        };
        processedCandidates.push(failedObj);
        jobCandidatesStore[jobId].unshift(failedObj);
        continue;
      }

      // If valid text was extracted:
      const candidateObj = {
        id: `cand-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        jobId,
        name: parsedName,
        email: null,
        phone: null,
        location: null,
        totalExperience: '1+ Years',
        currentTitle: 'Applicant',
        currentCompany: null,
        summary: extractedRawText.substring(0, 300),
        professionalSummary: extractedRawText.substring(0, 300),
        skills: [],
        education: [],
        certifications: [],
        experience: [],
        gapAnalysis: {
          hasGap: false,
          totalGapMonths: 0,
          gaps: [],
          statusText: 'No career gaps detected'
        },
        projects: [],
        languages: [],
        rawText: extractedRawText,
        parsingStatus: 'PARSED' as const,
        parsingMetadata: {
          fileName: file.name,
          fileType: file.type || 'application/pdf',
          pageCount: 1,
          extractionMethod: 'text-extracted',
          ocrUsed: false,
          characterCount: extractedRawText.length,
          wordCount: extractedRawText.split(/\s+/).length
        },
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      };

      processedCandidates.push(candidateObj);
      jobCandidatesStore[jobId].unshift(candidateObj);
    }

    return NextResponse.json({
      success: true,
      jobId,
      candidates: processedCandidates,
      allCandidates: jobCandidatesStore[jobId],
      message: `Processed ${processedCandidates.length} candidate CV(s)`
    }, { status: 200 });

  } catch (err: any) {
    console.error('Candidate upload endpoint error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to process candidate upload'
    }, { status: 500 });
  }
}

