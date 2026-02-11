import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { resetPasswordSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = resetPasswordSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 },
      )
    }

    const { token, newPassword } = result.data
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetTokenExpiry: { gte: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 },
      )
    }

    const hashedPassword = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    })

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 },
    )
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'An error occurred during password reset' },
      { status: 500 },
    )
  }
}
