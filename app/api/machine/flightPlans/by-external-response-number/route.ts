import { NextRequest, NextResponse } from 'next/server';
import { withMachineAuth, isMachineAuthError } from '@/lib/machine-auth-middleware';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = withMachineAuth(request);
  if (isMachineAuthError(auth)) return auth;

  return NextResponse.json({ error: 'Invalid external response number' }, { status: 400 });
}
