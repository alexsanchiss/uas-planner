import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withMachineAuth, isMachineAuthError } from '@/lib/machine-auth-middleware';
import { getFasBaseUrl, fasFetch } from '@/lib/fas';
import { parseId } from '@/lib/http';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  const { id: idParam } = await params;
  const id = parseId(idParam);

  if (id === null) {
    return NextResponse.json(
      { error: 'Invalid flight plan ID' },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        authorizationStatus: true,
        externalResponseNumber: true,
      },
    });

    if (!flightPlan) {
      return NextResponse.json(
        { error: 'Plan de vuelo no encontrado' },
        { status: 404 }
      );
    }

    if (flightPlan.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    if (flightPlan.authorizationStatus !== 'aprobado') {
      return NextResponse.json(
        { error: 'El plan no está aprobado' },
        { status: 400 }
      );
    }

    if (!flightPlan.externalResponseNumber) {
      return NextResponse.json(
        { error: 'El plan no tiene número de respuesta externo' },
        { status: 400 }
      );
    }

    const baseUrl = getFasBaseUrl();
    const termsUrl = `${baseUrl}/terms/${encodeURIComponent(flightPlan.externalResponseNumber)}`;

    let fasResponse: Response;
    try {
      fasResponse = await fasFetch(termsUrl, { method: 'GET' });
    } catch (networkError) {
      const message =
        networkError instanceof Error ? networkError.message : String(networkError);
      console.error('[Machine Terms] FAS network error:', message);
      return NextResponse.json(
        { error: 'FAS unavailable', message },
        { status: 502 }
      );
    }

    if (!fasResponse.ok) {
      const message = `FAS returned ${fasResponse.status} ${fasResponse.statusText}`;
      console.error('[Machine Terms] FAS non-2xx response:', message);
      return NextResponse.json(
        { error: 'FAS unavailable', message },
        { status: 502 }
      );
    }

    const data = await fasResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Machine Terms] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
