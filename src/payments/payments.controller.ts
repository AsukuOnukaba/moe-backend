import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  initialize(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.payments.initialize(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  verify(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.payments.verify(user, body);
  }

  // Payment Methods CRUD endpoints have been moved to
  // customers/payment-methods.controller.ts at /customers/me/payment-methods route
}


