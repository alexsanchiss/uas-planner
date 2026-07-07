import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withMachineAuth, isMachineAuthError } from '@/lib/machine-auth-middleware';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = withMachineAuth(request);
  if (isMachineAuthError(auth)) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json(
      { error: 'Missing email query parameter' },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const flightPlans = await prisma.flightPlan.findMany({
      where: {
        userId: user.id,
        authorizationStatus: 'aprobado'
      },
      select: {
        id: true,
        customName: true,
        scheduledAt: true,
        externalResponseNumber: true,
        activationStatus: true
      }
    });

    return NextResponse.json({ flightPlans });
  } catch (error) {
    console.error('Error in Machine GET flightPlans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
