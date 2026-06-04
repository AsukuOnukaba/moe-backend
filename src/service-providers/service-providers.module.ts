import { Module } from '@nestjs/common';
import { ArtisansModule } from '../artisans/artisans.module';
import { ServiceProvidersController } from './service-providers.controller';
import { ServiceProvidersService } from './service-providers.service';

@Module({
  imports: [ArtisansModule],
  controllers: [ServiceProvidersController],
  providers: [ServiceProvidersService],
})
export class ServiceProvidersModule {}

