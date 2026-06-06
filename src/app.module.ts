import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { SearchModule } from './search/search.module';
import { SupportModule } from './support/support.module';
import { CustomizationModule } from './customization/customization.module';
import { AdminModule } from './admin/admin.module';
import { MetaModule } from './meta/meta.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      expandVariables: true,
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
    CustomersModule,
    OrdersModule,
    MessagingModule,
    NotificationsModule,
    PaymentsModule,
    SearchModule,
    SupportModule,
    CustomizationModule,
    AdminModule,
    MetaModule,
    CategoriesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
