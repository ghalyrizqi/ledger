import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WalletsModule } from './wallets/wallets.module';
import { InitialBalancesModule } from './initial-balances/initial-balances.module';
import { ImportModule } from './import/import.module';

@Module({
    imports: [
        DatabaseModule,
        UsersModule,
        TransactionsModule,
        CategoriesModule,
        AnalyticsModule,
        WalletsModule,
        InitialBalancesModule,
        ImportModule,
    ],
})
export class AppModule { }
