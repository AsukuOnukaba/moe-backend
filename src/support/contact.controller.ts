import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { SupportService } from './support.service';

/**
 * Alias for the Contact Us form.
 * Accepts either contactName/contactEmail/contactMessage or name/email/message.
 */
@Controller('support/contact')
export class ContactController {
  constructor(private readonly support: SupportService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const user = (req as { user?: AccessTokenPayload }).user;
    const customerId = user?.sub ?? null;

    const name =
      (typeof body.contactName === 'string' && body.contactName) ||
      (typeof body.name === 'string' && body.name) ||
      (typeof body.senderName === 'string' && body.senderName) ||
      '';
    const email =
      (typeof body.contactEmail === 'string' && body.contactEmail) ||
      (typeof body.email === 'string' && body.email) ||
      '';
    const message =
      (typeof body.contactMessage === 'string' && body.contactMessage) ||
      (typeof body.message === 'string' && body.message) ||
      (typeof body.description === 'string' && body.description) ||
      '';

    return this.support.create(
      {
        type: 'contact',
        name,
        email,
        message,
        subject:
          typeof body.subject === 'string'
            ? body.subject
            : name
              ? `Contact from ${name}`
              : 'Contact Us',
      },
      customerId,
    );
  }
}
