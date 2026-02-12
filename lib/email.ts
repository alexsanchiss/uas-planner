import { MailerSend, EmailParams, Sender, Recipient, Attachment } from 'mailersend';
import { logger } from './logger';

const SENDER_EMAIL = process.env.MAILERSEND_SENDER_EMAIL || 'UPPS@sna-upv.com';
const SENDER_NAME = process.env.MAILERSEND_SENDER_NAME || 'UPPS';
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
    .setSubject('Email Verification Required — UPPS Platform')
    .setHtml(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 3px solid #1e3a8a;">
              <h1 style="margin: 0; color: #1e3a8a; font-size: 28px; font-weight: bold;">Welcome to UPPS</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                Thank you for registering with the <strong>UPPS Platform</strong>, the advanced planning and authorization service provided by SNA-UPV.
              </p>
              <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6; color: #333;">
                To complete your registration, please verify your email address by clicking the button below or entering the verification code.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding: 20px 0;">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 14px 40px; background-color: #1e3a8a; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Verify Email Address</a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #f0f4ff; border-left: 4px solid #1e3a8a; padding: 15px; margin: 25px 0;">
                <p style="margin: 0 0 10px; font-size: 14px; color: #555;">
                  <strong>Alternatively, enter this verification code:</strong>
                </p>
                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e3a8a; letter-spacing: 4px; text-align: center;">
                  ${code}
                </p>
              </div>
              <p style="margin: 25px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                <strong>Note:</strong> This verification link and code will expire in 24 hours for security reasons.
              </p>
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="width: 70%; vertical-align: top;">
                    <p style="margin: 0 0 5px; font-size: 15px; color: #333; font-weight: bold;">Best regards,</p>
                    <p style="margin: 0 0 3px; font-size: 15px; color: #1e3a8a; font-weight: bold;">Alex Sanchis</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">UPPS Service Manager</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">Phone: +34 609 33 22 55</p>
                    <p style="margin: 0; font-size: 13px; color: #1e3a8a;"><a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a; text-decoration: none;">asanmar4@upv.edu.es</a></p>
                  </td>
                  <td style="width: 30%; text-align: right; vertical-align: middle;">
                    <img src="${APP_URL}/images/SNA_DEEPBLUE.png" alt="SNA Logo" style="max-width: 120px; height: auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                <strong>Important:</strong> This email and any attachments are confidential and intended solely for the addressee. If you are not the intended recipient, please delete this email immediately.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                Please do not reply to this email address. For inquiries or support, contact us directly at <a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a;">asanmar4@upv.edu.es</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    )
    .setText(
      `Welcome to UPPS Platform\n\nThank you for registering. To complete your registration, please verify your email address:\n\n${verifyUrl}\n\nOr enter this verification code: ${code}\n\nThis link and code expire in 24 hours.\n\n---\nBest regards,\nAlex Sanchis\nUPPS Service Manager\n+34 609 33 22 55\nasanmar4@upv.edu.es\n\n---\nThis email is confidential and intended solely for the addressee. Please do not reply to this email address. For inquiries, contact asanmar4@upv.edu.es`,
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
    .setSubject('Password Reset Request — UPPS Platform')
    .setHtml(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 3px solid #1e3a8a;">
              <h1 style="margin: 0; color: #1e3a8a; font-size: 28px; font-weight: bold;">Password Reset Request</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                We received a request to reset the password for your <strong>UPPS Platform</strong> account.
              </p>
              <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6; color: #333;">
                To proceed with resetting your password, please click the button below:
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 40px; background-color: #1e3a8a; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Reset My Password</a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #92400e;">
                  <strong>Security Notice:</strong> This password reset link is valid for 1 hour only. If you did not request this password reset, please disregard this email. Your account remains secure.
                </p>
              </div>
              <p style="margin: 25px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                If the button above doesn't work, copy and paste the following link into your browser:
              </p>
              <p style="margin: 10px 0 0; font-size: 13px; color: #1e3a8a; word-break: break-all;">
                ${resetUrl}
              </p>
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="width: 70%; vertical-align: top;">
                    <p style="margin: 0 0 5px; font-size: 15px; color: #333; font-weight: bold;">Best regards,</p>
                    <p style="margin: 0 0 3px; font-size: 15px; color: #1e3a8a; font-weight: bold;">Alex Sanchis</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">UPPS Service Manager</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">Phone: +34 609 33 22 55</p>
                    <p style="margin: 0; font-size: 13px; color: #1e3a8a;"><a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a; text-decoration: none;">asanmar4@upv.edu.es</a></p>
                  </td>
                  <td style="width: 30%; text-align: right; vertical-align: middle;">
                    <img src="${APP_URL}/images/SNA_DEEPBLUE.png" alt="SNA Logo" style="max-width: 120px; height: auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                <strong>Important:</strong> This email and any attachments are confidential and intended solely for the addressee. If you are not the intended recipient, please delete this email immediately.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                Please do not reply to this email address. For inquiries or support, contact us directly at <a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a;">asanmar4@upv.edu.es</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    )
    .setText(
      `Password Reset Request\n\nWe received a request to reset the password for your UPPS Platform account.\n\nTo reset your password, visit:\n${resetUrl}\n\nThis link is valid for 1 hour. If you did not request this password reset, please disregard this email.\n\n---\nBest regards,\nAlex Sanchis\nUPPS Service Manager\n+34 609 33 22 55\nasanmar4@upv.edu.es\n\n---\nThis email is confidential and intended solely for the addressee. Please do not reply to this email address. For inquiries, contact asanmar4@upv.edu.es`,
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
  const statusColor = status === 'aprobado' ? '#059669' : '#dc2626';
  const statusBgColor = status === 'aprobado' ? '#d1fae5' : '#fee2e2';
  const statusBorderColor = status === 'aprobado' ? '#10b981' : '#ef4444';
  const uplanBase64 = Buffer.from(uplanJson, 'utf-8').toString('base64');
  
  // Sanitize filename: remove special characters and limit length
  const sanitizedName = planName
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .substring(0, 50);
  const filename = `uplan_${sanitizedName}.json`;

  const emailParams = new EmailParams()
    .setFrom(new Sender(SENDER_EMAIL, SENDER_NAME))
    .setTo([new Recipient(to)])
    .setSubject(`Flight Plan ${statusLabel}: ${planName} — UPPS Platform`)
    .setHtml(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 3px solid #1e3a8a;">
              <h1 style="margin: 0; color: #1e3a8a; font-size: 28px; font-weight: bold;">Flight Plan Authorization Result</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                Dear valued customer,
              </p>
              <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6; color: #333;">
                Your flight plan <strong>${planName}</strong> has been processed by our UAS Planning and Authorization System.
              </p>
              
              <!-- Status Badge -->
              <div style="background-color: ${statusBgColor}; border-left: 4px solid ${statusBorderColor}; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="margin: 0 0 10px; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px;">
                  Authorization Status
                </p>
                <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${statusColor};">
                  ${statusLabel.toUpperCase()}
                </p>
              </div>

              <!-- Details Section -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 10px; font-size: 14px; color: #666; font-weight: bold;">
                  Authorization Details:
                </p>
                <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #333; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word;">${message}</div>
              </div>

              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e40af;">
                  <strong>📎 Attachment:</strong> The complete UPLAN JSON file for your flight plan is attached to this email. Please save it for your records and operational use.
                </p>
              </div>

              ${status === 'aprobado' 
                ? `<p style="margin: 25px 0 0; font-size: 14px; line-height: 1.6; color: #059669;">
                    <strong>✓ Next Steps:</strong> You may now proceed with your flight operations according to the approved plan. Please ensure all operational requirements and safety protocols are followed.
                  </p>`
                : `<p style="margin: 25px 0 0; font-size: 14px; line-height: 1.6; color: #dc2626;">
                    <strong>✗ Note:</strong> If you have questions about the denial or wish to submit a revised flight plan, please contact our team directly.
                  </p>`
              }
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="width: 70%; vertical-align: top;">
                    <p style="margin: 0 0 5px; font-size: 15px; color: #333; font-weight: bold;">Best regards,</p>
                    <p style="margin: 0 0 3px; font-size: 15px; color: #1e3a8a; font-weight: bold;">Alex Sanchis</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">UPPS Service Manager</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">UAS Planning & Authorization Service</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">Phone: +34 609 33 22 55</p>
                    <p style="margin: 0; font-size: 13px; color: #1e3a8a;"><a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a; text-decoration: none;">asanmar4@upv.edu.es</a></p>
                  </td>
                  <td style="width: 30%; text-align: right; vertical-align: middle;">
                    <img src="${APP_URL}/images/SNA_DEEPBLUE.png" alt="SNA Logo" style="max-width: 120px; height: auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                <strong>Important:</strong> This email and any attachments are confidential and intended solely for the addressee. If you are not the intended recipient, please delete this email immediately.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                Please do not reply to this email address. For inquiries or support, contact us directly at <a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a;">asanmar4@upv.edu.es</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    )
    .setText(
      `Flight Plan Authorization Result\n\nDear valued customer,\n\nYour flight plan "${planName}" has been processed.\n\nStatus: ${statusLabel.toUpperCase()}\n\nAuthorization Details:\n${message}\n\nThe UPLAN JSON file is attached to this email.\n\n${status === 'aprobado' 
        ? 'You may now proceed with your flight operations according to the approved plan.' 
        : 'If you have questions about the denial or wish to submit a revised plan, please contact our team.'
      }\n\n---\nBest regards,\nAlex Sanchis\nUPPS Service Manager\nUAS Planning & Authorization Service\n+34 609 33 22 55\nasanmar4@upv.edu.es\n\n---\nThis email is confidential and intended solely for the addressee. Please do not reply to this email address. For inquiries, contact asanmar4@upv.edu.es`,
    )
    .setAttachments([
      new Attachment(uplanBase64, filename, 'attachment'),
    ]);

  try {
    await client.email.send(emailParams);
    logger.info('Authorization result email sent', { to, planName, status });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : JSON.stringify(error);
    logger.error('Failed to send authorization result email with attachment', { to, planName, error: detail });
    
    // Retry without attachment - simplified notification
    try {
      const simplifiedEmailParams = new EmailParams()
        .setFrom(new Sender(SENDER_EMAIL, SENDER_NAME))
        .setTo([new Recipient(to)])
        .setSubject(`Flight Plan ${statusLabel}: ${planName} — UPPS Platform`)
        .setHtml(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 3px solid #1e3a8a;">
              <h1 style="margin: 0; color: #1e3a8a; font-size: 28px; font-weight: bold;">Flight Plan Authorization Result</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                Dear valued customer,
              </p>
              <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6; color: #333;">
                Your flight plan <strong>${planName}</strong> has been processed by our UAS Planning and Authorization System.
              </p>
              
              <!-- Status Badge -->
              <div style="background-color: ${statusBgColor}; border-left: 4px solid ${statusBorderColor}; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="margin: 0 0 10px; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px;">
                  Authorization Status
                </p>
                <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${statusColor};">
                  ${statusLabel.toUpperCase()}
                </p>
              </div>

              <!-- Login prompt -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e40af;">
                  <strong>📋 For more details:</strong> Please log in to the UPPS Platform to view the complete authorization details and download your UPLAN file.
                </p>
              </div>

              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding: 20px 0;">
                    <a href="${APP_URL}" style="display: inline-block; padding: 14px 40px; background-color: #1e3a8a; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Access UPPS Platform</a>
                  </td>
                </tr>
              </table>

              ${status === 'aprobado' 
                ? `<p style="margin: 25px 0 0; font-size: 14px; line-height: 1.6; color: #059669;">
                    <strong>✓ Next Steps:</strong> You may now proceed with your flight operations according to the approved plan. Please ensure all operational requirements and safety protocols are followed.
                  </p>`
                : `<p style="margin: 25px 0 0; font-size: 14px; line-height: 1.6; color: #dc2626;">
                    <strong>✗ Note:</strong> If you have questions about the denial or wish to submit a revised flight plan, please contact our team directly.
                  </p>`
              }
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="width: 70%; vertical-align: top;">
                    <p style="margin: 0 0 5px; font-size: 15px; color: #333; font-weight: bold;">Best regards,</p>
                    <p style="margin: 0 0 3px; font-size: 15px; color: #1e3a8a; font-weight: bold;">Alex Sanchis</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">UPPS Service Manager</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">UAS Planning & Authorization Service</p>
                    <p style="margin: 0 0 3px; font-size: 13px; color: #666;">Phone: +34 609 33 22 55</p>
                    <p style="margin: 0; font-size: 13px; color: #1e3a8a;"><a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a; text-decoration: none;">asanmar4@upv.edu.es</a></p>
                  </td>
                  <td style="width: 30%; text-align: right; vertical-align: middle;">
                    <img src="${APP_URL}/images/SNA_DEEPBLUE.png" alt="SNA Logo" style="max-width: 120px; height: auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                <strong>Important:</strong> This email and any attachments are confidential and intended solely for the addressee. If you are not the intended recipient, please delete this email immediately.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #999; text-align: center;">
                Please do not reply to this email address. For inquiries or support, contact us directly at <a href="mailto:asanmar4@upv.edu.es" style="color: #1e3a8a;">asanmar4@upv.edu.es</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        )
        .setText(
          `Flight Plan Authorization Result\n\nDear valued customer,\n\nYour flight plan "${planName}" has been processed.\n\nStatus: ${statusLabel.toUpperCase()}\n\nFor complete details and to download your UPLAN file, please log in to the UPPS Platform:\n${APP_URL}\n\n${status === 'aprobado' 
            ? 'You may now proceed with your flight operations according to the approved plan.' 
            : 'If you have questions about the denial or wish to submit a revised plan, please contact our team.'
          }\n\n---\nBest regards,\nAlex Sanchis\nUPPS Service Manager\nUAS Planning & Authorization Service\n+34 609 33 22 55\nasanmar4@upv.edu.es\n\n---\nThis email is confidential and intended solely for the addressee. Please do not reply to this email address. For inquiries, contact asanmar4@upv.edu.es`,
        );

      await client.email.send(simplifiedEmailParams);
      logger.info('Authorization result email sent without attachment (fallback)', { to, planName, status });
    } catch (retryError: unknown) {
      const retryDetail = retryError instanceof Error ? retryError.message : JSON.stringify(retryError);
      logger.error('Failed to send authorization result email even without attachment', { to, planName, error: retryDetail });
    }
  }
}
