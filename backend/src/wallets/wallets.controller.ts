import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';

@Controller('wallets')
export class WalletsController {
    constructor(private readonly walletsService: WalletsService) { }

    @Get()
    getWallets(@Query('userId') userId: string) {
        return this.walletsService.getWallets(parseInt(userId));
    }

    @Get('summary')
    getWalletSummary(@Query('userId') userId: string) {
        return this.walletsService.getWalletSummary(parseInt(userId));
    }

    @Get('overall-balance')
    getOverallBalance(@Query('userId') userId: string) {
        return this.walletsService.getOverallBalance(parseInt(userId));
    }

    @Get(':id')
    getWallet(@Param('id') id: string) {
        return this.walletsService.getWallet(parseInt(id));
    }

    @Post()
    createWallet(@Body() createWalletDto: CreateWalletDto) {
        return this.walletsService.createWallet(createWalletDto);
    }

    @Put(':id')
    updateWallet(@Param('id') id: string, @Body() updateWalletDto: UpdateWalletDto) {
        return this.walletsService.updateWallet(parseInt(id), updateWalletDto);
    }

    @Delete(':id')
    deleteWallet(@Param('id') id: string) {
        this.walletsService.deleteWallet(parseInt(id));
        return { message: 'Wallet deleted successfully' };
    }
}
