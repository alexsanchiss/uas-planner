import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { sendVerificationEmail } from '@/lib/email'

function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 999999))
}

export async function POST(request: Request) {
  const { email, password } = await request.json()

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    const verificationToken = crypto.randomUUID()
    const verificationCode = generateVerificationCode()
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        emailVerified: false,
        verificationToken,
        verificationCode,
        verificationTokenExpiry,
      },
    })

    await sendVerificationEmail(email, verificationToken, verificationCode)

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 })
  }
}

