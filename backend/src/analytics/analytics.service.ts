import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MonthlyAnalytics, MonthData, CategoryAmount } from './entities/analytics.entity';

@Injectable()
export class AnalyticsService {
    constructor(private readonly databaseService: DatabaseService) { }

    getMonthlyByCategory(userId: number, year: number): MonthlyAnalytics {
        // Get all transactions for the user in the specified year
        const transactions = this.databaseService.all(
            `SELECT t.*, c.icon, c.color
             FROM transactions t
             LEFT JOIN categories c ON t.category = c.name AND c.user_id = t.user_id
             WHERE t.user_id = ? AND strftime('%Y', t.date) = ?
               AND (t.is_transfer = 0 OR t.is_transfer IS NULL)
             ORDER BY t.date`,
            [userId, year.toString()]
        );

        // Initialize all 12 months
        const monthsMap = new Map<string, MonthData>();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        for (let i = 1; i <= 12; i++) {
            const monthKey = `${year}-${i.toString().padStart(2, '0')}`;
            monthsMap.set(monthKey, {
                month: monthKey,
                monthName: monthNames[i - 1],
                income: [],
                expense: [],
                totalIncome: 0,
                totalExpense: 0,
            });
        }

        // Group transactions by month and category
        const categoryTotals = new Map<string, Map<string, { amount: number; color: string; icon: string; type: string }>>();

        transactions.forEach((transaction: any) => {
            const monthKey = transaction.date.substring(0, 7); // YYYY-MM
            const category = transaction.category;
            const type = transaction.type;
            const amount = transaction.amount;
            const color = transaction.color || (type === 'income' ? '#10b981' : '#ef4444');
            const icon = transaction.icon || (type === 'income' ? '💰' : '💳');

            if (!categoryTotals.has(monthKey)) {
                categoryTotals.set(monthKey, new Map());
            }

            const monthCategories = categoryTotals.get(monthKey)!;
            const key = `${type}-${category}`;

            if (!monthCategories.has(key)) {
                monthCategories.set(key, { amount: 0, color, icon, type });
            }

            monthCategories.get(key)!.amount += amount;
        });

        // Convert to array format
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

            // Sort categories by amount (descending)
            monthData.income.sort((a, b) => b.amount - a.amount);
            monthData.expense.sort((a, b) => b.amount - a.amount);
        });

        return {
            year,
            months: Array.from(monthsMap.values()),
        };
    }

    getAvailableYears(userId: number): number[] {
        const result = this.databaseService.all(
            `SELECT DISTINCT strftime('%Y', date) as year 
             FROM transactions 
             WHERE user_id = ? 
             ORDER BY year DESC`,
            [userId]
        );

        return result.map((row: any) => parseInt(row.year));
    }
}
