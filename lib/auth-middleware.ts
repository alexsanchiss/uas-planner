import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';

/**
 * Authentication payload returned when token verification succeeds
 */
export interface AuthPayload {
  userId: number;
}

/**
 * Result type for withAuth - either a valid payload or an error response
 */
export type AuthResult = AuthPayload | NextResponse;

/**
 * Type guard to check if the result is an error response
 */
export function isAuthError(result: AuthResult): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Authentication middleware for App Router API routes.
 * 
 * Extracts and verifies JWT from the Authorization header (Bearer token).
 * 
 * @param request - The incoming Next.js request
 * @returns The decoded payload with userId if valid, or a 401 JSON response if invalid
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = await withAuth(request);
 *   if (isAuthError(auth)) {
 *     return auth; // Returns 401 Unauthorized
 *   }
 *   // auth.userId is now available
 *   const userId = auth.userId;
 *   // ... rest of handler
 * }
 * ```
 */
export async function withAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing Authorization header' },
      { status: 401 }
    );
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid Authorization header format. Expected: Bearer <token>' },
      { status: 401 }
    );
  }

  const token = parts[1];
  
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing token' },
      { status: 401 }
    );
  }

  const payload = verifyToken(token);
  
  if (!payload) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  return payload;
}
