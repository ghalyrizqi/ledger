import { Module } from '@nestjs/common';
import { InitialBalancesController } from './initial-balances.controller';
import { InitialBalancesService } from './initial-balances.service';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [InitialBalancesController],
    providers: [InitialBalancesService],
    exports: [InitialBalancesService],
})
export class InitialBalancesModule { }
