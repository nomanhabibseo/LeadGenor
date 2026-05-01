import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { FxModule } from './fx/fx.module';
import { ImportExportModule } from './import-export/import-export.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReferenceModule } from './reference/reference.module';
import { RevenueModule } from './revenue/revenue.module';
import { StatsModule } from './stats/stats.module';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';
import { HealthModule } from './health/health.module';
import { EmailMarketingModule } from './email-marketing/email-marketing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailFinderModule } from './email-finder/email-finder.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    HealthModule,
    AdminModule,
    SubscriptionModule,
    EmailMarketingModule,
    EmailFinderModule,
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo: load repo root `.env` first (DATABASE_URL, PORT), then `apps/api/.env` if present.
      envFilePath: [
        join(process.cwd(), '..', '..', '.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ReferenceModule,
    VendorsModule,
    ClientsModule,
    FxModule,
    OrdersModule,
    RevenueModule,
    StatsModule,
    InvoicingModule,
    ImportExportModule,
    NotificationsModule,
  ],
})
export class AppModule {}
