import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
export class CheckoutPaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.paymentMethods.listForCheckout(user.sub);
  }
}
