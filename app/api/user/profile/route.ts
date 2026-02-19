import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuth, isAuthError } from '@/lib/auth-middleware'

const profileUpdateSchema = z.object({
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) return auth

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, firstName: true, lastName: true, phone: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const result = profileUpdateSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 },
    )
  }

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: result.data,
    select: { email: true, firstName: true, lastName: true, phone: true },
  })

  return NextResponse.json(updated)
}
