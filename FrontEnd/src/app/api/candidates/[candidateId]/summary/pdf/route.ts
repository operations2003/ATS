import { NextRequest, NextResponse } from 'next/server';
import { generateCandidateSummaryPdfBuffer } from '@/lib/candidateSummaryPdf';

export const dynamic = 'force-dynamic';

function getBackendBaseUrl(): string {
  let url = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://ats-d4tv.onrender.com/api').trim();
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

/**
 * POST /api/candidates/[candidateId]/summary/pdf
 * Generates identical PDFKit PDF directly on Vercel from the candidate summary state.
 * Eliminates slow backend network hops, sleeping free-tier timeouts, and avoids browser print fallback.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const summary = body.summary;

    if (!summary || !summary.overview) {
      return NextResponse.json(
        { error: 'Valid candidate summary data is required in request body' },
        { status: 400 }
      );
    }

    const pdfBuffer = await generateCandidateSummaryPdfBuffer(summary);
    const candidateName = (summary.overview.fullName || candidateId).replace(/\s+/g, '_');
    const filename = `Candidate_Summary_${candidateName}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[Next.js /api/candidates/[candidateId]/summary/pdf POST Error]:', err);
    return NextResponse.json(
      { error: 'Failed to generate PDF document on serverless edge', details: err?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/candidates/[candidateId]/summary/pdf
 * Direct URL access: Fetches summary data and streams the identical PDFKit PDF.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') || '';
    const authToken = req.headers.get('authorization');

    const backendUrl = getBackendBaseUrl();
    const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';

    // First attempt to fetch the structured summary data from backend
    try {
      const summaryRes = await fetch(`${backendUrl}/candidates/${encodeURIComponent(candidateId)}/summary${query}`, {
        headers: {
          ...(authToken ? { Authorization: authToken } : {}),
        },
        cache: 'no-store'
      });

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        if (data.summary) {
          const pdfBuffer = await generateCandidateSummaryPdfBuffer(data.summary);
          const candidateName = (data.summary.overview?.fullName || candidateId).replace(/\s+/g, '_');
          const filename = `Candidate_Summary_${candidateName}.pdf`;

          return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      }
    } catch (fetchErr) {
      console.warn('[PDF Route GET] Summary fetch warning, attempting backend streaming proxy:', fetchErr);
    }

    // Direct proxy fallback to backend PDF endpoint
    const targetUrl = `${backendUrl}/candidates/${encodeURIComponent(candidateId)}/summary/pdf${query}`;
    const res = await fetch(targetUrl, {
      headers: {
        ...(authToken ? { Authorization: authToken } : {}),
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: 'Failed to stream PDF from backend service', details: errText },
        { status: res.status }
      );
    }

    const pdfBuffer = await res.arrayBuffer();
    const contentDisposition = res.headers.get('content-disposition') || `attachment; filename="Candidate_Summary_${candidateId}.pdf"`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[Next.js /api/candidates/[candidateId]/summary/pdf GET Error]:', err);
    return NextResponse.json(
      { error: 'Failed to proxy candidate PDF download request', details: err?.message },
      { status: 500 }
    );
  }
}
