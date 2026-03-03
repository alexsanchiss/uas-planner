import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuth, isAuthError } from '@/lib/auth-middleware'
import type { Prisma } from '@prisma/client'

const createDraftSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  draftData: z.record(z.unknown()),
})

/**
 * GET /api/user/drafts — List all drafts for the authenticated user
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) return auth

  const drafts = await prisma.uplanDraft.findMany({
    where: { userId: auth.userId },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(drafts)
}

/**
 * POST /api/user/drafts — Create a new draft
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const result = createDraftSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 },
    )
  }

  const draft = await prisma.uplanDraft.create({
    data: {
      userId: auth.userId,
      name: result.data.name,
      draftData: result.data.draftData as Prisma.InputJsonValue,
    },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json(draft, { status: 201 })
}
