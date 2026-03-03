import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuth, isAuthError } from '@/lib/auth-middleware'
import type { Prisma } from '@prisma/client'

const updateDraftSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  draftData: z.record(z.unknown()).optional(),
})

/**
 * GET /api/user/drafts/[id] — Get a single draft with full draftData
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) return auth

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })
  }

  const draft = await prisma.uplanDraft.findFirst({
    where: { id, userId: auth.userId },
  })

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  return NextResponse.json(draft)
}

/**
 * PATCH /api/user/drafts/[id] — Update a draft (name and/or draftData)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) return auth

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })
  }

  // Verify ownership
  const existing = await prisma.uplanDraft.findFirst({
    where: { id, userId: auth.userId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  const body = await request.json()
  const result = updateDraftSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 },
    )
  }

  const updateData: Prisma.uplanDraftUpdateInput = {};
  if (result.data.name !== undefined) updateData.name = result.data.name;
  if (result.data.draftData !== undefined) updateData.draftData = result.data.draftData as Prisma.InputJsonValue;

  const updated = await prisma.uplanDraft.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json(updated)
}

/**
 * DELETE /api/user/drafts/[id] — Delete a draft
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) return auth

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })
  }

  // Verify ownership
  const existing = await prisma.uplanDraft.findFirst({
    where: { id, userId: auth.userId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  await prisma.uplanDraft.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
