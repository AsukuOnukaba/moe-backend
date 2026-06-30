import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CartModule } from '../customers/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [OrdersModule, NotificationsModule, CartModule, MessagingModule, CategoriesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
