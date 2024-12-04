import { compare, hash } from 'bcrypt'
import { sign, verify } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

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
  } catch (error) {
    return null
  }
}

