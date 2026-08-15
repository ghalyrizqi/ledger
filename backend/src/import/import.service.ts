import { Injectable, BadRequestException } from '@nestjs/common';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { DatabaseService } from '../database/database.service';
import { parseBCA, extractBCAMeta } from './parsers/bca.parser';
import { parsePermata } from './parsers/permata.parser';
import { parseJago, extractJagoMeta } from './parsers/jago.parser';
import { parseStockbit, extractStockbitMeta, parseStockbitRDN } from './parsers/stockbit.parser';
import { parseStockbitTC, isStockbitTC } from './parsers/stockbit-tc.parser';
import { parseVision } from './parsers/vision.parser';
import { parseShopee } from './parsers/shopee.parser';
import { parseOVO } from './parsers/ovo.parser';
import { parseBibit } from './parsers/bibit.parser';
import { parseGoPay, extractGopayMeta } from './parsers/gopay.parser';
import { autoCategory } from './category.util';

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
  openingBalance?: number;
  totalInflow?: number;   // total credits / pemasukan
  totalOutflow?: number;  // total debits  / pengeluaran
  closingBalance?: number;
  gainAmt?: number;
  gainPct?: number;
  coveredFrom?: string;
  coveredThrough?: string;
  coverageConfidence?: 'high' | 'medium' | 'low';
}

export type BankType = 'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee' | 'ovo' | 'bibit' | 'gopay';


@Injectable()
export class ImportService {
  constructor(private readonly db: DatabaseService) {}

  private detectBankTypeFromText(text: string): BankType | null {
    // BCA: match logo text OR statement-specific keywords (TAHAPAN is BCA-exclusive)
    if (/bank central asia|bca e-statement|pt\.?\s*bank central asia|tahapan\s*xpresi|rekening\s*tahapan/i.test(text)) return 'bca';
    if (/bank permata|permatabank|pt\.?\s*bank permata/i.test(text)) return 'permata';
    if (/bank jago|pt\.?\s*jago/i.test(text)) return 'jago';
    if (/stockbit/i.test(text)) return 'stockbit';
    if (/shopee/i.test(text)) return 'shopee';
    if (/\bdana\b/i.test(text)) return 'dana';
    if (/gopay|gojek.*dompet|laporan\s+transaksi\s+gopay/i.test(text)) return 'gopay';
    // OVO is screenshot-only — never detected from PDF text to avoid false matches
    // (BCA statements contain "OVO" in transaction descriptions)
    return null;
  }

  private detectBankTypeFromFilename(filename: string): BankType | null {
    const name = filename.toLowerCase();
    if (name.includes('bca')) return 'bca';
    if (name.includes('permata')) return 'permata';
    if (name.includes('jago')) return 'jago';
    if (name.includes('stockbit')) return 'stockbit';
    if (name.includes('shopee')) return 'shopee';
    if (name.includes('dana')) return 'dana';
    if (name.includes('ovo')) return 'ovo';
    if (name.includes('bibit')) return 'bibit';
    if (name.includes('gopay')) return 'gopay';
    return null;
  }

  async autoPreview(
    userId: number,
    files: { buffer: Buffer; mimeType: string; filename: string }[],
  ): Promise<{ rows: PreviewRow[]; meta: PreviewMeta; detectedBank: BankType; walletId: number; walletName: string; walletIcon?: string }> {
    let detectedBank: BankType | null = null;

    for (const file of files) {
      if (file.mimeType.startsWith('image/')) {
        detectedBank = this.detectBankTypeFromFilename(file.filename);
      } else {
        const tmpPath = join(tmpdir(), `ledger-detect-${Date.now()}.pdf`);
        writeFileSync(tmpPath, file.buffer);
        try {
          const text = execSync(`pdftotext "${tmpPath}" -`, { encoding: 'utf8' });
          detectedBank = this.detectBankTypeFromText(text) ?? this.detectBankTypeFromFilename(file.filename);
        } catch {
          detectedBank = this.detectBankTypeFromFilename(file.filename);
        } finally {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
      }
      if (detectedBank) break;
    }

    if (!detectedBank) {
      throw new BadRequestException('Could not detect bank type from filename. Please select your wallet manually below.');
    }

    const wallet = await this.db.get(
      'SELECT * FROM wallets WHERE user_id = ? AND bank_type = ?',
      [userId, detectedBank],
    );

    if (!wallet) {
      throw new BadRequestException(`Detected ${detectedBank.toUpperCase()} statement but no matching wallet found. Please select your wallet manually below.`);
    }

    const result = await this.preview(
      wallet.id,
      detectedBank,
      files.map(f => ({ buffer: f.buffer, mimeType: f.mimeType })),
    );

    return {
      ...result,
      detectedBank,
      walletId: wallet.id,
      walletName: wallet.name,
      walletIcon: wallet.icon ?? undefined,
    };
  }

  async preview(
    walletId: number,
    bankType: BankType,
    files: { buffer: Buffer; mimeType: string }[],
  ): Promise<{ rows: PreviewRow[]; meta: PreviewMeta }> {
    const wallet = await this.db.get('SELECT * FROM wallets WHERE id = ?', [walletId]);
    if (!wallet) throw new Error('Wallet not found');

    const userId: number = wallet.user_id;

    const ownWallets: { account_number: string }[] = await this.db.all(
      'SELECT account_number FROM wallets WHERE user_id = ? AND account_number IS NOT NULL',
      [userId],
    );
    const allUsers: { name: string }[] = await this.db.all('SELECT name FROM users');
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
        } else if (bankType === 'ovo') {
          parsed = await parseOVO(buffer, ownAccounts);
        } else if (bankType === 'stockbit') {
          parsed = await parseStockbitRDN(buffer, ownAccounts);
        } else if (bankType === 'bibit') {
          parsed = await parseBibit(buffer, ownAccounts);
        } else {
          parsed = await parseVision(buffer, mimeType, bankLabel, ownAccounts);
        }
      } else {
        const tmpPath = join(tmpdir(), `ledger-import-${Date.now()}.pdf`);
        writeFileSync(tmpPath, buffer);
        try {
          if (bankType === 'bca') {
            parsed = parseBCA(tmpPath, ownAccounts);
            const bcaMeta = extractBCAMeta(tmpPath);
            if (bcaMeta.closingBalance !== undefined) meta = { ...meta, closingBalance: bcaMeta.closingBalance };
            if (bcaMeta.openingBalance !== undefined) meta = { ...meta, openingBalance: bcaMeta.openingBalance };
            if (bcaMeta.mutasiCr !== undefined) meta = { ...meta, totalInflow: bcaMeta.mutasiCr };
            if (bcaMeta.mutasiDb !== undefined) meta = { ...meta, totalOutflow: bcaMeta.mutasiDb };
            if (bcaMeta.coveredThrough) meta = { ...meta, coveredFrom: bcaMeta.coveredFrom, coveredThrough: bcaMeta.coveredThrough, coverageConfidence: 'high' };
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
          } else if (bankType === 'gopay') {
            parsed = parseGoPay(tmpPath, ownAccounts);
            const gopayMeta = extractGopayMeta(tmpPath);
            if (gopayMeta.totalInflow !== undefined) meta = { ...meta, ...gopayMeta };
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
      const key = `${tx.date}|${tx.amount}|${tx.type}|${tx.description.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const category = autoCategory(tx.description, tx.type, tx.isTransfer);
      rows.push({ ...tx, category, walletId });
    }
    if (rows.length > 0) {
      const dates = rows.map(row => row.date).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
      if (dates.length > 0) {
        meta = {
          ...meta,
          coveredFrom: meta.coveredFrom ?? dates[0],
          coveredThrough: meta.coveredThrough ?? dates[dates.length - 1],
          coverageConfidence: meta.coverageConfidence ?? 'medium',
        };
      }
    }
    return { rows, meta };
  }

  async confirm(
    userId: number,
    rows: PreviewRow[],
    meta?: PreviewMeta,
  ): Promise<{ inserted: number }> {
    let inserted = 0;
    const walletIds = new Set(rows.map(row => row.walletId));
    const insertedByWallet = new Map<number, number>();

    for (const walletId of walletIds) {
      const wallet = await this.db.get('SELECT user_id FROM wallets WHERE id = ?', [walletId]);
      if (!wallet || Number(wallet.user_id) !== userId) throw new BadRequestException('Wallet does not belong to this user');
    }

    for (const row of rows) {
      // Deduplicate: skip if same wallet+date+amount+type+description already exists (case-insensitive)
      const existing = await this.db.get(
        `SELECT id FROM transactions WHERE user_id = ? AND wallet_id = ? AND date = ? AND amount = ? AND type = ? AND LOWER(description) = LOWER(?)`,
        [userId, row.walletId, row.date, row.amount, row.type, row.description],
      );
      if (existing) continue;

      await this.db.run(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, date, is_transfer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, row.walletId, row.type, row.amount, row.category, row.description, row.date, row.isTransfer ? 1 : 0],
      );
      inserted++;
      insertedByWallet.set(row.walletId, (insertedByWallet.get(row.walletId) ?? 0) + 1);
    }

    for (const walletId of walletIds) {
      const walletRows = rows.filter(row => row.walletId === walletId);
      const dates = walletRows.map(row => row.date).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
      const coveredFrom = meta?.coveredFrom ?? dates[0] ?? null;
      const coveredThrough = meta?.coveredThrough ?? dates[dates.length - 1] ?? null;
      if (meta?.closingBalance !== undefined) {
        const closingDate = rows
          .filter(row => row.walletId === walletId)
          .reduce((latest, row) => row.date > latest ? row.date : latest, '');
        const tx = await this.db.get(
          `SELECT COALESCE(SUM(CASE
             WHEN type = 'income' THEN amount
             WHEN type = 'expense' THEN -amount
             ELSE 0
           END), 0) AS net
           FROM transactions WHERE wallet_id = ? AND date <= ?`,
          [walletId, closingDate],
        );
        // Store the offset that makes the computed balance on the statement's
        // closing date equal the bank-provided closing balance.
        await this.db.run('UPDATE wallets SET balance = ? WHERE id = ?',
          [Number(meta.closingBalance) - Number(tx?.net || 0), walletId]);
      }

      if (meta?.gainAmt !== undefined && meta?.gainPct !== undefined) {
        await this.db.run(
          'UPDATE wallets SET gain_amt = ?, gain_pct = ? WHERE id = ?',
          [meta.gainAmt, meta.gainPct, walletId],
        );
      }

      const walletInserted = insertedByWallet.get(walletId) ?? 0;
      await this.db.run(
        `INSERT INTO wallet_imports
          (user_id, wallet_id, source, status, covered_from, covered_through, closing_balance, imported_count, duplicate_count)
         VALUES (?, ?, 'web', ?, ?, ?, ?, ?, ?)`,
        [userId, walletId, coveredThrough ? 'success' : 'partial', coveredFrom, coveredThrough,
         meta?.closingBalance ?? null, walletInserted, Math.max(0, walletRows.length - walletInserted)],
      );
    }

    return { inserted };
  }
}
