import { compare, hash } from 'bcrypt'
import { sign, verify } from 'jsonwebtoken'

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

const JWT_SECRET: string = getJwtSecret()

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}

export function generateToken(userId: number): string {
  return sign({ userId }, JWT_SECRET, { expiresIn: '1d' })
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    return verify(token, JWT_SECRET) as { userId: number }
  } catch {
    return null
  }
}

