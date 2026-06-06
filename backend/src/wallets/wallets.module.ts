import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [WalletsController],
    providers: [WalletsService],
    exports: [WalletsService],
})
export class WalletsModule { }
