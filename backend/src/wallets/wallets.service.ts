import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Wallet, WalletSummary, OverallBalance } from './entities/wallet.entity';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';

@Injectable()
export class WalletsService {
    constructor(private readonly db: DatabaseService) { }

    getWallets(userId: number): Wallet[] {
        const sql = `
            SELECT * FROM wallets
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;
        return this.db.all(sql, [userId]);
    }

    getWallet(id: number): Wallet {
        const sql = 'SELECT * FROM wallets WHERE id = ?';
        return this.db.get(sql, [id]);
    }

    createWallet(dto: CreateWalletDto): Wallet {
        const sql = `
            INSERT INTO wallets (user_id, name, type, balance, icon, color, bank_type, account_number, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        this.db.run(sql, [
            dto.user_id,
            dto.name,
            dto.type,
            dto.balance || 0,
            dto.icon || null,
            dto.color || null,
            dto.bank_type || null,
            dto.account_number || null,
        ]);

        // Get the last inserted wallet
        const lastId = this.db.get('SELECT last_insert_rowid() as id');
        return this.getWallet(lastId.id);
    }

    updateWallet(id: number, dto: UpdateWalletDto): Wallet {
        const wallet = this.getWallet(id);
        if (!wallet) {
            throw new Error('Wallet not found');
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (dto.name !== undefined) {
            updates.push('name = ?');
            params.push(dto.name);
        }
        if (dto.type !== undefined) {
            updates.push('type = ?');
            params.push(dto.type);
        }
        if (dto.balance !== undefined) {
            updates.push('balance = ?');
            params.push(dto.balance);
        }
        if (dto.icon !== undefined) {
            updates.push('icon = ?');
            params.push(dto.icon);
        }
        if (dto.color !== undefined) {
            updates.push('color = ?');
            params.push(dto.color);
        }
        if (dto.bank_type !== undefined) {
            updates.push('bank_type = ?');
            params.push(dto.bank_type);
        }
        if (dto.account_number !== undefined) {
            updates.push('account_number = ?');
            params.push(dto.account_number);
        }

        if (updates.length > 0) {
            params.push(id);
            const sql = `UPDATE wallets SET ${updates.join(', ')} WHERE id = ?`;
            this.db.run(sql, params);
        }

        return this.getWallet(id);
    }

    deleteWallet(id: number): void {
        const sql = 'DELETE FROM wallets WHERE id = ?';
        this.db.run(sql, [id]);
    }

    getWalletSummary(userId: number): WalletSummary {
        const wallets = this.getWallets(userId);

        const summary: WalletSummary = {
            totalBalance: 0,
            walletCount: wallets.length,
            byType: {
                bank: 0,
                ewallet: 0,
                cash: 0,
                other: 0,
            },
        };

        wallets.forEach(wallet => {
            summary.totalBalance += wallet.balance;
            summary.byType[wallet.type] += wallet.balance;
        });

        return summary;
    }

    getOverallBalance(userId: number): OverallBalance {
        // Get transaction summary
        const transactionSummary = this.db.get(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalExpense
            FROM transactions
            WHERE user_id = ?
        `, [userId]);

        const totalIncome = transactionSummary?.totalIncome || 0;
        const totalExpense = transactionSummary?.totalExpense || 0;
        const netFromTransactions = totalIncome - totalExpense;

        // Get wallet summary
        const walletSummary = this.getWalletSummary(userId);
        const totalWalletBalance = walletSummary.totalBalance;

        return {
            totalIncome,
            totalExpense,
            netFromTransactions,
            totalWalletBalance,
            overallBalance: netFromTransactions + totalWalletBalance,
        };
    }
}
