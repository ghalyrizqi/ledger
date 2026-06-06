import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { InitialBalance, MonthlyBalance, BalanceCrosscheck } from './entities/initial-balance.entity';
import { CreateInitialBalanceDto, UpdateInitialBalanceDto } from './dto/initial-balance.dto';

@Injectable()
export class InitialBalancesService {
    constructor(private readonly db: DatabaseService) { }

    getInitialBalance(userId: number, year: number, month: number): InitialBalance | null {
        const sql = `
            SELECT * FROM initial_balances
            WHERE user_id = ? AND year = ? AND month = ?
        `;
        const result = this.db.get(sql, [userId, year, month]);

        if (result) {
            return {
                ...result,
                is_manual: Boolean(result.is_manual),
            };
        }

        return null;
    }

    setInitialBalance(dto: CreateInitialBalanceDto): InitialBalance {
        // Check if already exists
        const existing = this.getInitialBalance(dto.user_id, dto.year, dto.month);

        if (existing) {
            // Update existing
            const sql = `
                UPDATE initial_balances
                SET balance = ?, is_manual = ?, updated_at = datetime('now')
                WHERE user_id = ? AND year = ? AND month = ?
            `;
            this.db.run(sql, [
                dto.balance,
                dto.is_manual !== undefined ? (dto.is_manual ? 1 : 0) : 1,
                dto.user_id,
                dto.year,
                dto.month,
            ]);
        } else {
            // Insert new
            const sql = `
                INSERT INTO initial_balances (user_id, year, month, balance, is_manual, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `;
            this.db.run(sql, [
                dto.user_id,
                dto.year,
                dto.month,
                dto.balance,
                dto.is_manual !== undefined ? (dto.is_manual ? 1 : 0) : 1,
            ]);
        }

        const result = this.getInitialBalance(dto.user_id, dto.year, dto.month)!;

        // Recalculate future balances
        this.recalculateFutureBalances(dto.user_id, dto.year, dto.month - 1);

        return result;
    }

    deleteInitialBalance(userId: number, year: number, month: number): void {
        const sql = `
            DELETE FROM initial_balances
            WHERE user_id = ? AND year = ? AND month = ?
        `;
        this.db.run(sql, [userId, year, month]);

        // Recalculate future balances starting from the previous month
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }

        this.recalculateFutureBalances(userId, prevYear, prevMonth);
    }

    private recalculateFutureBalances(userId: number, year: number, startMonth: number): void {
        let currentYear = year;

        // Loop through subsequent months
        for (let month = startMonth + 1; month <= 12; month++) {
            const initial = this.getInitialBalance(userId, currentYear, month);

            // If explicit manual override exists, stop propagation
            if (initial && initial.is_manual) {
                break;
            }

            // If record doesn't exist or is auto-calculated, recalculate it
            const newBalance = this.calculateInitialBalance(userId, currentYear, month);

            if (initial) {
                // Update existing auto record
                const sql = `
                    UPDATE initial_balances
                    SET balance = ?, updated_at = datetime('now')
                    WHERE user_id = ? AND year = ? AND month = ?
                `;
                this.db.run(sql, [newBalance, userId, currentYear, month]);
            } else {
                // If it doesn't exist, we skip creating it to allow lazy loading elsewhere,
                // or you could choose to create it if your business logic prefers eagerly filling gaps.
            }
        }
    }

    calculateInitialBalance(userId: number, year: number, month: number): number {
        // Get previous month
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }

        // Get previous month's initial balance
        const prevInitial = this.getInitialBalance(userId, prevYear, prevMonth);
        const prevInitialBalance = prevInitial ? prevInitial.balance : 0;

        // Get previous month's transactions
        const startDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
        const endDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-31`;

        const transactions = this.db.all(`
            SELECT type, amount FROM transactions
            WHERE user_id = ? AND date >= ? AND date <= ?
        `, [userId, startDate, endDate]);

        let prevIncome = 0;
        let prevExpense = 0;

        transactions.forEach((t: any) => {
            if (t.type === 'income') {
                prevIncome += t.amount;
            } else {
                prevExpense += t.amount;
            }
        });

        // Current month initial = Previous initial + Previous savings
        return prevInitialBalance + (prevIncome - prevExpense);
    }

    getOrCreateInitialBalance(userId: number, year: number, month: number): InitialBalance {
        let initial = this.getInitialBalance(userId, year, month);

        if (!initial) {
            // Auto-calculate from previous month
            const calculatedBalance = this.calculateInitialBalance(userId, year, month);
            initial = this.setInitialBalance({
                user_id: userId,
                year,
                month,
                balance: calculatedBalance,
                is_manual: false,
            });
        }

        return initial;
    }

    getMonthlyBalances(userId: number, year: number): MonthlyBalance[] {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const balances: MonthlyBalance[] = [];

        for (let month = 1; month <= 12; month++) {
            const initial = this.getOrCreateInitialBalance(userId, year, month);

            // Get month's transactions
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

            const transactions = this.db.all(`
                SELECT type, amount FROM transactions
                WHERE user_id = ? AND date >= ? AND date <= ?
            `, [userId, startDate, endDate]);

            let income = 0;
            let expense = 0;

            transactions.forEach((t: any) => {
                if (t.type === 'income') {
                    income += t.amount;
                } else {
                    expense += t.amount;
                }
            });

            const savings = income - expense;
            const currentBalance = initial.balance + savings;

            balances.push({
                year,
                month,
                monthName: monthNames[month - 1],
                initialBalance: initial.balance,
                income,
                expense,
                savings,
                currentBalance,
                isManual: initial.is_manual,
            });
        }

        return balances;
    }

    getCrosscheck(userId: number, year?: number, month?: number): BalanceCrosscheck {
        let currentBalance = 0;

        if (year && month) {
            // Get specific month's current balance
            const initial = this.getOrCreateInitialBalance(userId, year, month);

            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

            const transactions = this.db.all(`
                SELECT type, amount FROM transactions
                WHERE user_id = ? AND date >= ? AND date <= ?
            `, [userId, startDate, endDate]);

            let income = 0;
            let expense = 0;

            transactions.forEach((t: any) => {
                if (t.type === 'income') {
                    income += t.amount;
                } else {
                    expense += t.amount;
                }
            });

            currentBalance = initial.balance + (income - expense);
        } else {
            // Get overall current balance (all time)
            const now = new Date();
            const currentYear = now.getFullYear();

            // Use January's initial balance as the starting point for the year
            const initial = this.getOrCreateInitialBalance(userId, currentYear, 1);

            const transactions = this.db.all(`
                SELECT type, amount FROM transactions
                WHERE user_id = ?
            `, [userId]);

            let totalIncome = 0;
            let totalExpense = 0;

            transactions.forEach((t: any) => {
                if (t.type === 'income') {
                    totalIncome += t.amount;
                } else {
                    totalExpense += t.amount;
                }
            });

            currentBalance = initial.balance + (totalIncome - totalExpense);
        }

        // Get total wallet balance
        const wallets = this.db.all(`
            SELECT balance FROM wallets
            WHERE user_id = ?
        `, [userId]);

        const totalWalletBalance = wallets.reduce((sum: number, w: any) => sum + w.balance, 0);

        const difference = currentBalance - totalWalletBalance;
        const isMatch = Math.abs(difference) < 0.01; // Allow for floating point errors

        return {
            currentBalance,
            totalWalletBalance,
            difference,
            isMatch,
        };
    }
}
