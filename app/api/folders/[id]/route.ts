/**
 * Folders by ID API - App Router
 * 
 * Endpoint for individual folder operations.
 * 
 * Authentication: Bearer token required (JWT)
 * Security: User can only access their own folders
 * 
 * Endpoints:
 * - GET    /api/folders/[id] - Get folder by ID with flight plans
 * - PUT    /api/folders/[id] - Update folder (rename, dates)
 * - DELETE /api/folders/[id] - Delete folder and all associated data
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { idSchema, folderUpdateSchema, safeParseBody } from '@/lib/validators';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/folders/[id]
 * Get a folder by ID with its flight plans
 * 
 * Authorization: User can only access their own folders
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { id: idParam } = await params;

  // Validate ID parameter
  const idResult = idSchema.safeParse(idParam);
  if (!idResult.success) {
    return NextResponse.json(
      { error: 'Invalid folder ID' },
      { status: 400 }
    );
  }
  const folderId = idResult.data;

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        flightPlans: true,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Authorization: Check if user owns this folder
    if (folder.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this folder' },
        { status: 403 }
      );
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json(
      { error: 'Error fetching folder' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/folders/[id]
 * Update a folder (rename, update dates)
 * 
 * Request body: { name?, minScheduledAt?, maxScheduledAt? }
 * Authorization: User can only update their own folders
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { id: idParam } = await params;

  // Validate ID parameter
  const idResult = idSchema.safeParse(idParam);
  if (!idResult.success) {
    return NextResponse.json(
      { error: 'Invalid folder ID' },
      { status: 400 }
    );
  }
  const folderId = idResult.data;

  // Check folder exists and user owns it
  try {
    const existingFolder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!existingFolder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Authorization: Check if user owns this folder
    if (existingFolder.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this folder' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error checking folder:', error);
    return NextResponse.json(
      { error: 'Error checking folder' },
      { status: 500 }
    );
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate request body
  const result = safeParseBody(folderUpdateSchema, body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.errors },
      { status: 400 }
    );
  }

  const { name, minScheduledAt, maxScheduledAt } = result.data;

  try {
    const updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        ...(name !== undefined && { name }),
        ...(minScheduledAt !== undefined && { minScheduledAt }),
        ...(maxScheduledAt !== undefined && { maxScheduledAt }),
      },
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json(
      { error: 'Error updating folder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[id]
 * Delete a folder and all associated data
 * 
 * This will:
 * 1. Delete all CSV results associated with flight plans in the folder
 * 2. Delete all flight plans in the folder
 * 3. Delete the folder itself
 * 
 * Authorization: User can only delete their own folders
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { id: idParam } = await params;

  // Validate ID parameter
  const idResult = idSchema.safeParse(idParam);
  if (!idResult.success) {
    return NextResponse.json(
      { error: 'Invalid folder ID' },
      { status: 400 }
    );
  }
  const folderId = idResult.data;

  // Check folder exists and user owns it
  try {
    const existingFolder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!existingFolder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Authorization: Check if user owns this folder
    if (existingFolder.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this folder' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error checking folder:', error);
    return NextResponse.json(
      { error: 'Error checking folder' },
      { status: 500 }
    );
  }

  try {
    // Get all flight plans associated with this folder

    const folderPlans = await prisma.flightPlan.findMany({
      where: { folderId },
      select: { id: true },
    });

    // Delete CSV results associated with flight plans (use plan.id, not csvResult)
    const csvResultIds = folderPlans.map((plan) => plan.id);

    if (csvResultIds.length > 0) {
      await prisma.csvResult.deleteMany({
        where: { id: { in: csvResultIds } },
      });
    }

    // Delete all flight plans in the folder
    await prisma.flightPlan.deleteMany({
      where: { folderId },
    });

    // Delete the folder
    await prisma.folder.delete({
      where: { id: folderId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Error deleting folder' },
      { status: 500 }
    );
  }
}
