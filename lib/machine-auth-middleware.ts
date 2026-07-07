import { NextRequest, NextResponse } from 'next/server';

/**
 * Result type for withMachineAuth - either true (authorized) or an error response
 */
export type MachineAuthResult = true | NextResponse;

/**
 * Type guard to check if the result is an error response
 */
export function isMachineAuthError(result: MachineAuthResult): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Authentication middleware for Machine-to-Machine API routes.
 * 
 * Verifies the x-machine-api-key header matches the MACHINE_API_KEY env variable.
 * 
 * @param request - The incoming Next.js request
 * @returns true if valid, or a 401 JSON response if invalid
 */
export function withMachineAuth(request: NextRequest): MachineAuthResult {
  const expectedKey = process.env.MACHINE_API_KEY;
  
  if (!expectedKey) {
    console.error('MACHINE_API_KEY environment variable is not set');
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Machine auth is not configured on the server' },
      { status: 500 }
    );
  }

  const providedKey = request.headers.get('x-machine-api-key');
  
  if (!providedKey) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing x-machine-api-key header' },
      { status: 401 }
    );
  }

  if (providedKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid API Key' },
      { status: 401 }
    );
  }

  return true;
}
