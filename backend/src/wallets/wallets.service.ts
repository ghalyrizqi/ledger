import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Wallet, WalletSummary, OverallBalance, WalletFreshness } from './entities/wallet.entity';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';

@Injectable()
export class WalletsService {
    constructor(private readonly db: DatabaseService) { }

    async getWallets(userId: number): Promise<Wallet[]> {
        const rows = await this.db.all(`
            SELECT w.*,
                w.balance + COALESCE(tx.net, 0) AS balance,
                tx.latest_transaction_date,
                wi.uploaded_at AS latest_upload_at,
                wi.covered_through AS latest_covered_through,
                wi.source AS latest_source,
                wi.status AS latest_import_status
            FROM wallets w
            LEFT JOIN (
                SELECT wallet_id,
                    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net,
                    MAX(date) AS latest_transaction_date
                FROM transactions GROUP BY wallet_id
            ) tx ON tx.wallet_id = w.id
            LEFT JOIN LATERAL (
                SELECT uploaded_at, covered_through, source, status
                FROM wallet_imports WHERE wallet_id = w.id
                ORDER BY uploaded_at DESC, id DESC LIMIT 1
            ) wi ON TRUE
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC
        `, [userId]);
        return rows.map(row => ({ ...row, freshness: this.calculateFreshness(row) }));
    }

    private calculateFreshness(wallet: any): WalletFreshness {
        const base = {
            coveredThrough: wallet.latest_covered_through ?? null,
            latestTransactionDate: wallet.latest_transaction_date ?? null,
            lastUploadAt: wallet.latest_upload_at ?? wallet.last_confirmed_at ?? null,
            source: wallet.latest_source ?? (wallet.last_confirmed_at ? 'manual' : null),
            latestImportStatus: wallet.latest_import_status ?? null,
        } as const;
        if (!wallet.freshness_enabled) return { ...base, status: 'ignored', label: 'Not tracked', reason: 'Freshness tracking is disabled.' };
        if (wallet.latest_import_status && wallet.latest_import_status !== 'success') {
            return { ...base, status: 'review_needed', label: 'Review needed', reason: 'The latest statement could not be verified.' };
        }

        const now = new Date();
        if (wallet.freshness_mode === 'manual' || wallet.update_frequency === 'manual') {
            if (!wallet.last_confirmed_at) return { ...base, status: 'manual', label: 'Confirm balance', reason: 'This wallet needs a manual balance confirmation.' };
            const confirmed = new Date(wallet.last_confirmed_at);
            const age = Math.floor((now.getTime() - confirmed.getTime()) / 86400000);
            if (age > 30 + Number(wallet.grace_days || 0)) return { ...base, status: 'needs_update', label: 'Needs confirmation', reason: `Last confirmed ${age} days ago.` };
            return { ...base, status: 'up_to_date', label: 'Up to date', reason: `Balance confirmed ${age === 0 ? 'today' : `${age} days ago`}.` };
        }

        if (!wallet.latest_upload_at || !wallet.latest_covered_through) {
            return { ...base, status: 'never_uploaded', label: 'Never uploaded', reason: 'No verified statement coverage has been recorded.' };
        }

        const covered = new Date(`${wallet.latest_covered_through}T00:00:00Z`);
        if (wallet.update_frequency === 'weekly') {
            const due = new Date(covered.getTime() + (7 + Number(wallet.grace_days || 0)) * 86400000);
            const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
            if (days < 0) return { ...base, status: 'needs_update', label: 'Needs update', nextDueAt: due.toISOString(), daysUntilDue: days, reason: `Coverage ended ${wallet.latest_covered_through}.` };
            if (days <= 2) return { ...base, status: 'due_soon', label: 'Due soon', nextDueAt: due.toISOString(), daysUntilDue: days, reason: `Next update is due in ${days} day${days === 1 ? '' : 's'}.` };
            return { ...base, status: 'up_to_date', label: 'Up to date', nextDueAt: due.toISOString(), daysUntilDue: days, reason: `Covered through ${wallet.latest_covered_through}.` };
        }

        const requiredThrough = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(28, Number(wallet.expected_day || 7)) + Number(wallet.grace_days || 0)));
        const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
        if (covered >= requiredThrough) {
            const nextDue = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, Math.min(28, Number(wallet.expected_day || 7)) + Number(wallet.grace_days || 0)));
            const nextDays = Math.ceil((nextDue.getTime() - now.getTime()) / 86400000);
            return { ...base, status: 'up_to_date', label: 'Up to date', nextDueAt: nextDue.toISOString(), daysUntilDue: nextDays, reason: `Covered through ${wallet.latest_covered_through}.` };
        }
        if (days >= 0) return { ...base, status: 'due_soon', label: 'Due soon', nextDueAt: due.toISOString(), daysUntilDue: days, reason: `The previous month's statement is due in ${days} day${days === 1 ? '' : 's'}.` };
        return { ...base, status: 'needs_update', label: 'Needs update', nextDueAt: due.toISOString(), daysUntilDue: days, reason: `Needs a statement covering through ${requiredThrough.toISOString().slice(0, 10)}.` };
    }

    async getWallet(id: number): Promise<Wallet> {
        return this.db.get('SELECT * FROM wallets WHERE id = ?', [id]);
    }

    async createWallet(dto: CreateWalletDto): Promise<Wallet> {
        const row = await this.db.get(
            `INSERT INTO wallets (user_id, name, type, balance, icon, color, bank_type, account_number,
                freshness_enabled, freshness_mode, update_frequency, expected_day, grace_days, freshness_initialized)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE) RETURNING id`,
            [dto.user_id, dto.name, dto.type, dto.balance || 0, dto.icon || null, dto.color || null, dto.bank_type || null, dto.account_number || null,
             dto.freshness_enabled ?? true, dto.freshness_mode ?? (dto.type === 'cash' || dto.type === 'other' ? 'manual' : 'statement'),
             dto.update_frequency ?? (dto.type === 'ewallet' ? 'weekly' : dto.type === 'cash' || dto.type === 'other' ? 'manual' : 'monthly'),
             dto.expected_day ?? 7, dto.grace_days ?? 0]
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
        if (dto.balance !== undefined) {
            // The API exposes a wallet's computed current balance, while the
            // database stores only its opening/base offset. Convert the value
            // entered in the "Current Balance" field back to that offset so
            // existing transactions are not counted a second time.
            const tx = await this.db.get(`
                SELECT COALESCE(SUM(CASE
                    WHEN type = 'income' THEN amount
                    WHEN type = 'expense' THEN -amount
                    ELSE 0
                END), 0) AS net
                FROM transactions WHERE wallet_id = ?
            `, [id]);
            updates.push('balance = ?');
            params.push(Number(dto.balance) - Number(tx?.net || 0));
        }
        if (dto.icon !== undefined)           { updates.push('icon = ?');           params.push(dto.icon); }
        if (dto.color !== undefined)          { updates.push('color = ?');          params.push(dto.color); }
        if (dto.bank_type !== undefined)      { updates.push('bank_type = ?');      params.push(dto.bank_type); }
        if (dto.account_number !== undefined) { updates.push('account_number = ?'); params.push(dto.account_number); }
        if (dto.gain_amt !== undefined)        { updates.push('gain_amt = ?');        params.push(dto.gain_amt); }
        if (dto.gain_pct !== undefined)        { updates.push('gain_pct = ?');        params.push(dto.gain_pct); }
        if (dto.freshness_enabled !== undefined) { updates.push('freshness_enabled = ?'); params.push(dto.freshness_enabled); }
        if (dto.freshness_mode !== undefined) { updates.push('freshness_mode = ?'); params.push(dto.freshness_mode); }
        if (dto.update_frequency !== undefined) { updates.push('update_frequency = ?'); params.push(dto.update_frequency); }
        if (dto.expected_day !== undefined) { updates.push('expected_day = ?'); params.push(Math.max(1, Math.min(28, dto.expected_day))); }
        if (dto.grace_days !== undefined) { updates.push('grace_days = ?'); params.push(Math.max(0, Math.min(30, dto.grace_days))); }

        if (updates.length > 0) {
            params.push(id);
            await this.db.run(`UPDATE wallets SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        return this.getWallet(id);
    }

    async deleteWallet(id: number): Promise<void> {
        await this.db.run('DELETE FROM wallets WHERE id = ?', [id]);
    }

    async getFreshnessSummary(userId: number) {
        const wallets = await this.getWallets(userId);
        const count = (status: string) => wallets.filter(w => w.freshness?.status === status).length;
        return {
            total: wallets.filter(w => w.freshness?.status !== 'ignored').length,
            upToDate: count('up_to_date'), dueSoon: count('due_soon'), needsUpdate: count('needs_update'),
            neverUploaded: count('never_uploaded'), reviewNeeded: count('review_needed'),
            walletsNeedingAttention: wallets.filter(w => ['due_soon', 'needs_update', 'never_uploaded', 'review_needed', 'manual'].includes(w.freshness?.status || '')),
        };
    }

    async getImportHistory(id: number) {
        return this.db.all('SELECT * FROM wallet_imports WHERE wallet_id = ? ORDER BY uploaded_at DESC, id DESC LIMIT 50', [id]);
    }

    async confirmFreshness(id: number) {
        await this.db.run('UPDATE wallets SET last_confirmed_at = NOW() WHERE id = ?', [id]);
        const wallet = await this.getWallet(id);
        await this.db.run(
            `INSERT INTO wallet_imports (user_id, wallet_id, source, status, covered_through, imported_count)
             VALUES (?, ?, 'manual', 'success', ?, 0)`,
            [wallet.user_id, id, new Date().toISOString().slice(0, 10)],
        );
        return this.getWallet(id);
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
            // Wallet balances already include their assigned transactions.
            overallBalance: totalWalletBalance,
        };
    }
}
