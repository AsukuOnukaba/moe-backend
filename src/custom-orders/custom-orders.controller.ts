import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { CustomOrdersService } from './custom-orders.service';
import { CreateCustomOrderDto } from './dto/create-custom-order.dto';
import { RespondCustomOrderDto } from './dto/respond-custom-order.dto';
import { UpdateCustomOrderStatusDto } from './dto/update-custom-order-status.dto';

@Controller()
export class CustomOrdersController {
  constructor(private readonly customOrders: CustomOrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('custom-orders')
  create(@Req() req: Request, @Body() dto: CreateCustomOrderDto) {
    return this.customOrders.create(req.user as AccessTokenPayload, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('custom-orders/me')
  listMine(@Req() req: Request) {
    return this.customOrders.listForCustomer(req.user as AccessTokenPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Get('artisans/me/custom-orders')
  listForArtisan(@Req() req: Request) {
    return this.customOrders.listForArtisan(req.user as AccessTokenPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('custom-orders/:id/respond')
  respond(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondCustomOrderDto,
  ) {
    return this.customOrders.respond(
      req.user as AccessTokenPayload,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('custom-orders/:id/status')
  updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomOrderStatusDto,
  ) {
    return this.customOrders.updateStatus(
      req.user as AccessTokenPayload,
      id,
      dto,
    );
  }

  /** @deprecated Prefer PATCH /custom-orders/:id/respond */
  @UseGuards(JwtAuthGuard)
  @Patch('artisans/me/custom-orders/:id')
  respondLegacy(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: { status?: 'accepted' | 'declined'; artisanResponse?: string },
  ) {
    const action = body?.status === 'accepted' ? 'accept' : 'decline';
    const response =
      body?.artisanResponse?.trim() ||
      (action === 'accept'
        ? 'Thank you — I accept this custom order request.'
        : 'Thank you — I am unable to accept this custom order.');
    return this.customOrders.respond(req.user as AccessTokenPayload, id, {
      action,
      response,
    });
  }
}
