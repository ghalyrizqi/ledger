export interface User {
    id: number;
    name: string;
}

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

export interface FinancialSummary {
    totalIncome: number;
    totalExpense: number;
    balance: number;
}

export interface Category {
    id: number;
    user_id: number;
    name: string;
    type: 'income' | 'expense' | 'both';
    icon?: string;
    color?: string;
    created_at: string;
}

export interface MonthlyAnalytics {
    year: number;
    months: MonthData[];
}

export interface MonthData {
    month: string;
    monthName: string;
    income: CategoryAmount[];
    expense: CategoryAmount[];
    totalIncome: number;
    totalExpense: number;
    totalRealIncome?: number;
    totalRealExpense?: number;
}

export interface CategoryAmount {
    category: string;
    amount: number;
    color: string;
    icon: string;
}

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
    latestTransactionDate?: string | null;
    lastUploadAt?: string | null;
    nextDueAt?: string | null;
    daysUntilDue?: number | null;
    source?: 'web' | 'telegram' | 'manual' | null;
    latestImportStatus?: 'success' | 'partial' | 'failed' | 'rejected' | null;
    reason: string;
}

export interface WalletFreshnessSummary {
    total: number;
    upToDate: number;
    dueSoon: number;
    needsUpdate: number;
    neverUploaded: number;
    reviewNeeded: number;
    walletsNeedingAttention: Wallet[];
}

export interface PreviewMeta {
    coveredFrom?: string;
    coveredThrough?: string;
    coverageConfidence?: 'high' | 'medium' | 'low';
    closingBalance?: number;
    gainAmt?: number;
    gainPct?: number;
}

export interface ParsedTx {
    date: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    isTransfer: boolean;
    category: string;
    walletId: number;
    raw: string;
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
