import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { forgotPasswordSchema } from '@/lib/validators'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = forgotPasswordSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 },
      )
    }

    const { email } = result.data

    const user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      const rawToken = crypto.randomUUID()
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetTokenExpiry: expiry,
        },
      })

      await sendPasswordResetEmail(email, rawToken)
    }

    // Always return 200 to prevent email enumeration
    return NextResponse.json(
      { message: 'If a matching account is found, a password reset email has been sent.' },
      { status: 200 },
    )
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 },
    )
  }
}
