import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

    if (!backendUrl) {
      return NextResponse.json({
        success: false,
        error: 'BACKEND_API_URL environment variable is not configured.',
      }, { status: 500 });
    }

    // 2. Forward multipart request directly to Backend
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
      return NextResponse.json({
        success: false,
        error: `ATS Backend is unreachable (${backendErr.message}). Verify backend server is running and BACKEND_API_URL is reachable.`,
      }, { status: 503 });
    }
  } catch (err: any) {
    console.error('[Next.js API] Upload route error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to process candidate upload'
    }, { status: 500 });
  }
}

