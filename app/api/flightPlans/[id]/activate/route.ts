/**
 * Flight Plan Activation API - App Router
 *
 * Validates the activation window and calls the FAS activation endpoint.
 *
 * Authentication: Bearer token required (JWT)
 * Authorization: User can only activate their own flight plans
 *
 * Endpoint:
 * - POST /api/flightPlans/[id]/activate
 *
 * Workflow:
 * 1. Authenticate + parse id
 * 2. Validate body: termsAccepted must be true
 * 3. Fetch flight plan, verify ownership and authorizationStatus === 'aprobado'
 * 4. Check cooldown (5 s between attempts)
 * 5. Check activation window (scheduledAt ± 60 s)
 * 6. Persist attempt start to DB
 * 7. Call FAS GET /activation/<externalResponseNumber> (10 s timeout)
 * 8. Persist result and return
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

/**
 * FAS API base URL derived from the FAS_API_URL env var.
 * The env var typically ends in /uplan; we strip that suffix to get the host root.
 */
const FAS_API_URL = process.env.FAS_API_URL || 'http://158.42.167.56:8000/uplan';

function getFasBaseUrl(): string {
  try {
    const url = new URL(FAS_API_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return FAS_API_URL.replace(/\/uplan\/?$/, '');
  }
}

/**
 * Params type for dynamic route
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Parse and validate the flight plan ID from route params.
 */
function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * POST /api/flightPlans/[id]/activate
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { id: idParam } = await params;
  const id = parseId(idParam);

  if (id === null) {
    return NextResponse.json(
      { error: 'Invalid flight plan ID' },
      { status: 400 },
    );
  }

  // ── 2. Body validation ───────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const termsAccepted =
    body !== null &&
    typeof body === 'object' &&
    (body as Record<string, unknown>).termsAccepted === true;

  if (!termsAccepted) {
    return NextResponse.json(
      { error: 'Debe aceptar los términos' },
      { status: 400 },
    );
  }

  try {
    // ── 3. Fetch flight plan ─────────────────────────────────────────────────
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        authorizationStatus: true,
        scheduledAt: true,
        externalResponseNumber: true,
        lastActivationAttempt: true,
        activationStatus: true,
      },
    });

    if (!flightPlan) {
      return NextResponse.json(
        { error: 'Plan de vuelo no encontrado' },
        { status: 404 },
      );
    }

    if (flightPlan.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 },
      );
    }

    if (flightPlan.authorizationStatus !== 'aprobado') {
      return NextResponse.json(
        { error: 'El plan no está aprobado' },
        { status: 400 },
      );
    }

    if (!flightPlan.externalResponseNumber) {
      return NextResponse.json(
        { error: 'El plan no tiene número de respuesta externo' },
        { status: 400 },
      );
    }

    // ── 4. Cooldown check (5 s) ──────────────────────────────────────────────
    if (flightPlan.lastActivationAttempt) {
      const elapsed = Date.now() - flightPlan.lastActivationAttempt.getTime();
      if (elapsed < 5000) {
        const retryAt = new Date(flightPlan.lastActivationAttempt.getTime() + 5000);
        return NextResponse.json(
          { error: 'Cooldown activo', retryAt },
          { status: 429 },
        );
      }
    }

    // ── 5. Window check (scheduledAt ± 60 s) ────────────────────────────────
    if (!flightPlan.scheduledAt) {
      return NextResponse.json(
        { error: 'El plan no tiene hora programada' },
        { status: 400 },
      );
    }

    const windowOpen = flightPlan.scheduledAt.getTime() - 60_000;
    const windowClose = flightPlan.scheduledAt.getTime() + 60_000;
    const now = Date.now();

    if (now < windowOpen) {
      return NextResponse.json(
        { error: 'Ventana no abierta', scheduledAt: flightPlan.scheduledAt },
        { status: 400 },
      );
    }

    if (now > windowClose) {
      return NextResponse.json(
        { error: 'Ventana cerrada', scheduledAt: flightPlan.scheduledAt },
        { status: 400 },
      );
    }

    // ── 6. Persist attempt start ─────────────────────────────────────────────
    await prisma.flightPlan.update({
      where: { id },
      data: {
        termsAcceptedAt: new Date(),
        lastActivationAttempt: new Date(),
        activationStatus: 'activando',
      },
    });

    // ── 7. Call FAS activation endpoint (GET, 10 s timeout) ─────────────────
    const baseUrl = getFasBaseUrl();
    const activationUrl = `${baseUrl}/activation/${encodeURIComponent(flightPlan.externalResponseNumber)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let fasResponse: unknown;
    let fasOk = false;

    try {
      const response = await fetch(activationUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      fasOk = response.ok;

      try {
        fasResponse = await response.json();
      } catch {
        fasResponse = { status: response.status, statusText: response.statusText };
      }

      if (!fasOk) {
        throw new Error(
          `FAS returned ${response.status}: ${JSON.stringify(fasResponse)}`,
        );
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId);

      // ── 8b. FAS error ────────────────────────────────────────────────────
      const errorMessage =
        fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

      const errorPayload = fasResponse ?? { message: errorMessage };

      const updatedDenied = await prisma.flightPlan.update({
        where: { id },
        data: {
          activationStatus: 'denegado_activacion',
          activationMessage: JSON.stringify(errorPayload),
        },
      });

      return NextResponse.json({
        error: 'Activación denegada',
        message: errorMessage,
        retryAt: new Date(Date.now() + 5000),
        flightPlan: updatedDenied,
      });
    }

    // ── 8a. FAS success ──────────────────────────────────────────────────────
    const updatedPlan = await prisma.flightPlan.update({
      where: { id },
      data: {
        activatedAt: new Date(),
        activationStatus: 'autorizado_despegue',
        activationMessage: JSON.stringify(fasResponse),
      },
    });

    return NextResponse.json({
      flightPlan: updatedPlan,
      message: 'Activación autorizada',
    });
  } catch (error) {
    console.error('Error activating flight plan:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
