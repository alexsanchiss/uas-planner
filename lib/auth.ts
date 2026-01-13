import { compare, hash } from 'bcrypt'
import { sign, verify, JwtPayload } from 'jsonwebtoken'

// Token expiration times
export const ACCESS_TOKEN_EXPIRY = '15m' // Short-lived access token
export const REFRESH_TOKEN_EXPIRY = '7d' // Long-lived refresh token
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

// Validate JWT_SECRET is set at startup - this is a security requirement
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not set. ' +
      'This is a security requirement. Please set JWT_SECRET in your .env file.'
    )
  }
  return secret
}

// Use a separate secret for refresh tokens (can be the same, but with different prefix for clarity)
function getRefreshSecret(): string {
  const jwtSecret = getJwtSecret()
  return `refresh_${jwtSecret}`
}

const JWT_SECRET: string = getJwtSecret()
const REFRESH_SECRET: string = getRefreshSecret()

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}

/**
 * Generate a short-lived access token (15 minutes)
 */
export function generateToken(userId: number): string {
  return sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

/**
 * Generate a long-lived refresh token (7 days)
 */
export function generateRefreshToken(userId: number): string {
  return sign({ userId, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY })
}

/**
 * Verify an access token
 */
export function verifyToken(token: string): { userId: number } | null {
  try {
    const decoded = verify(token, JWT_SECRET) as JwtPayload & { userId: number; type?: string }
    // Ensure it's an access token (or legacy token without type)
    if (decoded.type && decoded.type !== 'access') {
      return null
    }
    return { userId: decoded.userId }
  } catch {
    return null
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const decoded = verify(token, REFRESH_SECRET) as JwtPayload & { userId: number; type: string }
    if (decoded.type !== 'refresh') {
      return null
    }
    return { userId: decoded.userId }
  } catch {
    return null
  }
}

/**
 * Decode a token without verification (to check expiration time)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET, { ignoreExpiration: true }) as JwtPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Check if an access token is about to expire (within 2 minutes)
 */
export function isTokenExpiringSoon(token: string): boolean {
  const decoded = decodeToken(token)
  if (!decoded || !decoded.exp) {
    return true // If we can't decode, assume it's expiring
  }
  const expiresAt = decoded.exp * 1000 // Convert to milliseconds
  const twoMinutesFromNow = Date.now() + 2 * 60 * 1000
  return expiresAt < twoMinutesFromNow
}

