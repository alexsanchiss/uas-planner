import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { comparePasswords, generateToken } from '../../../../lib/auth'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    const isPasswordValid = await comparePasswords(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    const token = generateToken(user.id)
    return NextResponse.json({ token }, { status: 200 })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 })
  }
}

