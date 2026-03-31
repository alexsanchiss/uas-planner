import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { comparePasswords, generateToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY_MS } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, resetIn } = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
    );
  }

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

    if (!user.emailVerified) {
      return NextResponse.json({ requiresVerification: true, email: user.email }, { status: 200 })
    }

    // Generate access token (short-lived, 15 minutes)
    const token = generateToken(user.id)
    
    // Generate refresh token (long-lived, 7 days)
    const refreshToken = generateRefreshToken(user.id)

    // Create response with access token in body
    const response = NextResponse.json({ token }, { status: 200 })
    
    // Set refresh token as httpOnly cookie
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000, // maxAge is in seconds
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 })
  }
}

