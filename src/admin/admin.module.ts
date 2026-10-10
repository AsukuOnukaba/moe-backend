import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CartModule } from '../customers/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CategoriesModule } from '../categories/categories.module';
import { ScoringModule } from '../scoring/scoring.module';
import { AdminScoresController } from '../sections/admin-scores.controller';
import { SupportModule } from '../support/support.module';
import { ArtisansModule } from '../artisans/artisans.module';
import { CustomOrdersModule } from '../custom-orders/custom-orders.module';

@Module({
  imports: [
    OrdersModule,
    NotificationsModule,
    CartModule,
    MessagingModule,
    CategoriesModule,
    ScoringModule,
    SupportModule,
    ArtisansModule,
    CustomOrdersModule,
  ],
  // AdminScoresController MUST be registered before AdminController so
  // GET admin/artisans/scores is not swallowed by GET admin/artisans/:id.
  controllers: [AdminScoresController, AdminController],
  providers: [AdminService],
})
export class AdminModule {}
