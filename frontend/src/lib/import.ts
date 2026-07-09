const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ImportResult {
    success: boolean;
    successCount?: number;
    failedCount?: number;
    errors?: Array<{
        row: number;
        field: string;
        message: string;
    }>;
    message?: string;
}

export async function importTransactions(userId: number, csvData: string): Promise<ImportResult> {
    const response = await fetch(`${API_BASE_URL}/transactions/import`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, csvData }),
    });

    if (!response.ok) {
        throw new Error('Failed to import transactions');
    }

    return response.json();
}

export function downloadTemplate(): void {
    const template = `Date,Description,Amount,Type,Category
2026-01-15,Monthly Salary,30000000,income,Salary
2026-01-16,Coffee,50000,expense,Coffee & Snacks
2026-01-17,Freelance Project,4000000,income,Freelance`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transaction_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
