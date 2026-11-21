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
import { OrderProductionController } from './order-production.controller';
import { OrderProductionService } from './order-production.service';
import { OrderProductionScheduler } from './order-production.scheduler';
import { OrderQualityController } from './order-quality.controller';
import { OrderQualityService } from './order-quality.service';
import { OrderQualityScheduler } from './order-quality.scheduler';
import { OrderMilestoneController } from './order-milestone.controller';
import { OrderMilestoneService } from './order-milestone.service';
import { TestOrderSimulationController } from '../test-orders/test-order-simulation.controller';
import { TestOrderSimulationService } from '../test-orders/test-order-simulation.service';
import { shouldRegisterTestOrderController } from '../test-orders/test-order-environment';

const testOrderControllers = shouldRegisterTestOrderController()
  ? [TestOrderSimulationController]
  : [];

@Module({
  imports: [NotificationsModule, forwardRef(() => PaymentsModule)],
  controllers: [
    OrderReadinessController,
    ArtisanPayoutController,
    OrderProductionController,
    OrderQualityController,
    OrderMilestoneController,
    OrdersController,
    ...testOrderControllers,
  ],
  providers: [
    OrdersService,
    OrderReadinessService,
    OrderReadinessScheduler,
    ArtisanPayoutService,
    AdminCapabilitiesService,
    OrderProductionService,
    OrderProductionScheduler,
    OrderQualityService,
    OrderQualityScheduler,
    OrderMilestoneService,
    TestOrderSimulationService,
  ],
  exports: [
    OrdersService,
    OrderReadinessService,
    ArtisanPayoutService,
    OrderProductionService,
    OrderQualityService,
    OrderMilestoneService,
  ],
})
export class OrdersModule {}
