import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminCustomOrdersController } from './admin-custom-orders.controller';
import { CustomOrderRankingService } from './custom-order-ranking.service';
import { CustomOrdersController } from './custom-orders.controller';
import { CustomOrdersService } from './custom-orders.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CustomOrdersController, AdminCustomOrdersController],
  providers: [CustomOrdersService, CustomOrderRankingService],
  exports: [CustomOrdersService, CustomOrderRankingService],
})
export class CustomOrdersModule {}
