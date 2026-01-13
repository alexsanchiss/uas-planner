/**
 * Authentication Utilities for UAS Planner
 * 
 * This module provides JWT-based authentication utilities including:
 * - Password hashing with bcrypt
 * - Access token generation and verification (15 minute expiry)
 * - Refresh token generation and verification (7 day expiry)
 * - Token decoding and expiration checking
 * 
 * Security Requirements:
 * - JWT_SECRET environment variable must be set
 * - Access tokens are short-lived for security
 * - Refresh tokens use a separate secret (prefixed)
 * 
 * @module lib/auth
 */

import { compare, hash } from 'bcrypt'
import { sign, verify, JwtPayload } from 'jsonwebtoken'

/** Access token expiration time (15 minutes) */
export const ACCESS_TOKEN_EXPIRY = '15m'

/** Refresh token expiration time (7 days) */
export const REFRESH_TOKEN_EXPIRY = '7d'

/** Refresh token expiration in milliseconds (7 days) */
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Retrieves the JWT secret from environment variables.
 * Throws a fatal error if not set - this is a security requirement.
 * 
 * @returns The JWT secret string
 * @throws Error if JWT_SECRET is not set
 * @internal
 */
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

/**
 * Generates the refresh token secret by prefixing the JWT secret.
 * This ensures refresh tokens cannot be used as access tokens and vice versa.
 * 
 * @returns The refresh token secret string
 * @internal
 */
function getRefreshSecret(): string {
  const jwtSecret = getJwtSecret()
  return `refresh_${jwtSecret}`
}

const JWT_SECRET: string = getJwtSecret()
const REFRESH_SECRET: string = getRefreshSecret()

/**
 * Hashes a plain text password using bcrypt with salt rounds of 10.
 * 
 * @param password - The plain text password to hash
 * @returns A promise resolving to the hashed password string
 * 
 * @example
 * ```typescript
 * const hashedPassword = await hashPassword('userPassword123')
 * // Store hashedPassword in database
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

/**
 * Compares a plain text password with a bcrypt hash.
 * 
 * @param password - The plain text password to verify
 * @param hashedPassword - The bcrypt hash to compare against
 * @returns A promise resolving to true if passwords match, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = await comparePasswords('userInput', storedHash)
 * if (!isValid) {
 *   throw new Error('Invalid password')
 * }
 * ```
 */
export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}

/**
 * Generates a short-lived JWT access token (15 minutes).
 * The token contains the user ID and token type ('access').
 * 
 * @param userId - The user's database ID
 * @returns A signed JWT access token string
 * 
 * @example
 * ```typescript
 * const token = generateToken(user.id)
 * // Return token to client in response body
 * ```
 */
export function generateToken(userId: number): string {
  return sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

/**
 * Generates a long-lived JWT refresh token (7 days).
 * The token contains the user ID and token type ('refresh').
 * Should be stored in an httpOnly cookie for security.
 * 
 * @param userId - The user's database ID
 * @returns A signed JWT refresh token string
 * 
 * @example
 * ```typescript
 * const refreshToken = generateRefreshToken(user.id)
 * // Set as httpOnly cookie
 * response.cookies.set('refreshToken', refreshToken, { httpOnly: true })
 * ```
 */
export function generateRefreshToken(userId: number): string {
  return sign({ userId, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY })
}

/**
 * Verifies an access token and extracts the user ID.
 * Returns null for invalid, expired, or refresh tokens.
 * 
 * @param token - The JWT access token to verify
 * @returns Object with userId if valid, null otherwise
 * 
 * @example
 * ```typescript
 * const payload = verifyToken(authHeader.replace('Bearer ', ''))
 * if (!payload) {
 *   return Response.json({ error: 'Unauthorized' }, { status: 401 })
 * }
 * const { userId } = payload
 * ```
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
 * Verifies a refresh token and extracts the user ID.
 * Only accepts tokens with type 'refresh' to prevent token confusion attacks.
 * 
 * @param token - The JWT refresh token to verify
 * @returns Object with userId if valid, null otherwise
 * 
 * @example
 * ```typescript
 * const refreshToken = cookies.get('refreshToken')?.value
 * const payload = verifyRefreshToken(refreshToken)
 * if (!payload) {
 *   return Response.json({ error: 'Invalid refresh token' }, { status: 401 })
 * }
 * ```
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
 * Decodes a token without verifying its signature.
 * Useful for checking expiration time on potentially expired tokens.
 * 
 * @param token - The JWT token to decode
 * @returns The decoded JWT payload, or null if decoding fails
 * 
 * @example
 * ```typescript
 * const decoded = decodeToken(token)
 * if (decoded?.exp) {
 *   console.log('Token expires at:', new Date(decoded.exp * 1000))
 * }
 * ```
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
 * Checks if an access token will expire within 2 minutes.
 * Use this to proactively refresh tokens before they expire.
 * 
 * @param token - The JWT access token to check
 * @returns true if the token will expire within 2 minutes or is invalid
 * 
 * @example
 * ```typescript
 * if (isTokenExpiringSoon(accessToken)) {
 *   const newToken = await refreshAccessToken()
 *   setAccessToken(newToken)
 * }
 * ```
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

