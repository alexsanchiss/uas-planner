import type { Prisma } from '@prisma/client';

/**
 * Columns of the opt-in `?fields=summary` listing: every column EXCEPT the heavy ones
 * (fileContent MediumText, uplan LongText, activationMessage LongText), which the detail
 * endpoint GET /api/flightPlans/[id] still returns (its `?fields=summary` uses this same select). authorizationMessage stays because lists
 * read it (SCRS alternatives, "FAS procesando...", ACCEPTED_ALTERNATIVE, denial errors).
 * ponytail: explicit select (Prisma 5.22 `omit` is still a preview feature); add new light columns here.
 */
export const SUMMARY_SELECT = {
  id: true,
  customName: true,
  status: true,
  csvResult: true,
  createdAt: true,
  userId: true,
  machineAssignedId: true,
  folderId: true,
  authorizationStatus: true,
  authorizationMessage: true,
  scheduledAt: true,
  externalResponseNumber: true,
  geoawarenessData: true,
  activationStatus: true,
  activatedAt: true,
  termsAcceptedAt: true,
  lastActivationAttempt: true,
  folder: true,
} satisfies Prisma.flightPlanSelect;
