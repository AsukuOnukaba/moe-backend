import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
export class WishlistRootController {
  constructor(private readonly wishlist: WishlistService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request) {
    return this.wishlist.listFullProducts(req.user as AccessTokenPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Post('items')
  addItem(@Req() req: Request, @Body() body: { productId?: number }) {
    return this.wishlist.addByProductId(
      req.user as AccessTokenPayload,
      Number(body?.productId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':productId')
  add(@Req() req: Request, @Param('productId') productId: string) {
    return this.wishlist.addByProductId(
      req.user as AccessTokenPayload,
      Number(productId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('items/:wishlistItemId')
  @HttpCode(204)
  async removeByItemId(
    @Req() req: Request,
    @Param('wishlistItemId') wishlistItemId: string,
  ) {
    await this.wishlist.removeByWishlistItemId(
      req.user as AccessTokenPayload,
      Number(wishlistItemId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':productId')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('productId') productId: string) {
    await this.wishlist.remove(req.user as AccessTokenPayload, Number(productId));
  }
}
