import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ImportService } from '../services/import.service';

@Controller('transactions')
export class TransactionsController {
    constructor(
        private readonly transactionsService: TransactionsService,
        private readonly importService: ImportService,
    ) { }

    @Post()
    async create(@Body() createTransactionDto: CreateTransactionDto): Promise<Transaction> {
        return this.transactionsService.create(createTransactionDto);
    }

    @Post('import')
    async import(@Body() body: { userId: number; csvData: string }) {
        try {
            const result = await this.importService.importTransactions(body.userId, body.csvData);
            return {
                success: true,
                ...result,
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message,
                errors: [],
            };
        }
    }

    @Get()
    async findAll(@Query('userId') userId?: string): Promise<Transaction[]> {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        return this.transactionsService.findAll(userIdNum);
    }

    @Get('summary/:userId')
    async getSummary(@Param('userId') userId: string) {
        return this.transactionsService.getSummary(parseInt(userId, 10));
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Transaction> {
        return this.transactionsService.findOne(parseInt(id, 10));
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() updateTransactionDto: UpdateTransactionDto,
    ): Promise<Transaction> {
        return this.transactionsService.update(parseInt(id, 10), updateTransactionDto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string): Promise<{ message: string }> {
        await this.transactionsService.remove(parseInt(id, 10));
        return { message: 'Transaction deleted successfully' };
    }
}
