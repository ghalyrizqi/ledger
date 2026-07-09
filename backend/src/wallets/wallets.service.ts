import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Wallet, WalletSummary, OverallBalance } from './entities/wallet.entity';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';

@Injectable()
export class WalletsService {
    constructor(private readonly db: DatabaseService) { }

    async getWallets(userId: number): Promise<Wallet[]> {
        return this.db.all(`
            SELECT w.*,
                w.balance + COALESCE(SUM(CASE
                    WHEN t.type = 'income'  THEN  t.amount
                    WHEN t.type = 'expense' THEN -t.amount
                    ELSE 0
                END), 0) AS balance
            FROM wallets w
            LEFT JOIN transactions t ON t.wallet_id = w.id
            WHERE w.user_id = ?
            GROUP BY w.id
            ORDER BY w.created_at DESC
        `, [userId]);
    }

    async getWallet(id: number): Promise<Wallet> {
        return this.db.get('SELECT * FROM wallets WHERE id = ?', [id]);
    }

    async createWallet(dto: CreateWalletDto): Promise<Wallet> {
        const row = await this.db.get(
            `INSERT INTO wallets (user_id, name, type, balance, icon, color, bank_type, account_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
            [dto.user_id, dto.name, dto.type, dto.balance || 0, dto.icon || null, dto.color || null, dto.bank_type || null, dto.account_number || null]
        );
        return this.getWallet(row.id);
    }

    async updateWallet(id: number, dto: UpdateWalletDto): Promise<Wallet> {
        const wallet = await this.getWallet(id);
        if (!wallet) throw new Error('Wallet not found');

        const updates: string[] = [];
        const params: any[] = [];

        if (dto.name !== undefined)           { updates.push('name = ?');           params.push(dto.name); }
        if (dto.type !== undefined)           { updates.push('type = ?');           params.push(dto.type); }
        if (dto.balance !== undefined)        { updates.push('balance = ?');        params.push(dto.balance); }
        if (dto.icon !== undefined)           { updates.push('icon = ?');           params.push(dto.icon); }
        if (dto.color !== undefined)          { updates.push('color = ?');          params.push(dto.color); }
        if (dto.bank_type !== undefined)      { updates.push('bank_type = ?');      params.push(dto.bank_type); }
        if (dto.account_number !== undefined) { updates.push('account_number = ?'); params.push(dto.account_number); }
        if (dto.gain_amt !== undefined)        { updates.push('gain_amt = ?');        params.push(dto.gain_amt); }
        if (dto.gain_pct !== undefined)        { updates.push('gain_pct = ?');        params.push(dto.gain_pct); }

        if (updates.length > 0) {
            params.push(id);
            await this.db.run(`UPDATE wallets SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        return this.getWallet(id);
    }

    async deleteWallet(id: number): Promise<void> {
        await this.db.run('DELETE FROM wallets WHERE id = ?', [id]);
    }

    async getWalletSummary(userId: number): Promise<WalletSummary> {
        const wallets = await this.getWallets(userId);
        const summary: WalletSummary = {
            totalBalance: 0,
            walletCount: wallets.length,
            byType: { bank: 0, ewallet: 0, cash: 0, other: 0 },
        };
        wallets.forEach(w => {
            summary.totalBalance += Number(w.balance);
            summary.byType[w.type] += Number(w.balance);
        });
        return summary;
    }

    async getOverallBalance(userId: number): Promise<OverallBalance> {
        const row = await this.db.get(`
            SELECT
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS "totalIncome",
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS "totalExpense"
            FROM transactions
            WHERE user_id = ? AND (is_transfer = 0 OR is_transfer IS NULL)
        `, [userId]);

        const totalIncome = Number(row?.totalIncome || 0);
        const totalExpense = Number(row?.totalExpense || 0);
        const netFromTransactions = totalIncome - totalExpense;

        const summary = await this.getWalletSummary(userId);
        const totalWalletBalance = summary.totalBalance;

        return {
            totalIncome,
            totalExpense,
            netFromTransactions,
            totalWalletBalance,
            overallBalance: netFromTransactions + totalWalletBalance,
        };
    }
}
