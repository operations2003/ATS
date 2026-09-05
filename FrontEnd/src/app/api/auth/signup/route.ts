import { NextResponse } from 'next/server';

export async function POST() {
  // Public account creation is disabled. Only administrators can create member accounts.
  return NextResponse.json(
    { error: 'Account creation is restricted to administrators. Public self-registration is disabled.' },
    { status: 403 }
  );
}
