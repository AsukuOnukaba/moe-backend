import { Module, forwardRef } from '@nestjs/common';
import { CheckoutPaymentMethodsController } from './checkout-payment-methods.controller';
import { PaymentGatewayClient } from './payment-gateway.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentMethodsService } from './payment-methods.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [PaymentsController, CheckoutPaymentMethodsController],
  providers: [PaymentsService, PaymentMethodsService, PaymentGatewayClient],
  exports: [PaymentMethodsService],
})
export class PaymentsModule {}


