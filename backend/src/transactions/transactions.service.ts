import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
    constructor(private readonly databaseService: DatabaseService) { }

    async create(createTransactionDto: CreateTransactionDto): Promise<Transaction> {
        const { user_id, type, amount, category, description, date } = createTransactionDto;

        await this.databaseService.run(
            `INSERT INTO transactions (user_id, type, amount, category, description, date) 
       VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, type, amount, category, description || null, date]
        );

        // Get the last inserted transaction
        const transaction = await this.databaseService.get(
            'SELECT * FROM transactions ORDER BY id DESC LIMIT 1'
        );

        return transaction;
    }

    async findAll(userId?: number): Promise<Transaction[]> {
        if (userId) {
            return this.databaseService.all(
                `SELECT t.*, w.name AS wallet_name, w.icon AS wallet_icon
                 FROM transactions t
                 LEFT JOIN wallets w ON w.id = t.wallet_id
                 WHERE t.user_id = ? ORDER BY t.date DESC`,
                [userId]
            );
        }
        return this.databaseService.all(
            `SELECT t.*, w.name AS wallet_name, w.icon AS wallet_icon
             FROM transactions t
             LEFT JOIN wallets w ON w.id = t.wallet_id
             ORDER BY t.date DESC`
        );
    }

    async findOne(id: number): Promise<Transaction> {
        return this.databaseService.get(
            'SELECT * FROM transactions WHERE id = ?',
            [id]
        );
    }

    async update(id: number, updateTransactionDto: UpdateTransactionDto): Promise<Transaction> {
        const updates: string[] = [];
        const values: any[] = [];

        if (updateTransactionDto.type !== undefined) {
            updates.push('type = ?');
            values.push(updateTransactionDto.type);
        }
        if (updateTransactionDto.amount !== undefined) {
            updates.push('amount = ?');
            values.push(updateTransactionDto.amount);
        }
        if (updateTransactionDto.category !== undefined) {
            updates.push('category = ?');
            values.push(updateTransactionDto.category);
        }
        if (updateTransactionDto.description !== undefined) {
            updates.push('description = ?');
            values.push(updateTransactionDto.description);
        }
        if (updateTransactionDto.date !== undefined) {
            updates.push('date = ?');
            values.push(updateTransactionDto.date);
        }

        if (updates.length === 0) {
            return this.findOne(id);
        }

        values.push(id);
        await this.databaseService.run(
            `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return this.findOne(id);
    }

    async remove(id: number): Promise<void> {
        await this.databaseService.run(
            'DELETE FROM transactions WHERE id = ?',
            [id]
        );
    }

    async getSummary(userId: number): Promise<{ totalIncome: number; totalExpense: number; balance: number }> {
        const income = await this.databaseService.get(
            'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = ? AND (is_transfer = 0 OR is_transfer IS NULL)',
            [userId, 'income']
        );

        const expense = await this.databaseService.get(
            'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = ? AND (is_transfer = 0 OR is_transfer IS NULL)',
            [userId, 'expense']
        );

        const totalIncome = parseFloat(income?.total || 0);
        const totalExpense = parseFloat(expense?.total || 0);

        return {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
        };
    }
}
