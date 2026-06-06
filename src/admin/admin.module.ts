import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CartModule } from '../customers/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule, NotificationsModule, CartModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
