import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { resendVerificationSchema } from '@/lib/validators'
import { sendVerificationEmail } from '@/lib/email'

function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 999999))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = resendVerificationSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 },
      )
    }

    const { email } = result.data

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || user.emailVerified) {
      // Don't reveal whether the email exists or is already verified
      return NextResponse.json(
        { message: 'If the email is registered and unverified, a new code has been sent' },
        { status: 200 },
      )
    }

    // Rate limit: 1 per minute — check if token was issued less than 60s ago
    if (user.verificationTokenExpiry) {
      const tokenIssuedAt = new Date(user.verificationTokenExpiry.getTime() - 24 * 60 * 60 * 1000)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
      if (tokenIssuedAt > oneMinuteAgo) {
        return NextResponse.json(
          { error: 'Please wait at least one minute before requesting a new code' },
          { status: 429 },
        )
      }
    }

    const verificationToken = crypto.randomUUID()
    const verificationCode = generateVerificationCode()
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationCode,
        verificationTokenExpiry,
      },
    })

    await sendVerificationEmail(email, verificationToken, verificationCode)

    return NextResponse.json(
      { message: 'If the email is registered and unverified, a new code has been sent' },
      { status: 200 },
    )
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'An error occurred while resending verification email' },
      { status: 500 },
    )
  }
}
