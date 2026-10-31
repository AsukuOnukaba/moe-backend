import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Keep provider errors out of logs that might echo a token or an API key. */
function safeResendDetail(body: string): string {
  return body
    .replace(/re_[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/[a-f0-9]{32,}/gi, '[redacted]')
    .slice(0, 180);
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private fromAddress(): string {
    return (
      this.config.get<string>('RESEND_FROM_EMAIL')?.trim() ||
      this.config.get<string>('RESEND_FROM')?.trim() ||
      'MOE Africa <onboarding@resend.dev>'
    );
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.fromAddress();

    if (!apiKey) {
      this.logger.log(`[email skipped] subject="${params.subject}"`);
      return;
    }

    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text ?? params.html.replace(/<[^>]+>/g, ' '),
        }),
      });
    } catch {
      this.logger.warn('Resend request failed');
      return;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Resend failed (${res.status}): ${safeResendDetail(body)}`);
    }
  }

  async sendEmailVerification(params: { to: string; name: string; verifyUrl: string }) {
    const name = escapeHtml(params.name.trim() || 'there');
    const verifyUrl = escapeHtml(params.verifyUrl);
    const subject = 'Verify your MOE Africa email';
    const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f1e4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f1e4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#014421;padding:28px 32px;text-align:center;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;letter-spacing:0.28em;color:#f6edd6;">MOE</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;color:#e7c56a;margin-top:4px;">AFRICA</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1c1917;font-size:16px;line-height:1.5;">
                <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#014421;">Verify your email</h1>
                <p style="margin:0 0 16px;">Hi ${name},</p>
                <p style="margin:0 0 24px;">Confirm this address to finish creating your MOE Africa account. This link expires in 24 hours and can only be used once.</p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${verifyUrl}" style="display:inline-block;background:#014421;color:#f6edd6;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:6px;">Verify email</a>
                </p>
                <p style="margin:0 0 16px;font-size:13px;color:#57534e;">If the button does not work, copy this link into your browser:</p>
                <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${verifyUrl}" style="color:#014421;">${verifyUrl}</a></p>
                <p style="margin:0;font-size:13px;color:#57534e;">If you did not create a MOE Africa account, you can ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#78716c;text-align:center;">
                MOE Africa — makers, wear, and home
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    const text = [
      `Hi ${params.name.trim() || 'there'},`,
      '',
      'Confirm this address to finish creating your MOE Africa account. This link expires in 24 hours and can only be used once.',
      '',
      params.verifyUrl,
      '',
      'If you did not create a MOE Africa account, you can ignore this email.',
      '',
      '— MOE Africa',
    ].join('\n');

    await this.send({ to: params.to, subject, html, text });
  }

  async sendArtisanWelcome(params: {
    email: string;
    firstName: string;
    temporaryPassword: string;
  }) {
    const configured = this.config.get<string>('FRONTEND_URL')?.trim();
    let loginUrl = 'https://moe-africa-mvp.vercel.app/auth';
    if (configured) {
      try {
        loginUrl = `${new URL(configured).origin}/auth`;
      } catch {
        loginUrl = configured;
      }
    }
    const name = params.firstName.trim() || 'Artisan';

    await this.send({
      to: params.email,
      subject: 'Welcome to MoE Africa — your artisan account',
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>Your MoE Africa artisan account has been created. Your application is <strong>pending review</strong>.</p>
        <p><strong>Email:</strong> ${escapeHtml(params.email)}<br/>
        <strong>Temporary password:</strong> ${escapeHtml(params.temporaryPassword)}</p>
        <p>Sign in at <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a> and change your password after your first login.</p>
        <p>— MoE Africa</p>
      `,
    });
  }
}
