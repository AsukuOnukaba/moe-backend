import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { CartService } from './cart.service';

@Controller('customers/me/cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.cart.list(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  add(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.cart.add(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  patch(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.cart.patch(user, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.cart.remove(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  clear(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.cart.clear(user);
  }
}

