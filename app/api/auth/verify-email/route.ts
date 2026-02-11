import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyEmailSchema } from '@/lib/validators'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = verifyEmailSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 },
      )
    }

    const data = result.data

    let user

    if ('token' in data) {
      user = await prisma.user.findFirst({
        where: {
          verificationToken: data.token,
          verificationTokenExpiry: { gte: new Date() },
        },
      })
    } else {
      user = await prisma.user.findFirst({
        where: {
          email: data.email,
          verificationCode: data.code,
          verificationTokenExpiry: { gte: new Date() },
        },
      })
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token/code' },
        { status: 400 },
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationCode: null,
        verificationTokenExpiry: null,
      },
    })

    return NextResponse.json({ message: 'Email verified successfully' }, { status: 200 })
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json(
      { error: 'An error occurred during email verification' },
      { status: 500 },
    )
  }
}
