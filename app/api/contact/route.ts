import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { sendContactTicketEmail, sendContactNotificationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

const CATEGORIES = [
  'Bug Report',
  'Feature Request',
  'Account Issue',
  'Flight Plan Issue',
  'General Inquiry',
] as const;

const contactSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  category: z.enum(CATEGORIES, { error: 'Invalid category' }),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000, 'Description too long'),
});

function generateTicketNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  return `UPPS-${y}${m}${d}-${rand}`;
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const parseResult = contactSchema.safeParse(body);

    if (!parseResult.success) {
      const errors = parseResult.error.flatten();
      const firstFieldError = Object.values(errors.fieldErrors).flat()[0];
      return NextResponse.json(
        { error: 'Validation failed', message: firstFieldError || 'Invalid input' },
        { status: 400 },
      );
    }

    // Count only valid submissions: each one sends two emails
    const { allowed, resetIn } = checkRateLimit(`contact:${auth.userId}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many support tickets. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
      );
    }

    const { subject, category, description } = parseResult.data;
    const ticketNumber = generateTicketNumber();

    // Fetch user email
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Send emails (fire-and-forget, don't block response)
    void sendContactTicketEmail(user.email, ticketNumber, subject, category);
    void sendContactNotificationEmail(ticketNumber, subject, category, description, user.email);

    logger.info('Contact ticket created', { ticketNumber, userId: auth.userId, category });

    return NextResponse.json({ ticketNumber, message: 'Ticket submitted successfully' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Contact ticket submission failed', { error: detail });
    return NextResponse.json(
      { error: 'Failed to submit ticket' },
      { status: 500 },
    );
  }
}
