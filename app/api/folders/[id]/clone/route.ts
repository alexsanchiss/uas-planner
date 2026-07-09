import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { idSchema } from '@/lib/validators';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { id: idParam } = await params;

  const idResult = idSchema.safeParse(idParam);
  if (!idResult.success) {
    return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
  }
  const folderId = idResult.data;

  try {
    const originalFolder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!originalFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (originalFolder.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this folder' },
        { status: 403 }
      );
    }

    // Fetch the original plans
    const originalPlans = await prisma.flightPlan.findMany({
      where: { folderId },
      orderBy: { id: 'asc' },
    });

    // We fetch all csv results for these plans to clone them
    const originalPlanIds = originalPlans.map(p => p.id);
    const originalCsvResults = await prisma.csvResult.findMany({
      where: { id: { in: originalPlanIds } },
    });

    const csvResultMap = new Map(originalCsvResults.map(c => [c.id, c.csvResult]));

    // Create the new folder
    const newFolder = await prisma.folder.create({
      data: {
        name: `${originalFolder.name}_copy`,
        userId: userId,
        minScheduledAt: originalFolder.minScheduledAt,
        maxScheduledAt: originalFolder.maxScheduledAt,
        createdAt: originalFolder.createdAt,
      },
    });

    const clonedPlans = [];

    // Create new flight plans and their csv results
    for (const plan of originalPlans) {
      const newPlan = await prisma.flightPlan.create({
        data: {
          customName: plan.customName,
          status: plan.status,
          fileContent: plan.fileContent,
          userId: userId,
          folderId: newFolder.id,
          uplan: plan.uplan,
          scheduledAt: plan.scheduledAt,
          csvResult: plan.csvResult,
          authorizationStatus: plan.authorizationStatus,
          authorizationMessage: plan.authorizationMessage,
          externalResponseNumber: plan.externalResponseNumber,
          geoawarenessData: plan.geoawarenessData ?? Prisma.DbNull,
          activationStatus: plan.activationStatus,
          activatedAt: plan.activatedAt,
          activationMessage: plan.activationMessage,
          termsAcceptedAt: plan.termsAcceptedAt,
          lastActivationAttempt: plan.lastActivationAttempt,
          createdAt: plan.createdAt,
        },
      });

      // If the original plan had a csvResult, we duplicate it using the NEW plan's ID
      const csvData = csvResultMap.get(plan.id);
      if (csvData) {
        await prisma.csvResult.create({
          data: {
            id: newPlan.id,
            csvResult: csvData,
          },
        });
      }

      clonedPlans.push(newPlan);
    }

    return NextResponse.json({
      folder: newFolder,
      flightPlans: clonedPlans,
    });
  } catch (error) {
    console.error('Error cloning folder:', error);
    return NextResponse.json({ error: 'Error cloning folder' }, { status: 500 });
  }
}
