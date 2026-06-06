export interface Category {
    id: number;
    user_id: number;
    name: string;
    type: 'income' | 'expense' | 'both';
    icon?: string;
    color?: string;
    created_at: string;
}
