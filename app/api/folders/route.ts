/**
 * Folders API - App Router
 * 
 * Endpoint for folder operations (list & create).
 * 
 * Authentication: Bearer token required (JWT)
 * Security: userId is extracted from token, never from request body
 * 
 * Endpoints:
 * - GET  /api/folders - List all folders for authenticated user
 * - POST /api/folders - Create a new folder
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { safeParseBody } from '@/lib/validators';
import { z } from 'zod';

/**
 * GET /api/folders
 * List all folders for the authenticated user
 * 
 * Query params: none required (userId from token)
 * 
 * Response: Array of folders with their flight plans
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  try {
    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        flightPlans: true,
      },
      orderBy: { id: 'desc' },
    });

    return NextResponse.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { error: 'Error fetching folders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/folders
 * Create a new folder for the authenticated user
 * 
 * Request body: { name, minScheduledAt?, maxScheduledAt? }
 * 
 * Note: userId is taken from the auth token for security
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validation schema for folder creation (userId comes from token)
  const folderSchema = z.object({
    name: z.string().min(1, 'Folder name is required').max(255),
    minScheduledAt: z.string().nullable().optional(),
    maxScheduledAt: z.string().nullable().optional(),
  });

  const result = safeParseBody(folderSchema, body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.errors },
      { status: 400 }
    );
  }

  const { name, minScheduledAt, maxScheduledAt } = result.data;

  try {
    const newFolder = await prisma.folder.create({
      data: {
        name,
        userId, // Always from auth token
        minScheduledAt: minScheduledAt ?? null,
        maxScheduledAt: maxScheduledAt ?? null,
      },
    });

    return NextResponse.json(newFolder, { status: 201 });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Error creating folder' },
      { status: 500 }
    );
  }
}
