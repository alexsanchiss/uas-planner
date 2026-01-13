/**
 * Standardized API Error Response Utility
 * 
 * Provides consistent error responses across all API endpoints.
 */

import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

interface ErrorOptions {
  code?: string;
  details?: unknown;
}

/**
 * Creates a standardized error response
 */
function createErrorResponse(
  status: HttpStatus,
  message: string,
  options: ErrorOptions = {}
): NextResponse<ApiErrorResponse> {
  const { code, details } = options;
  
  const errorCode = code || getDefaultCode(status);
  
  const body: ApiErrorResponse = {
    error: {
      code: errorCode,
      message,
      ...(details !== undefined && { details }),
    },
  };

  return NextResponse.json(body, { status });
}

function getDefaultCode(status: HttpStatus): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 500: return 'INTERNAL_ERROR';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return 'ERROR';
  }
}

// ============================================
// Common Error Response Helpers
// ============================================

/**
 * 400 Bad Request - Invalid request data
 */
export function badRequest(
  message = 'Invalid request data',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(400, message, { details });
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export function unauthorized(
  message = 'Authentication required'
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(401, message);
}

/**
 * 403 Forbidden - User does not have permission
 */
export function forbidden(
  message = 'You do not have permission to access this resource'
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(403, message);
}

/**
 * 404 Not Found - Resource does not exist
 */
export function notFound(
  resource = 'Resource'
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(404, `${resource} not found`);
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export function conflict(
  message = 'Resource already exists'
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(409, message);
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
export function validationError(
  message = 'Validation failed',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(422, message, { code: 'VALIDATION_ERROR', details });
}

/**
 * 500 Internal Server Error - Unexpected error
 */
export function internalError(
  message = 'An unexpected error occurred'
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(500, message);
}

/**
 * 503 Service Unavailable - External service failure
 */
export function serviceUnavailable(
  message = 'Service temporarily unavailable'
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(503, message);
}

// ============================================
// Custom Error Response
// ============================================

/**
 * Create a custom error response with specific status and options
 */
export function apiError(
  status: HttpStatus,
  message: string,
  options?: ErrorOptions
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(status, message, options);
}

// ============================================
// Error Type Guards
// ============================================

/**
 * Check if an error is a Prisma "record not found" error
 */
export function isPrismaNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: string }).code === 'P2025'
  );
}

/**
 * Check if an error is a Prisma unique constraint violation
 */
export function isPrismaUniqueError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: string }).code === 'P2002'
  );
}
