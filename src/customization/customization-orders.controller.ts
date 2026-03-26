import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { CustomizationOrdersService } from './customization-orders.service';

@Controller()
export class CustomizationOrdersController {
  constructor(private readonly custom: CustomizationOrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('customization-orders')
  create(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.custom.create(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('customization-orders/:id')
  get(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.custom.getById(user, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/custom-requests')
  submitCustomRequest(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.custom.createCustomRequest(user, body);
  }
}

