import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyRefreshToken, generateToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY_MS } from '@/lib/auth'
import { cookies } from 'next/headers'

/**
 * POST /api/auth/refresh
 * Refreshes the access token using the refresh token stored in httpOnly cookie
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('refreshToken')?.value

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      )
    }

    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken)
    if (!payload) {
      // Clear invalid refresh token cookie
      const response = NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
      response.cookies.set('refreshToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
      return response
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    })

    if (!user) {
      const response = NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
      response.cookies.set('refreshToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
      return response
    }

    // Generate new tokens
    const newAccessToken = generateToken(user.id)
    const newRefreshToken = generateRefreshToken(user.id)

    // Return new access token and set new refresh token cookie
    const response = NextResponse.json({
      token: newAccessToken,
    })

    // Set the new refresh token as httpOnly cookie
    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000, // maxAge is in seconds
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'An error occurred during token refresh' },
      { status: 500 }
    )
  }
}
