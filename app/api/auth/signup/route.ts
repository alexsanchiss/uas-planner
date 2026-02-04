import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from  '../../../../lib/auth'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    })

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 })
  }
}

