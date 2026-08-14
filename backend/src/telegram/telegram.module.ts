import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';

// DatabaseService is provided globally (@Global DatabaseModule), so no imports
// needed. The bot only starts polling when LEDGER_TG_TOKEN is set.
@Module({
  providers: [TelegramService],
})
export class TelegramModule {}
