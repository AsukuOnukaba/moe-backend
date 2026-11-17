import { Module, forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderReadinessController } from './order-readiness.controller';
import { OrderReadinessService } from './order-readiness.service';
import { OrderReadinessScheduler } from './order-readiness.scheduler';

@Module({
  imports: [NotificationsModule, forwardRef(() => PaymentsModule)],
  controllers: [OrderReadinessController, OrdersController],
  providers: [OrdersService, OrderReadinessService, OrderReadinessScheduler],
  exports: [OrdersService, OrderReadinessService],
})
export class OrdersModule {}

