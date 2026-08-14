import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/session.guard';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WalletsModule } from './wallets/wallets.module';
import { InitialBalancesModule } from './initial-balances/initial-balances.module';
import { ImportModule } from './import/import.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
    imports: [
        // Serve the built frontend (frontend/dist) from the same origin as the
        // API. API is under /api (global prefix), so exclude it from static.
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
            exclude: ['/api/{*splat}'],
        }),
        DatabaseModule,
        UsersModule,
        TransactionsModule,
        CategoriesModule,
        AnalyticsModule,
        WalletsModule,
        InitialBalancesModule,
        ImportModule,
        TelegramModule,
        AuthModule,
    ],
    providers: [
        // Every API route requires a valid session unless marked @Public().
        { provide: APP_GUARD, useClass: SessionGuard },
    ],
})
export class AppModule { }
