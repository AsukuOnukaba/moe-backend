import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health/health.controller';
import { ArtisansModule } from './artisans/artisans.module';
import { ProductsModule } from './products/products.module';
import { ServiceProvidersModule } from './service-providers/service-providers.module';
import { CartModule } from './customers/cart.module';
import { WishlistModule } from './customers/wishlist.module';
import { PreferencesModule } from './customers/preferences.module';
import { OrdersModule } from './orders/orders.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { SearchModule } from './search/search.module';
import { SupportModule } from './support/support.module';
import { CustomizationModule } from './customization/customization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      expandVariables: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ArtisansModule,
    ProductsModule,
    ServiceProvidersModule,
    CartModule,
    WishlistModule,
    PreferencesModule,
    OrdersModule,
    MessagingModule,
    NotificationsModule,
    PaymentsModule,
    SearchModule,
    SupportModule,
    CustomizationModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
