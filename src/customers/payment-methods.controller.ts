import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PaymentMethodsService } from '../payments/payment-methods.service';
import { CreatePaymentMethodDto } from '../payments/dto/create-payment-method.dto';

@Controller('customers/me/payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async listPaymentMethods(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.paymentMethods.findAll(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createPaymentMethod(@Req() req: Request, @Body() dto: CreatePaymentMethodDto) {
    const user = req.user as AccessTokenPayload;
    return this.paymentMethods.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async deletePaymentMethod(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    await this.paymentMethods.remove(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/default')
  async setDefaultPaymentMethod(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.paymentMethods.setDefault(id, user.sub);
  }
}
