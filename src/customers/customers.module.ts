import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { PaymentMethodsController } from './payment-methods.controller';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [UsersModule, PaymentsModule],
  controllers: [AddressesController, PaymentMethodsController],
})
export class CustomersModule {}
