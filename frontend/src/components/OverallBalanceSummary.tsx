
import { useState, useEffect } from 'react';
import { OverallBalance } from '@/types';
import { getOverallBalance } from '@/lib/api';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface OverallBalanceSummaryProps {
    userId: number;
}

export default function OverallBalanceSummary({ userId }: OverallBalanceSummaryProps) {
    const [balance, setBalance] = useState<OverallBalance | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadBalance();
    }, [userId]);

    const loadBalance = async () => {
        setIsLoading(true);
        try {
            const data = await getOverallBalance(userId);
            setBalance(data);
        } catch (error) {
            console.error('Error loading overall balance:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading || !balance) {
        return (
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg shadow-lg p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-1">📊 Overall Financial Position</h2>
                <p className="text-sm text-muted-foreground">
                    Your complete financial overview including transactions and savings
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Net from Transactions */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        <p className="text-sm font-medium text-muted-foreground">Net Transactions</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                        {formatCurrency(balance.netFromTransactions)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Income - Expenses
                    </p>
                </div>

                {/* Wallet Savings */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border-2 border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="h-5 w-5 text-emerald-600" />
                        <p className="text-sm font-medium text-muted-foreground">Wallet Savings</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        {formatCurrency(balance.totalWalletBalance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        All Wallets Combined
                    </p>
                </div>

                {/* Overall Balance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-5 w-5 text-purple-600" />
                        <p className="text-sm font-medium text-muted-foreground">Overall Balance</p>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                        {formatCurrency(balance.overallBalance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Total Financial Position
                    </p>
                </div>
            </div>

            {/* Breakdown */}
            <div className="mt-4 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Calculation:</p>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-medium">Overall Balance</span>
                    <span>=</span>
                    <span className="text-blue-600 dark:text-blue-400">
                        Net Transactions ({formatCurrency(balance.netFromTransactions)})
                    </span>
                    <span>+</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                        Wallet Savings ({formatCurrency(balance.totalWalletBalance)})
                    </span>
                </div>
            </div>
        </div>
    );
}
