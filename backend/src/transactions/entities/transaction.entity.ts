export interface Transaction {
    id: number;
    user_id: number;
    wallet_id?: number | null;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    description?: string;
    date: string;
    is_transfer?: number;
    wallet_name?: string | null;
    wallet_icon?: string | null;
    created_at?: string;
}
