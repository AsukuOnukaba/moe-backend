"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const env_validation_1 = require("./config/env.validation");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const health_controller_1 = require("./health/health.controller");
const artisans_module_1 = require("./artisans/artisans.module");
const products_module_1 = require("./products/products.module");
const service_providers_module_1 = require("./service-providers/service-providers.module");
const cart_module_1 = require("./customers/cart.module");
const wishlist_module_1 = require("./customers/wishlist.module");
const preferences_module_1 = require("./customers/preferences.module");
const customers_module_1 = require("./customers/customers.module");
const orders_module_1 = require("./orders/orders.module");
const messaging_module_1 = require("./messaging/messaging.module");
const notifications_module_1 = require("./notifications/notifications.module");
const payments_module_1 = require("./payments/payments.module");
const search_module_1 = require("./search/search.module");
const support_module_1 = require("./support/support.module");
const customization_module_1 = require("./customization/customization.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                validate: env_validation_1.validateEnv,
                expandVariables: true,
            }),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(__dirname, '..', 'uploads'),
                serveRoot: '/uploads',
            }),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            artisans_module_1.ArtisansModule,
            products_module_1.ProductsModule,
            service_providers_module_1.ServiceProvidersModule,
            cart_module_1.CartModule,
            wishlist_module_1.WishlistModule,
            preferences_module_1.PreferencesModule,
            customers_module_1.CustomersModule,
            orders_module_1.OrdersModule,
            messaging_module_1.MessagingModule,
            notifications_module_1.NotificationsModule,
            payments_module_1.PaymentsModule,
            search_module_1.SearchModule,
            support_module_1.SupportModule,
            customization_module_1.CustomizationModule,
        ],
        controllers: [app_controller_1.AppController, health_controller_1.HealthController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map