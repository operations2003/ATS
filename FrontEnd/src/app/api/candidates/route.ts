import { NextRequest, NextResponse } from 'next/server';
import { jobCandidatesStore } from '@/lib/jobStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authToken = request.headers.get('authorization');
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:5000/api';

    try {
      const res = await fetch(`${backendUrl}/candidates`, {
        headers: {
          ...(authToken ? { Authorization: authToken } : {}),
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (backendErr: any) {
      console.warn('[Next.js /api/candidates] Backend proxy warning:', backendErr.message);
    }

    // Fallback: Aggregate candidates from jobCandidatesStore across all jobs & pool
    const combinedMap = new Map<string, any>();
    for (const [jobId, list] of Object.entries(jobCandidatesStore)) {
      if (Array.isArray(list)) {
        for (const c of list) {
          const key = c.id || c.fileName || `${c.name}_${c.email}`;
          if (!combinedMap.has(key)) {
            combinedMap.set(key, c);
          }
        }
      }
    }

    const candidatesList = Array.from(combinedMap.values());
    return NextResponse.json({
      success: true,
      total: candidatesList.length,
      candidates: candidatesList,
      data: candidatesList,
    });
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}
