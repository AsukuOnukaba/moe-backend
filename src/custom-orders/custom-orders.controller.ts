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

@Controller()
export class CustomOrdersController {
  constructor(private readonly customOrders: CustomOrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('custom-orders')
  create(@Req() req: Request, @Body() dto: CreateCustomOrderDto) {
    return this.customOrders.create(req.user as AccessTokenPayload, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('artisans/me/custom-orders')
  listForArtisan(@Req() req: Request) {
    return this.customOrders.listForArtisan(req.user as AccessTokenPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('artisans/me/custom-orders/:id')
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
}
