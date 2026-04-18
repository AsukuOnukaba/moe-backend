import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PaymentsService } from './payments.service';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly paymentMethods: PaymentMethodsService,
  ) {}

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

  // Payment Methods CRUD endpoints
  @UseGuards(JwtAuthGuard)
  @Get('customers/me/payment-methods')
  async listPaymentMethods(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.paymentMethods.findAll(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('customers/me/payment-methods')
  async createPaymentMethod(@Req() req: Request, @Body() dto: CreatePaymentMethodDto) {
    const user = req.user as AccessTokenPayload;
    return this.paymentMethods.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('customers/me/payment-methods/:id')
  @HttpCode(204)
  async deletePaymentMethod(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    await this.paymentMethods.remove(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('customers/me/payment-methods/:id/default')
  async setDefaultPaymentMethod(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.paymentMethods.setDefault(id, user.sub);
  }
}

