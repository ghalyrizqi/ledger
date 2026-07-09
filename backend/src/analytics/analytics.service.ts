import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MonthlyAnalytics, MonthData, CategoryAmount } from './entities/analytics.entity';

@Injectable()
export class AnalyticsService {
    constructor(private readonly databaseService: DatabaseService) { }

    async getMonthlyByCategory(userId: number, year: number): Promise<MonthlyAnalytics> {
        const transactions = await this.databaseService.all(
            `SELECT t.*, c.icon, c.color
             FROM transactions t
             LEFT JOIN categories c ON t.category = c.name AND c.user_id = t.user_id
             LEFT JOIN wallets w ON t.wallet_id = w.id
             WHERE t.user_id = ? AND EXTRACT(YEAR FROM t.date::date)::text = ?
               AND (
                 (t.is_transfer = 0 OR t.is_transfer IS NULL)
                 OR (t.is_transfer = 1 AND t.category = 'Investment'
                     AND w.bank_type IN ('bibit', 'stockbit'))
               )
             ORDER BY t.date`,
            [userId, year.toString()]
        );

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        const monthsMap = new Map<string, MonthData>();
        for (let i = 1; i <= 12; i++) {
            const monthKey = `${year}-${i.toString().padStart(2, '0')}`;
            monthsMap.set(monthKey, {
                month: monthKey,
                monthName: monthNames[i - 1],
                income: [],
                expense: [],
                totalIncome: 0,
                totalExpense: 0,
                totalRealIncome: 0,
                totalRealExpense: 0,
            });
        }

        const categoryTotals = new Map<string, Map<string, { amount: number; color: string; icon: string; type: string }>>();

        transactions.forEach((tx: any) => {
            const monthKey = tx.date.substring(0, 7);
            const key = `${tx.type}-${tx.category}`;
            const color = tx.color || (tx.type === 'income' ? '#10b981' : '#ef4444');
            const icon  = tx.icon  || (tx.type === 'income' ? '💰' : '💳');

            if (!categoryTotals.has(monthKey)) categoryTotals.set(monthKey, new Map());
            const mc = categoryTotals.get(monthKey)!;
            if (!mc.has(key)) mc.set(key, { amount: 0, color, icon, type: tx.type });
            mc.get(key)!.amount += Number(tx.amount);

            // Track real totals separately (excludes investment transfers from bibit/stockbit)
            if (!tx.is_transfer || tx.is_transfer === 0) {
                const monthData = monthsMap.get(monthKey);
                if (monthData) {
                    if (tx.type === 'income') monthData.totalRealIncome += Number(tx.amount);
                    else monthData.totalRealExpense += Number(tx.amount);
                }
            }
        });

        categoryTotals.forEach((categories, monthKey) => {
            const monthData = monthsMap.get(monthKey);
            if (!monthData) return;
            categories.forEach((data, key) => {
                const categoryAmount: CategoryAmount = {
                    category: key.split('-')[1],
                    amount: data.amount,
                    color: data.color,
                    icon: data.icon,
                };
                if (data.type === 'income') {
                    monthData.income.push(categoryAmount);
                    monthData.totalIncome += data.amount;
                } else {
                    monthData.expense.push(categoryAmount);
                    monthData.totalExpense += data.amount;
                }
            });
            monthData.income.sort((a, b) => b.amount - a.amount);
            monthData.expense.sort((a, b) => b.amount - a.amount);
        });

        return { year, months: Array.from(monthsMap.values()) };
    }

    async getAvailableYears(userId: number): Promise<number[]> {
        const rows = await this.databaseService.all(
            `SELECT DISTINCT EXTRACT(YEAR FROM date::date)::int AS year
             FROM transactions WHERE user_id = ? ORDER BY year DESC`,
            [userId]
        );
        return rows.map((r: any) => Number(r.year));
    }
}
