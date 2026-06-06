import { Injectable } from '@nestjs/common';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseService } from '../database/database.service';
import { parseBCA } from './parsers/bca.parser';
import { parsePermata } from './parsers/permata.parser';
import { parseJago, extractJagoMeta } from './parsers/jago.parser';
import { parseStockbit, extractStockbitMeta } from './parsers/stockbit.parser';
import { parseStockbitTC, isStockbitTC } from './parsers/stockbit-tc.parser';
import { parseVision } from './parsers/vision.parser';
import { parseShopee } from './parsers/shopee.parser';

export interface ParsedTx {
  date: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  isTransfer: boolean;
  raw: string;
}

export interface PreviewRow extends ParsedTx {
  category: string;
  walletId: number;
}

export interface PreviewMeta {
  closingBalance?: number;
  gainAmt?: number;
  gainPct?: number;
}

export type BankType = 'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee';


@Injectable()
export class ImportService {
  constructor(private readonly db: DatabaseService) {}

  async preview(
    walletId: number,
    bankType: BankType,
    files: { buffer: Buffer; mimeType: string }[],
  ): Promise<{ rows: PreviewRow[]; meta: PreviewMeta }> {
    const wallet = this.db.get('SELECT * FROM wallets WHERE id = ?', [walletId]);
    if (!wallet) throw new Error('Wallet not found');

    const userId: number = wallet.user_id;

    const ownWallets: { account_number: string }[] = this.db.all(
      'SELECT account_number FROM wallets WHERE user_id = ? AND account_number IS NOT NULL',
      [userId],
    );
    const allUsers: { name: string }[] = this.db.all('SELECT name FROM users');
    const ownAccounts = [
      ...ownWallets.map(w => w.account_number).filter(Boolean),
      ...allUsers.map(u => u.name).filter(Boolean),
    ];

    const bankLabel = bankType === 'dana' ? 'Dana' : bankType === 'shopee' ? 'ShopeePay' : bankType.toUpperCase();

    const allParsed: ParsedTx[] = [];
    let meta: PreviewMeta = {};

    for (const { buffer, mimeType } of files) {
      let parsed: ParsedTx[] = [];

      if (mimeType.startsWith('image/')) {
        if (bankType === 'shopee') {
          parsed = await parseShopee(buffer, ownAccounts);
        } else {
          parsed = await parseVision(buffer, mimeType, bankLabel, ownAccounts);
        }
      } else {
        const tmpPath = join(tmpdir(), `ledger-import-${Date.now()}.pdf`);
        writeFileSync(tmpPath, buffer);
        try {
          if (bankType === 'bca') {
            parsed = parseBCA(tmpPath, ownAccounts);
          } else if (bankType === 'permata') {
            parsed = parsePermata(tmpPath, ownAccounts);
          } else if (bankType === 'jago') {
            parsed = parseJago(tmpPath, ownAccounts);
            const jagoMeta = extractJagoMeta(tmpPath);
            if (jagoMeta.closingBalance !== undefined) meta = { ...meta, ...jagoMeta };
          } else if (bankType === 'stockbit') {
            if (isStockbitTC(tmpPath)) {
              parsed = parseStockbitTC(tmpPath);
            } else {
              parsed = parseStockbit(tmpPath, ownAccounts);
              const sbMeta = extractStockbitMeta(tmpPath);
              if (sbMeta.closingBalance !== undefined) meta = { ...meta, ...sbMeta };
            }
          } else if (bankType === 'dana') {
            parsed = parseBCA(tmpPath, ownAccounts); // fallback
          }
        } finally {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
      }
      allParsed.push(...parsed);
    }

    // Sort all parsed transactions chronologically before building preview
    allParsed.sort((a, b) => a.date.localeCompare(b.date));

    // Auto-assign category and deduplicate within the preview itself
    const seen = new Set<string>();
    const rows: PreviewRow[] = [];
    for (const tx of allParsed) {
      const key = `${tx.date}|${tx.amount}|${tx.type}|${tx.description}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let category = tx.isTransfer ? 'Internal Transfer'
        : tx.type === 'income' ? 'Other Income'
        : 'Other Expense';
      if (!tx.isTransfer && bankType === 'stockbit' && (
        /dividend/i.test(tx.description) ||
        /^(Buy|Sell)/i.test(tx.description)
      )) {
        category = 'Investment';
      }
      rows.push({ ...tx, category, walletId });
    }
    return { rows, meta };
  }

  async confirm(
    userId: number,
    rows: PreviewRow[],
    meta?: PreviewMeta,
  ): Promise<{ inserted: number }> {
    let inserted = 0;
    const walletDeltas = new Map<number, number>();

    for (const row of rows) {
      const delta = row.type === 'income' ? row.amount : -row.amount;
      walletDeltas.set(row.walletId, (walletDeltas.get(row.walletId) ?? 0) + delta);

      // Deduplicate: skip if same date+amount+type+description already exists
      const existing = this.db.get(
        `SELECT id FROM transactions WHERE user_id = ? AND date = ? AND amount = ? AND type = ? AND description = ?`,
        [userId, row.date, row.amount, row.type, row.description],
      );
      if (existing) continue;

      this.db.run(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, date, is_transfer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, row.walletId, row.type, row.amount, row.category, row.description, row.date, row.isTransfer ? 1 : 0],
      );
      inserted++;
    }

    for (const [walletId, delta] of walletDeltas) {
      if (meta?.closingBalance !== undefined) {
        // Statement provides authoritative current balance — set it directly
        this.db.run('UPDATE wallets SET balance = ? WHERE id = ?', [meta.closingBalance, walletId]);
      } else if (delta !== 0) {
        this.db.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', [delta, walletId]);
      }

      if (meta?.gainAmt !== undefined && meta?.gainPct !== undefined) {
        this.db.run(
          'UPDATE wallets SET gain_amt = ?, gain_pct = ? WHERE id = ?',
          [meta.gainAmt, meta.gainPct, walletId],
        );
      }
    }

    return { inserted };
  }
}
