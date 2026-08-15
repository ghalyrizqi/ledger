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
    freshness_enabled: boolean;
    freshness_mode: 'statement' | 'manual';
    update_frequency: 'weekly' | 'monthly' | 'manual';
    expected_day: number;
    grace_days: number;
    last_confirmed_at?: string | null;
    freshness?: WalletFreshness;
    created_at: string;
}

export type FreshnessStatus = 'up_to_date' | 'due_soon' | 'needs_update' | 'never_uploaded' | 'review_needed' | 'manual' | 'ignored';

export interface WalletFreshness {
    status: FreshnessStatus;
    label: string;
    coveredThrough?: string | null;
    lastUploadAt?: string | null;
    nextDueAt?: string | null;
    daysUntilDue?: number | null;
    source?: 'web' | 'telegram' | 'manual' | null;
    latestImportStatus?: 'success' | 'partial' | 'failed' | 'rejected' | null;
    reason: string;
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
