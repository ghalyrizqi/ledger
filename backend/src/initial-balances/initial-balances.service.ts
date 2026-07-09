import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { InitialBalance, MonthlyBalance, BalanceCrosscheck } from './entities/initial-balance.entity';
import { CreateInitialBalanceDto } from './dto/initial-balance.dto';

@Injectable()
export class InitialBalancesService {
    constructor(private readonly db: DatabaseService) { }

    async getInitialBalance(userId: number, year: number, month: number): Promise<InitialBalance | null> {
        const result = await this.db.get(
            'SELECT * FROM initial_balances WHERE user_id = ? AND year = ? AND month = ?',
            [userId, year, month]
        );
        if (!result) return null;
        return { ...result, balance: Number(result.balance), is_manual: Boolean(result.is_manual) };
    }

    async setInitialBalance(dto: CreateInitialBalanceDto): Promise<InitialBalance> {
        const existing = await this.getInitialBalance(dto.user_id, dto.year, dto.month);
        const isManual = dto.is_manual !== undefined ? (dto.is_manual ? 1 : 0) : 1;

        if (existing) {
            await this.db.run(
                `UPDATE initial_balances SET balance = ?, is_manual = ?, updated_at = NOW()
                 WHERE user_id = ? AND year = ? AND month = ?`,
                [dto.balance, isManual, dto.user_id, dto.year, dto.month]
            );
        } else {
            await this.db.run(
                `INSERT INTO initial_balances (user_id, year, month, balance, is_manual)
                 VALUES (?, ?, ?, ?, ?)`,
                [dto.user_id, dto.year, dto.month, dto.balance, isManual]
            );
        }

        await this.recalculateFutureBalances(dto.user_id, dto.year, dto.month - 1);
        return (await this.getInitialBalance(dto.user_id, dto.year, dto.month))!;
    }

    async deleteInitialBalance(userId: number, year: number, month: number): Promise<void> {
        await this.db.run(
            'DELETE FROM initial_balances WHERE user_id = ? AND year = ? AND month = ?',
            [userId, year, month]
        );
        let prevYear = year, prevMonth = month - 1;
        if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
        await this.recalculateFutureBalances(userId, prevYear, prevMonth);
    }

    private async recalculateFutureBalances(userId: number, year: number, startMonth: number): Promise<void> {
        for (let month = startMonth + 1; month <= 12; month++) {
            const initial = await this.getInitialBalance(userId, year, month);
            if (initial && initial.is_manual) break;

            const newBalance = await this.calculateInitialBalance(userId, year, month);
            if (initial) {
                await this.db.run(
                    `UPDATE initial_balances SET balance = ?, updated_at = NOW()
                     WHERE user_id = ? AND year = ? AND month = ?`,
                    [newBalance, userId, year, month]
                );
            }
        }
    }

    async calculateInitialBalance(userId: number, year: number, month: number): Promise<number> {
        let prevYear = year, prevMonth = month - 1;
        if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

        const prevInitial = await this.getInitialBalance(userId, prevYear, prevMonth);
        const prevInitialBalance = prevInitial ? prevInitial.balance : 0;

        const startDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
        const endDate   = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-31`;

        const transactions = await this.db.all(
            `SELECT type, amount FROM transactions
             WHERE user_id = ? AND date >= ? AND date <= ?
               AND (is_transfer = 0 OR is_transfer IS NULL)`,
            [userId, startDate, endDate]
        );

        let income = 0, expense = 0;
        transactions.forEach((t: any) => {
            if (t.type === 'income') income += Number(t.amount);
            else expense += Number(t.amount);
        });

        return prevInitialBalance + (income - expense);
    }

    async getOrCreateInitialBalance(userId: number, year: number, month: number): Promise<InitialBalance> {
        let initial = await this.getInitialBalance(userId, year, month);
        if (!initial) {
            const balance = await this.calculateInitialBalance(userId, year, month);
            initial = await this.setInitialBalance({ user_id: userId, year, month, balance, is_manual: false });
        }
        return initial;
    }

    async getMonthlyBalances(userId: number, year: number): Promise<MonthlyBalance[]> {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const balances: MonthlyBalance[] = [];

        for (let month = 1; month <= 12; month++) {
            const initial = await this.getOrCreateInitialBalance(userId, year, month);
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate   = `${year}-${month.toString().padStart(2, '0')}-31`;

            const txs = await this.db.all(
                `SELECT type, amount FROM transactions
                 WHERE user_id = ? AND date >= ? AND date <= ?
                   AND (is_transfer = 0 OR is_transfer IS NULL)`,
                [userId, startDate, endDate]
            );

            let income = 0, expense = 0;
            txs.forEach((t: any) => {
                if (t.type === 'income') income += Number(t.amount);
                else expense += Number(t.amount);
            });

            const savings = income - expense;
            balances.push({
                year, month,
                monthName: monthNames[month - 1],
                initialBalance: initial.balance,
                income, expense, savings,
                currentBalance: initial.balance + savings,
                isManual: initial.is_manual,
            });
        }

        return balances;
    }

    async getCrosscheck(userId: number, year?: number, month?: number): Promise<BalanceCrosscheck> {
        let currentBalance = 0;

        if (year && month) {
            const initial = await this.getOrCreateInitialBalance(userId, year, month);
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate   = `${year}-${month.toString().padStart(2, '0')}-31`;

            const txs = await this.db.all(
                `SELECT type, amount FROM transactions
                 WHERE user_id = ? AND date >= ? AND date <= ?`,
                [userId, startDate, endDate]
            );

            let income = 0, expense = 0;
            txs.forEach((t: any) => {
                if (t.type === 'income') income += Number(t.amount);
                else expense += Number(t.amount);
            });
            currentBalance = initial.balance + (income - expense);
        } else {
            const now = new Date();
            const initial = await this.getOrCreateInitialBalance(userId, now.getFullYear(), 1);

            const txs = await this.db.all(
                `SELECT type, amount FROM transactions WHERE user_id = ?`,
                [userId]
            );

            let totalIncome = 0, totalExpense = 0;
            txs.forEach((t: any) => {
                if (t.type === 'income') totalIncome += Number(t.amount);
                else totalExpense += Number(t.amount);
            });
            currentBalance = initial.balance + (totalIncome - totalExpense);
        }

        // Use the same computed balance as getWallets (initial offset + net transactions)
        const wallets = await this.db.all(`
            SELECT w.balance + COALESCE(SUM(CASE
                WHEN t.type = 'income'  THEN  t.amount
                WHEN t.type = 'expense' THEN -t.amount
                ELSE 0
            END), 0) AS computed_balance
            FROM wallets w
            LEFT JOIN transactions t ON t.wallet_id = w.id
            WHERE w.user_id = ?
            GROUP BY w.id
        `, [userId]);
        const totalWalletBalance = wallets.reduce((s: number, w: any) => s + Number(w.computed_balance), 0);

        const difference = currentBalance - totalWalletBalance;
        return {
            currentBalance,
            totalWalletBalance,
            difference,
            isMatch: Math.abs(difference) < 0.01,
        };
    }
}
