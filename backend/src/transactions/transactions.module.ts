import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { DatabaseModule } from '../database/database.module';
import { CategoriesModule } from '../categories/categories.module';
import { ImportService } from '../services/import.service';

@Module({
    imports: [DatabaseModule, CategoriesModule],
    controllers: [TransactionsController],
    providers: [TransactionsService, ImportService],
    exports: [TransactionsService],
})
export class TransactionsModule { }
