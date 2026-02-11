import { MailerSend, EmailParams, Sender, Recipient, Attachment } from 'mailersend';
import { logger } from './logger';

const SENDER_EMAIL = process.env.MAILERSEND_SENDER_EMAIL || 'UPPS@sna-upv.com';
const SENDER_NAME = process.env.MAILERSEND_SENDER_NAME || 'UAS Planner';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

function getMailerSendClient(): MailerSend | null {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey || apiKey === 'your_mailersend_api_key_here') {
    logger.warn('MAILERSEND_API_KEY not configured — emails will not be sent');
    return null;
  }
  return new MailerSend({ apiKey });
}

/**
 * Send email verification with a link and 6-digit code.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  code: string,
): Promise<void> {
  const client = getMailerSendClient();
  if (!client) return;

  const verifyUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;

  const emailParams = new EmailParams()
    .setFrom(new Sender(SENDER_EMAIL, SENDER_NAME))
    .setTo([new Recipient(to)])
    .setSubject('Verify your email — SNA UPPS')
    .setHtml(
      `<h2>Welcome to SNA UPPS</h2>
<p>Please verify your email by clicking the link below or entering the verification code.</p>
<p><a href="${verifyUrl}">Verify my email</a></p>
<p>Or enter this code: <strong>${code}</strong></p>
<p>This link and code expire in 24 hours.</p>`,
    )
    .setText(
      `Welcome to SNA UPPS\n\nVerify your email: ${verifyUrl}\n\nOr enter code: ${code}\n\nExpires in 24 hours.`,
    );

  try {
    await client.email.send(emailParams);
    logger.info('Verification email sent', { to });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : JSON.stringify(error);
    logger.error('Failed to send verification email', { to, error: detail });
  }
}

/**
 * Send password reset email with a link valid for 1 hour.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const client = getMailerSendClient();
  if (!client) return;

  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  const emailParams = new EmailParams()
    .setFrom(new Sender(SENDER_EMAIL, SENDER_NAME))
    .setTo([new Recipient(to)])
    .setSubject('Reset your password — SNA UPPS')
    .setHtml(
      `<h2>Password Reset</h2>
<p>You requested a password reset. Click the link below to set a new password:</p>
<p><a href="${resetUrl}">Reset my password</a></p>
<p>This link is valid for 1 hour. If you did not request this, you can ignore this email.</p>`,
    )
    .setText(
      `Password Reset\n\nReset your password: ${resetUrl}\n\nValid for 1 hour. If you did not request this, ignore this email.`,
    );

  try {
    await client.email.send(emailParams);
    logger.info('Password reset email sent', { to });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : JSON.stringify(error);
    logger.error('Failed to send password reset email', { to, error: detail });
  }
}

/**
 * Send authorization result notification with UPLAN JSON as attachment.
 * This is a fire-and-forget notification — errors are logged but never thrown.
 */
export async function sendAuthorizationResultEmail(
  to: string,
  planName: string,
  status: 'aprobado' | 'denegado',
  message: string,
  uplanJson: string,
): Promise<void> {
  const client = getMailerSendClient();
  if (!client) return;

  const statusLabel = status === 'aprobado' ? 'Approved' : 'Denied';
  const uplanBase64 = Buffer.from(uplanJson, 'utf-8').toString('base64');

  const emailParams = new EmailParams()
    .setFrom(new Sender(SENDER_EMAIL, SENDER_NAME))
    .setTo([new Recipient(to)])
    .setSubject(`Flight plan ${statusLabel}: ${planName} — SNA UPPS`)
    .setHtml(
      `<h2>Flight Plan Authorization Result</h2>
<p>Your flight plan <strong>${planName}</strong> has been <strong>${statusLabel.toLowerCase()}</strong>.</p>
<p><strong>Details:</strong></p>
<pre>${message}</pre>
<p>The UPLAN JSON is attached to this email.</p>`,
    )
    .setText(
      `Flight Plan Authorization Result\n\nPlan: ${planName}\nStatus: ${statusLabel}\n\nDetails:\n${message}\n\nThe UPLAN JSON is attached.`,
    )
    .setAttachments([
      new Attachment(uplanBase64, `${planName}.json`, 'attachment'),
    ]);

  try {
    await client.email.send(emailParams);
    logger.info('Authorization result email sent', { to, planName, status });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : JSON.stringify(error);
    logger.error('Failed to send authorization result email', { to, planName, error: detail });
  }
}
