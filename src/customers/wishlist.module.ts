import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistRootController } from './wishlist-root.controller';
import { WishlistService } from './wishlist.service';

@Module({
  controllers: [WishlistController, WishlistRootController],
  providers: [WishlistService],
})
export class WishlistModule {}

