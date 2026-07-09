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
    /** Real income only — is_transfer=0 transactions, excludes investment redemptions */
    totalRealIncome: number;
    /** Real expense only — is_transfer=0 transactions, excludes investment purchases */
    totalRealExpense: number;
}

export interface CategoryAmount {
    category: string;
    amount: number;
    color: string;
    icon: string;
}
