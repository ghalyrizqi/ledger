import axios from 'axios';
import { User, Transaction, FinancialSummary, Category, MonthlyAnalytics, Wallet, WalletSummary, OverallBalance, InitialBalance, MonthlyBalance, BalanceCrosscheck, ParsedTx, PreviewMeta } from '@/types';

// Same-origin by default: the backend serves this built UI and mounts the API
// under /api, so one address (SSH tunnel / Tailscale / etc.) serves everything.
// Override with VITE_API_URL for split local dev (e.g. http://localhost:3001/api).
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,           // send the session cookie
    headers: {
        'Content-Type': 'application/json',
    },
});

// When any data call comes back 401 (session expired), tell the app to show the
// login page again. Login/me calls are excluded so a bad password doesn't loop.
api.interceptors.response.use(
    r => r,
    err => {
        const url: string = err?.config?.url || '';
        if (err?.response?.status === 401 && !url.includes('/auth/')) {
            window.dispatchEvent(new Event('ledger:unauth'));
        }
        return Promise.reject(err);
    },
);

// ---- Auth ----
export const getMe = async (): Promise<{ email: string }> => (await api.get('/auth/me')).data;
export const login = async (email: string, password: string): Promise<{ email: string }> =>
    (await api.post('/auth/login', { email, password })).data;
export const logout = async (): Promise<void> => { await api.post('/auth/logout'); };

// Users API
export const getUsers = async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data;
};

export const createUser = async (name: string): Promise<User> => {
    const response = await api.post('/users', { name });
    return response.data;
};

export const updateUser = async (id: number, name: string): Promise<User> => {
    const response = await api.put(`/users/${id}`, { name });
    return response.data;
};

export const deleteUser = async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
};


// Transactions API
export const getTransactions = async (userId?: number): Promise<Transaction[]> => {
    const params = userId ? { userId } : {};
    const response = await api.get('/transactions', { params });
    return response.data;
};

export const createTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> => {
    const response = await api.post('/transactions', transaction);
    return response.data;
};

export const updateTransaction = async (id: number, transaction: Partial<Transaction>): Promise<Transaction> => {
    const response = await api.put(`/transactions/${id}`, transaction);
    return response.data;
};

export const deleteTransaction = async (id: number): Promise<void> => {
    await api.delete(`/transactions/${id}`);
};

export const getFinancialSummary = async (userId: number): Promise<FinancialSummary> => {
    const response = await api.get(`/transactions/summary/${userId}`);
    return response.data;
};

// Categories API
export const getCategories = async (userId: number, type?: 'income' | 'expense'): Promise<Category[]> => {
    const params: any = { userId };
    if (type) params.type = type;
    const response = await api.get('/categories', { params });
    return response.data;
};

export const createCategory = async (category: Omit<Category, 'id' | 'created_at'>): Promise<Category> => {
    const response = await api.post('/categories', category);
    return response.data;
};

export const updateCategory = async (id: number, category: Partial<Category>): Promise<Category> => {
    const response = await api.put(`/categories/${id}`, category);
    return response.data;
};

export const deleteCategory = async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
};

// Analytics API
export const getMonthlyAnalytics = async (userId: number, year?: number): Promise<MonthlyAnalytics> => {
    const params: any = { userId };
    if (year) params.year = year;
    const response = await api.get('/analytics/monthly-by-category', { params });
    return response.data;
};

export const getAvailableYears = async (userId: number): Promise<number[]> => {
    const response = await api.get('/analytics/available-years', { params: { userId } });
    return response.data;
};

// Wallets API
export const getWallets = async (userId: number): Promise<Wallet[]> => {
    const response = await api.get('/wallets', { params: { userId } });
    return response.data;
};

export const getWallet = async (id: number): Promise<Wallet> => {
    const response = await api.get(`/wallets/${id}`);
    return response.data;
};

export const createWallet = async (wallet: Omit<Wallet, 'id' | 'created_at'>): Promise<Wallet> => {
    const response = await api.post('/wallets', wallet);
    return response.data;
};

export const updateWallet = async (id: number, wallet: Partial<Wallet>): Promise<Wallet> => {
    const response = await api.put(`/wallets/${id}`, wallet);
    return response.data;
};

export const deleteWallet = async (id: number): Promise<void> => {
    await api.delete(`/wallets/${id}`);
};

export const getWalletSummary = async (userId: number): Promise<WalletSummary> => {
    const response = await api.get('/wallets/summary', { params: { userId } });
    return response.data;
};

export const getOverallBalance = async (userId: number): Promise<OverallBalance> => {
    const response = await api.get('/wallets/overall-balance', { params: { userId } });
    return response.data;
};

// Initial Balances API
export const getInitialBalance = async (userId: number, year: number, month: number): Promise<InitialBalance | null> => {
    const response = await api.get('/initial-balances', { params: { userId, year, month } });
    return response.data;
};

export const getOrCreateInitialBalance = async (userId: number, year: number, month: number): Promise<InitialBalance> => {
    const response = await api.get('/initial-balances/or-create', { params: { userId, year, month } });
    return response.data;
};

export const setInitialBalance = async (userId: number, year: number, month: number, balance: number, isManual: boolean = true): Promise<InitialBalance> => {
    const response = await api.post('/initial-balances', {
        user_id: userId,
        year,
        month,
        balance,
        is_manual: isManual,
    });
    return response.data;
};

export const getMonthlyBalances = async (userId: number, year: number): Promise<MonthlyBalance[]> => {
    const response = await api.get('/initial-balances/monthly', { params: { userId, year } });
    return response.data;
};

export const getBalanceCrosscheck = async (userId: number, year?: number, month?: number): Promise<BalanceCrosscheck> => {
    const params: any = { userId };
    if (year) params.year = year;
    if (month) params.month = month;
    const response = await api.get('/initial-balances/crosscheck', { params });
    return response.data;
};

export const deleteInitialBalance = async (
    userId: number,
    year: number,
    month: number
): Promise<void> => {
    await api.delete('/initial-balances', { params: { userId, year, month } });
};

// Statement Import API
export const previewStatement = async (
    walletId: number,
    bankType: 'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee',
    files: File[],
): Promise<{ rows: ParsedTx[]; meta: PreviewMeta }> => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    form.append('walletId', String(walletId));
    form.append('bankType', bankType);
    const response = await api.post('/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const autoPreviewStatement = async (
    userId: number,
    files: File[],
): Promise<{ rows: ParsedTx[]; meta: PreviewMeta; detectedBank: string; walletId: number; walletName: string; walletIcon?: string }> => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    form.append('userId', String(userId));
    const response = await api.post('/import/auto-preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const confirmImport = async (
    userId: number,
    rows: ParsedTx[],
    meta?: PreviewMeta,
): Promise<{ inserted: number }> => {
    const response = await api.post('/import/confirm', { userId, rows, meta });
    return response.data;
};
