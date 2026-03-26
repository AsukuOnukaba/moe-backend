import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { SupportService } from './support.service';

@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    // POST endpoint is unauthenticated per spec.
    const user = (req as any).user as AccessTokenPayload | undefined;
    const customerId = user?.sub ?? null;
    return this.support.create(body, customerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.support.list(user.sub);
  }
}

