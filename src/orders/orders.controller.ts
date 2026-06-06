import { Body, Controller, Get, Patch, Post, Query, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request, @Query() query: any) {
    const user = req.user as AccessTokenPayload;
    return this.orders.list(user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.orders.getById(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() body: CreateOrderDto) {
    const user = req.user as AccessTokenPayload;
    return this.orders.create(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  patch(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.orders.patch(user, id, body);
  }
}

