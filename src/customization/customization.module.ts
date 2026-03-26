import { Module } from '@nestjs/common';
import { CustomizationOrdersController } from './customization-orders.controller';
import { CustomizationOrdersService } from './customization-orders.service';

@Module({
  controllers: [CustomizationOrdersController],
  providers: [CustomizationOrdersService],
})
export class CustomizationModule {}

