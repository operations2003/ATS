import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendBaseUrl(): string {
  let url = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://ats-d4tv.onrender.com/api').trim();
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

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
    const targetUrl = `${backendUrl}/candidates/${encodeURIComponent(candidateId)}/summary/docx${query}`;

    const res = await fetch(targetUrl, {
      headers: {
        ...(authToken ? { Authorization: authToken } : {}),
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: 'Failed to generate DOCX from backend service', details: errText },
        { status: res.status }
      );
    }

    const docxBuffer = await res.arrayBuffer();
    const contentDisposition = res.headers.get('content-disposition') || `attachment; filename="Candidate_Summary.docx"`;

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[Next.js /api/candidates/[candidateId]/summary/docx GET Error]:', err);
    return NextResponse.json(
      { error: 'Failed to proxy candidate DOCX download request', details: err?.message },
      { status: 500 }
    );
  }
}

