import { NextRequest, NextResponse } from 'next/server';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const token = process.env.CESIUM_ION_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Cesium Ion token is not configured on the server' },
      { status: 500 }
    );
  }

  return NextResponse.json({ token });
}
