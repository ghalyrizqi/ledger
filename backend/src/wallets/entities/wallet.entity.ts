export interface Wallet {
    id: number;
    user_id: number;
    name: string;
    type: 'bank' | 'ewallet' | 'cash' | 'other';
    balance: number;
    icon?: string;
    color?: string;
    bank_type?: 'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee' | 'ovo' | 'bibit' | 'gopay' | null;
    account_number?: string | null;
    gain_amt?: number | null;
    gain_pct?: number | null;
    created_at: string;
}

export interface WalletSummary {
    totalBalance: number;
    walletCount: number;
    byType: {
        bank: number;
        ewallet: number;
        cash: number;
        other: number;
    };
}

export interface OverallBalance {
    totalIncome: number;
    totalExpense: number;
    netFromTransactions: number;
    totalWalletBalance: number;
    overallBalance: number;
}
