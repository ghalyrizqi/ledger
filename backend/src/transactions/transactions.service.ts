import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
    constructor(private readonly databaseService: DatabaseService) { }

    async create(dto: CreateTransactionDto): Promise<Transaction> {
        const { user_id, wallet_id, type, amount, category, description, date, is_transfer } = dto;
        return this.databaseService.get(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, date, is_transfer)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            [user_id, wallet_id ?? null, type, amount, category, description || null, date, is_transfer ? 1 : 0]
        );
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
        return this.databaseService.get('SELECT * FROM transactions WHERE id = ?', [id]);
    }

    async update(id: number, dto: UpdateTransactionDto): Promise<Transaction> {
        const updates: string[] = [];
        const values: any[] = [];

        if (dto.type        !== undefined) { updates.push('type = ?');        values.push(dto.type); }
        if (dto.amount      !== undefined) { updates.push('amount = ?');      values.push(dto.amount); }
        if (dto.category    !== undefined) { updates.push('category = ?');    values.push(dto.category); }
        if (dto.description !== undefined) { updates.push('description = ?'); values.push(dto.description); }
        if (dto.date        !== undefined) { updates.push('date = ?');        values.push(dto.date); }

        if (updates.length === 0) return this.findOne(id);

        values.push(id);
        await this.databaseService.run(
            `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return this.findOne(id);
    }

    async remove(id: number): Promise<void> {
        await this.databaseService.run('DELETE FROM transactions WHERE id = ?', [id]);
    }

    async getSummary(userId: number): Promise<{ totalIncome: number; totalExpense: number; balance: number }> {
        const row = await this.databaseService.get(
            `SELECT
               COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS "totalIncome",
               COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS "totalExpense"
             FROM transactions
             WHERE user_id = ? AND (is_transfer = 0 OR is_transfer IS NULL)`,
            [userId]
        );
        const totalIncome  = Number(row?.totalIncome  || 0);
        const totalExpense = Number(row?.totalExpense || 0);
        return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
    }
}
