import { NextResponse } from 'next/server'
import { verifyToken } from '../../../lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const payload = verifyToken(token)

  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Extract username from email (everything before @)
    const username = user.email.split('@')[0]

    return NextResponse.json({ id : user.id , username })
  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json({ error: 'An error occurred while fetching user data' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

