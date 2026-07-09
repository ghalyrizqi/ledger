export class CreateTransactionDto {
    user_id: number;
    wallet_id?: number | null;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    description?: string;
    date: string;
    is_transfer?: boolean;
}
