import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from =
      this.config.get<string>('RESEND_FROM')?.trim() ||
      'MoE Africa <onboarding@resend.dev>';

    if (!apiKey) {
      this.logger.log(
        `[email skipped] to=${params.to} subject="${params.subject}"`,
      );
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
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

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`Resend failed (${res.status}): ${body}`);
    }
  }

  async sendArtisanWelcome(params: {
    email: string;
    firstName: string;
    temporaryPassword: string;
  }) {
    const loginUrl =
      this.config.get<string>('FRONTEND_URL')?.trim() ||
      'https://moe-africa-mvp.vercel.app/auth';
    const name = params.firstName.trim() || 'Artisan';

    await this.send({
      to: params.email,
      subject: 'Welcome to MoE Africa — your artisan account',
      html: `
        <p>Hi ${name},</p>
        <p>Your MoE Africa artisan account has been created. Your application is <strong>pending review</strong>.</p>
        <p><strong>Email:</strong> ${params.email}<br/>
        <strong>Temporary password:</strong> ${params.temporaryPassword}</p>
        <p>Sign in at <a href="${loginUrl}">${loginUrl}</a> and change your password after your first login.</p>
        <p>— MoE Africa</p>
      `,
    });
  }
}
