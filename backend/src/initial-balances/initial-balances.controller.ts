import { Controller, Get, Post, Delete, Query, Body } from '@nestjs/common';
import { InitialBalancesService } from './initial-balances.service';
import { CreateInitialBalanceDto } from './dto/initial-balance.dto';

@Controller('initial-balances')
export class InitialBalancesController {
    constructor(private readonly initialBalancesService: InitialBalancesService) { }

    @Get()
    getInitialBalance(
        @Query('userId') userId: string,
        @Query('year') year: string,
        @Query('month') month: string,
    ) {
        return this.initialBalancesService.getInitialBalance(parseInt(userId), parseInt(year), parseInt(month));
    }

    @Get('or-create')
    getOrCreateInitialBalance(
        @Query('userId') userId: string,
        @Query('year') year: string,
        @Query('month') month: string,
    ) {
        return this.initialBalancesService.getOrCreateInitialBalance(parseInt(userId), parseInt(year), parseInt(month));
    }

    @Post()
    setInitialBalance(@Body() dto: CreateInitialBalanceDto) {
        return this.initialBalancesService.setInitialBalance(dto);
    }

    @Get('monthly')
    getMonthlyBalances(
        @Query('userId') userId: string,
        @Query('year') year: string,
    ) {
        return this.initialBalancesService.getMonthlyBalances(parseInt(userId), parseInt(year));
    }

    @Delete()
    deleteInitialBalance(
        @Query('userId') userId: string,
        @Query('year') year: string,
        @Query('month') month: string,
    ) {
        return this.initialBalancesService.deleteInitialBalance(parseInt(userId), parseInt(year), parseInt(month));
    }

    @Get('crosscheck')
    getCrosscheck(
        @Query('userId') userId: string,
        @Query('year') year?: string,
        @Query('month') month?: string,
    ) {
        return this.initialBalancesService.getCrosscheck(
            parseInt(userId),
            year ? parseInt(year) : undefined,
            month ? parseInt(month) : undefined,
        );
    }
}
