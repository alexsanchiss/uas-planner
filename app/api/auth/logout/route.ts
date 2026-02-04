import { NextResponse } from 'next/server'

/**
 * POST /api/auth/logout
 * Clears the refresh token cookie
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Clear the refresh token cookie
  response.cookies.set('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Immediately expire
  })

  return response
}
