import { Module, forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderReadinessController } from './order-readiness.controller';
import { OrderReadinessService } from './order-readiness.service';
import { OrderReadinessScheduler } from './order-readiness.scheduler';
import { ArtisanPayoutController } from './artisan-payout.controller';
import { ArtisanPayoutService } from './artisan-payout.service';
import { AdminCapabilitiesService } from '../auth/admin-capabilities.service';

@Module({
  imports: [NotificationsModule, forwardRef(() => PaymentsModule)],
  controllers: [
    OrderReadinessController,
    ArtisanPayoutController,
    OrdersController,
  ],
  providers: [
    OrdersService,
    OrderReadinessService,
    OrderReadinessScheduler,
    ArtisanPayoutService,
    AdminCapabilitiesService,
  ],
  exports: [OrdersService, OrderReadinessService, ArtisanPayoutService],
})
export class OrdersModule {}

