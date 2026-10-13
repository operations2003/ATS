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
    const targetUrl = `${backendUrl}/candidates/${encodeURIComponent(candidateId)}/summary${query}`;

    const res = await fetch(targetUrl, {
      headers: {
        ...(authToken ? { Authorization: authToken } : {}),
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[Next.js /api/candidates/[candidateId]/summary GET Error]:', err);
    return NextResponse.json(
      { error: 'Failed to proxy candidate summary request', details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const authToken = req.headers.get('authorization');

    const backendUrl = getBackendBaseUrl();
    const targetUrl = `${backendUrl}/candidates/${encodeURIComponent(candidateId)}/summary`;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: authToken } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[Next.js /api/candidates/[candidateId]/summary POST Error]:', err);
    return NextResponse.json(
      { error: 'Failed to proxy candidate summary generation', details: err?.message },
      { status: 500 }
    );
  }
}
