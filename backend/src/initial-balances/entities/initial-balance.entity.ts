export interface InitialBalance {
    id: number;
    user_id: number;
    year: number;
    month: number;
    balance: number;
    is_manual: boolean;
    created_at: string;
    updated_at: string;
}

export interface MonthlyBalance {
    year: number;
    month: number;
    monthName: string;
    initialBalance: number;
    income: number;
    expense: number;
    savings: number;
    currentBalance: number;
    isManual: boolean;
}

export interface BalanceCrosscheck {
    currentBalance: number;
    totalWalletBalance: number;
    difference: number;
    isMatch: boolean;
}
