import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { sendVerificationEmail } from '@/lib/email'
import { signupSchema, validateEmailDomain, isValidationError } from '@/lib/validators'

function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 999999))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate request body with Zod schema
    const parseResult = signupSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.flatten()
      
      // Extract specific error messages for better UX
      let errorMessage = 'Validation failed'
      
      // Check for password errors first (most common)
      if (errors.fieldErrors.password && errors.fieldErrors.password.length > 0) {
        errorMessage = errors.fieldErrors.password[0]
      } else if (errors.fieldErrors.confirmPassword && errors.fieldErrors.confirmPassword.length > 0) {
        errorMessage = errors.fieldErrors.confirmPassword[0]
      } else if (errors.fieldErrors.email && errors.fieldErrors.email.length > 0) {
        errorMessage = errors.fieldErrors.email[0]
      } else if (errors.formErrors && errors.formErrors.length > 0) {
        errorMessage = errors.formErrors[0]
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errors 
        }, 
        { status: 400 }
      )
    }

    const { email, password } = parseResult.data

    // Validate email domain exists and accepts mail
    const isValidDomain = await validateEmailDomain(email)
    if (!isValidDomain) {
      return NextResponse.json(
        { error: 'The email domain does not exist or does not accept emails' }, 
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    const verificationToken = crypto.randomUUID()
    const verificationCode = generateVerificationCode()
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        emailVerified: false,
        verificationToken,
        verificationCode,
        verificationTokenExpiry,
      },
    })

    await sendVerificationEmail(email, verificationToken, verificationCode)

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Signup error:', error)
    
    if (isValidationError(error)) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    
    return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 })
  }
}

