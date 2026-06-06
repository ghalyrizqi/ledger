export class CreateTransactionDto {
    user_id: number;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    description?: string;
    date: string;
}
