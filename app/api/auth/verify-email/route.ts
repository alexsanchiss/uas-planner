import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyEmailSchema } from '@/lib/validators'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, resetIn } = checkRateLimit(`verify-email:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
    );
  }

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
          emailVerified: false,
        },
      })
    } else {
      user = await prisma.user.findFirst({
        where: {
          email: data.email,
          verificationCode: data.code,
          verificationTokenExpiry: { gte: new Date() },
          emailVerified: false,
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
