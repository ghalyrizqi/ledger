export class UpdateTransactionDto {
    type?: 'income' | 'expense';
    amount?: number;
    category?: string;
    description?: string;
    date?: string;
}
