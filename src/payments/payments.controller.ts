import { Body, Controller, Get, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('gateways')
  gateways() {
    return this.payments.gateways();
  }

  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  initialize(
    @Req() req: Request,
    @Body() body: InitializePaymentDto,
    @Headers('origin') origin?: string,
  ) {
    const user = req.user as AccessTokenPayload;
    return this.payments.initialize(user, body, origin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  verify(@Req() req: Request, @Body() body: VerifyPaymentDto) {
    const user = req.user as AccessTokenPayload;
    return this.payments.verify(user, body);
  }

  @Post('webhook/paystack')
  @HttpCode(200)
  paystackWebhook(@Req() req: RequestWithRawBody) {
    return this.payments.handlePaystackWebhook(req.rawBody, req.header('x-paystack-signature') ?? undefined);
  }

  @Post('webhook/flutterwave')
  @HttpCode(200)
  flutterwaveWebhook(@Req() req: RequestWithRawBody) {
    return this.payments.handleFlutterwaveWebhook(req.rawBody, req.header('verif-hash') ?? undefined);
  }
}
