import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { TransactionsService } from '../transactions/transactions.service';
import { CategoriesService } from '../categories/categories.service';

interface ImportRow {
    date: string;
    description: string;
    amount: string;
    type: string;
    category: string;
}

export interface ValidationError {
    row: number;
    field: string;
    message: string;
}

export interface ImportResult {
    success: number;
    failed: number;
    errors: ValidationError[];
}

@Injectable()
export class ImportService {
    constructor(
        private readonly transactionsService: TransactionsService,
        private readonly categoriesService: CategoriesService,
    ) { }

    /**
     * Parse CSV content into structured data
     */
    parseCSV(csvContent: string): ImportRow[] {
        try {
            const records = parse(csvContent, {
                columns: ['date', 'description', 'amount', 'type', 'category'],
                skip_empty_lines: true,
                trim: true,
                from_line: 2, // Skip header row
            }) as ImportRow[];
            return records;
        } catch (error) {
            throw new Error('Failed to parse CSV file. Please check the format.');
        }
    }

    /**
     * Validate a single row of data
     */
    validateRow(
        row: ImportRow,
        rowNumber: number,
        userCategories: any[]
    ): ValidationError | null {
        // Validate date
        const date = this.parseDate(row.date);
        if (!date) {
            return {
                row: rowNumber,
                field: 'date',
                message: `Invalid date format: "${row.date}". Use YYYY-MM-DD, MM/DD/YYYY, or DD/MM/YYYY`,
            };
        }

        // Validate amount
        const amount = parseFloat(row.amount);
        if (isNaN(amount) || amount <= 0) {
            return {
                row: rowNumber,
                field: 'amount',
                message: `Invalid amount: "${row.amount}". Must be a positive number`,
            };
        }

        // Validate type
        const type = row.type.toLowerCase();
        if (type !== 'income' && type !== 'expense') {
            return {
                row: rowNumber,
                field: 'type',
                message: `Invalid type: "${row.type}". Must be "income" or "expense"`,
            };
        }

        // Validate category exists
        const category = userCategories.find(
            (c) => c.name.toLowerCase() === row.category.toLowerCase()
        );
        if (!category) {
            return {
                row: rowNumber,
                field: 'category',
                message: `Category not found: "${row.category}". Please create it first`,
            };
        }

        // Validate category type matches transaction type
        if (category.type !== 'both' && category.type !== type) {
            return {
                row: rowNumber,
                field: 'category',
                message: `Category "${row.category}" is for ${category.type}, but transaction is ${type}`,
            };
        }

        return null;
    }

    /**
     * Parse date from various formats
     */
    private parseDate(dateStr: string): Date | null {
        // Try YYYY-MM-DD
        let date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }

        // Try MM/DD/YYYY
        const parts1 = dateStr.split('/');
        if (parts1.length === 3) {
            date = new Date(`${parts1[2]}-${parts1[0].padStart(2, '0')}-${parts1[1].padStart(2, '0')}`);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // Try DD/MM/YYYY
        if (parts1.length === 3) {
            date = new Date(`${parts1[2]}-${parts1[1].padStart(2, '0')}-${parts1[0].padStart(2, '0')}`);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        return null;
    }

    /**
     * Import transactions from CSV data
     */
    async importTransactions(userId: number, csvContent: string): Promise<ImportResult> {
        const result: ImportResult = {
            success: 0,
            failed: 0,
            errors: [],
        };

        try {
            // Parse CSV
            const rows = this.parseCSV(csvContent);

            // Get user's categories
            const categories = this.categoriesService.findAll(userId);

            // Validate and import each row
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 2; // +2 because we skip header and arrays are 0-indexed

                // Validate row
                const error = this.validateRow(row, rowNumber, categories);
                if (error) {
                    result.failed++;
                    result.errors.push(error);
                    continue;
                }

                // Create transaction
                try {
                    const category = categories.find(
                        (c) => c.name.toLowerCase() === row.category.toLowerCase()
                    );
                    const date = this.parseDate(row.date);

                    this.transactionsService.create({
                        user_id: userId,
                        type: row.type.toLowerCase() as 'income' | 'expense',
                        amount: parseFloat(row.amount),
                        category: category!.name,
                        description: row.description || '',
                        date: date!.toISOString().split('T')[0],
                    });

                    result.success++;
                } catch (error: any) {
                    result.failed++;
                    result.errors.push({
                        row: rowNumber,
                        field: 'general',
                        message: `Failed to create transaction: ${error.message}`,
                    });
                }
            }

            return result;
        } catch (error: any) {
            throw new Error(`Import failed: ${error.message}`);
        }
    }
}
