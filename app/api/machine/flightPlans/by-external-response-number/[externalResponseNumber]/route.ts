import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withMachineAuth, isMachineAuthError } from '@/lib/machine-auth-middleware';

interface RouteParams {
  params: Promise<{ externalResponseNumber: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const auth = withMachineAuth(request);
  if (isMachineAuthError(auth)) return auth;

  const { externalResponseNumber } = await params;
  if (
    !externalResponseNumber.trim() ||
    externalResponseNumber.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(externalResponseNumber)
  ) {
    return NextResponse.json({ error: 'Invalid external response number' }, { status: 400 });
  }

  try {
    const flightPlan = await prisma.flightPlan.findFirst({
      where: { externalResponseNumber },
      select: { customName: true },
    });

    if (!flightPlan) {
      return NextResponse.json({ error: 'Flight plan not found' }, { status: 404 });
    }

    return NextResponse.json({ customName: flightPlan.customName });
  } catch (error) {
    console.error('Failed to look up flight plan by external response number:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
