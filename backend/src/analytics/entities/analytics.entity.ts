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
}

export interface CategoryAmount {
    category: string;
    amount: number;
    color: string;
    icon: string;
}
