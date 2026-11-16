import type { Prisma } from '@prisma/client';

/**
 * Activation columns as a fresh authorization starts them (the schema defaults). Activation belongs to
 * ONE FAS authorization: the plan reset and every new authorization request write this, otherwise a
 * reused plan keeps the previous flight's `activatedAt` and Plan Activation refuses to activate it again.
 */
export const CLEARED_ACTIVATION = {
  activationStatus: 'no activable',
  activatedAt: null,
  activationMessage: null,
  termsAcceptedAt: null,
  lastActivationAttempt: null,
} satisfies Prisma.flightPlanUpdateInput;
