import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { WishlistService } from './wishlist.service';

@Controller('customers/me/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.wishlist.listAll(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async add(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.wishlist.add(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':productId')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('productId') productId: string) {
    const user = req.user as AccessTokenPayload;
    await this.wishlist.remove(user, Number(productId));
  }
}

