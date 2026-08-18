import { execSync } from 'child_process';
import { ParsedTx } from '../import.service';

const MONTH_MAP: Record<string, number> = {
  JANUARI: 1, FEBRUARI: 2, MARET: 3, APRIL: 4, MEI: 5, JUNI: 6,
  JULI: 7, AGUSTUS: 8, SEPTEMBER: 9, OKTOBER: 10, NOVEMBER: 11, DESEMBER: 12,
};

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

// BCA prints two decimal places, with commas only when the amount reaches four digits.
const AMOUNT_SOURCE = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}`;

// Patterns in description that mean money is going to/from own wallets/investment accounts → transfer
const EWALLET_TOPUP_RE = /\bOVO\b|GOPAY[\s_]*TOPUP|FLAZZ[\s_]*BCA[\s_]*TOPUP|SHOPEEPAY|DANA\b|\bBIBIT\b|\bSTOCKBIT\b/i;

// Lines to skip (balance markers, column headers)
const SKIP_RE = /SALDO\s*AWAL|SALDO\s*AKHIR|MUTASI\s*CR|MUTASI\s*DB|TANG\s*GA\s*L|KET\s*ER\s*AN|BERSAMBUNG|HALAMAN/i;

export function parseBCA(filePath: string, ownAccounts: string[]): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });

  // Extract statement period from header
  let year = new Date().getFullYear();
  let statementMonth: number | undefined;
  for (const line of raw.split('\n')) {
    const compact = line.replace(/\s/g, '');
    const m = compact.match(/(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)(\d{4})/i);
    if (m) {
      year = parseInt(m[2]);
      statementMonth = MONTH_MAP[m[1].toUpperCase()];
      break;
    }
  }

  // ── Group lines into transaction blocks ──────────────────────────────────
  // Each block starts with a line containing DD/MM at the left margin.
  // Continuation lines (no date, indented) belong to the same block.

  interface Block { date: string; lines: string[] }
  const blocks: Block[] = [];
  let cur: Block | null = null;

  for (const line of raw.split('\n')) {
    const dateMatch = line.match(/^\s{0,14}(\d{2})\/(\d{2})\s/);
    if (dateMatch) {
      const [, dd, mm] = dateMatch;
      const numericMonth = Number(mm);
      const numericDay = Number(dd);
      const calendarDate = new Date(Date.UTC(year, numericMonth - 1, numericDay));
      const isValidDate = calendarDate.getUTCFullYear() === year
        && calendarDate.getUTCMonth() + 1 === numericMonth
        && calendarDate.getUTCDate() === numericDay;
      // Dates printed in headers/footers (for example the statement generation
      // date) must never become transactions for a different statement month.
      if (!isValidDate || (statementMonth !== undefined && numericMonth !== statementMonth)) continue;
      if (cur) blocks.push(cur);
      cur = { date: `${year}-${mm}-${dd}`, lines: [line] };
    } else if (cur && line.trim()) {
      cur.lines.push(line);
    }
  }
  if (cur) blocks.push(cur);

  const txs: ParsedTx[] = [];

  for (const { date, lines } of blocks) {
    const first = lines[0];
    if (SKIP_RE.test(first)) continue;

    const allText = lines.join(' ');

    // ── Amount detection ─────────────────────────────────────────────────
    // Debit: "23,000.00 DB" anywhere in the block
    const debitMatch = allText.match(new RegExp(`(${AMOUNT_SOURCE})\\s+DB\\b`, 'i'));
    let amount: number;
    let type: 'income' | 'expense';

    if (debitMatch) {
      amount = parseAmount(debitMatch[1]);
      type = 'expense';
    } else {
      // Credit: skip BCA's zero-valued merchant/reference prefixes and use the
      // first positive amount that is not marked as a debit.
      const creditMatches = allText.matchAll(new RegExp(`\\b(${AMOUNT_SOURCE})\\b(?!\\s*DB\\b)`, 'gi'));
      const creditAmount = Array.from(creditMatches, match => parseAmount(match[1]))
        .find(candidate => candidate > 0);
      if (creditAmount === undefined) continue;
      amount = creditAmount;
      type = 'income';
    }

    if (!amount || amount <= 0) continue;

    // ── Description extraction ───────────────────────────────────────────
    const description = buildDescription(lines);

    // ── Transfer detection ───────────────────────────────────────────────
    const isTransfer = detectTransfer(allText, lines, ownAccounts);

    txs.push({ date, type, amount, description, isTransfer, raw: first.trim() });
  }

  // When the same (date, description, amount) appears multiple times in one statement
  // (e.g. 4× ATM withdrawals of the same amount on the same day), append a counter so
  // the deduplication logic in preview/confirm treats them as distinct transactions.
  const groupCount: Record<string, number> = {};
  const groupIndex: Record<string, number> = {};
  for (const tx of txs) {
    const k = `${tx.date}|${tx.description}|${tx.amount}`;
    groupCount[k] = (groupCount[k] ?? 0) + 1;
  }
  return txs.map(tx => {
    const k = `${tx.date}|${tx.description}|${tx.amount}`;
    if (groupCount[k] <= 1) return tx;
    groupIndex[k] = (groupIndex[k] ?? 0) + 1;
    return { ...tx, description: `${tx.description} (${groupIndex[k]})` };
  });
}

function buildDescription(lines: string[]): string {
  const first = lines[0];

  // Strip leading date token from first line
  const withoutDate = first.replace(/^\s*\d{2}\/\d{2}\s+/, '').trim();

  // Extract the transaction type keyword (before reference codes / amounts)
  const txType = withoutDate
    .replace(/\s+\d{4}\/[A-Z]+\/[A-Z0-9]+.*/, '')   // ref codes like "0104/FTSCY/WS95271"
    .replace(/\s+TGL:\s*\d{2}\/\d{2}.*/, '')         // "TGL: 02/04 ..."
    .replace(/\s+TANGGAL\s*:\s*\d{2}\/\d{2}.*/, '')  // "TANGGAL :07/04"
    .replace(/([\d,]+\.\d{2})(\s+DB)?.*/, '')         // trailing amounts
    .replace(/\s+/g, ' ').trim();

  // Look through continuation lines for a useful name/merchant
  let detail = '';
  for (const cl of lines.slice(1)) {
    const t = cl.trim();
    if (!t) continue;

    // QR merchant: "00000.00ALFAMART R" or "0145201705176386" (reference — skip)
    const merchantMatch = t.match(/^0+\.?0*\s*([A-Z].+)/i);
    if (merchantMatch) {
      const name = merchantMatch[1].trim();
      if (name.length >= 3 && !/^\d+$/.test(name)) {
        detail = name;
        break;
      }
      continue;
    }

    // Skip pure reference lines (only digits, slashes, dashes)
    if (/^[\d\s\/\-]+$/.test(t)) continue;

    // Skip BIF/amount-only lines
    if (/^BIF\s+TRANSFER|^\d{4}\/[A-Z]/.test(t)) continue;

    // A line with real text (recipient/sender name)
    if (/[A-Za-z]/.test(t) && t.length >= 3) {
      detail = t;
      // Don't break — keep looking for merchant names further down
    }
  }

  const combined = detail ? `${txType} — ${detail}` : txType;
  return combined.slice(0, 120) || 'BCA Transaction';
}

function detectTransfer(allText: string, lines: string[], ownAccounts: string[]): boolean {
  // E-wallet / prepaid top-ups from BCA → always transfers
  if (EWALLET_TOPUP_RE.test(allText)) return true;

  // Investment account redemptions are internal transfers, not income
  if (/pencairan\s*reksa|reksa\s*dana/i.test(allText)) return true;

  // Check if any own account name / account number appears anywhere in the block
  const lower = allText.toLowerCase();
  if (ownAccounts.some(acc => acc && lower.includes(acc.toLowerCase()))) return true;

  return false;
}

export interface BCAMeta {
  openingBalance?: number;
  mutasiCr?: number;
  mutasiCrCount?: number;
  mutasiDb?: number;
  mutasiDbCount?: number;
  closingBalance?: number;
  coveredFrom?: string;
  coveredThrough?: string;
}

export function extractBCAMeta(filePath: string): BCAMeta {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });

  function extract(pattern: RegExp): number | undefined {
    const m = raw.match(pattern);
    return m ? parseFloat(m[1].replace(/,/g, '')) : undefined;
  }

  function extractCount(label: 'CR' | 'DB'): number | undefined {
    const pattern = new RegExp(
      `MUTASI\\s*${label}\\s*[:\\s]+${AMOUNT_SOURCE}\\s*(?:count\\s*)?\\(?\\s*(\\d+)\\s*\\)?`,
      'i',
    );
    const match = raw.match(pattern);
    return match ? Number(match[1]) : undefined;
  }

  const compact = raw.replace(/\s/g, '');
  const period = compact.match(/(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)(\d{4})/i);
  let coveredFrom: string | undefined;
  let coveredThrough: string | undefined;
  if (period) {
    const month = MONTH_MAP[period[1].toUpperCase()];
    const year = Number(period[2]);
    const mm = String(month).padStart(2, '0');
    coveredFrom = `${year}-${mm}-01`;
    coveredThrough = `${year}-${mm}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
  }

  return {
    openingBalance: extract(/SALDO\s*AWAL\s*[:\s]+([\d,]+\.\d{2})/i),
    mutasiCr:       extract(/MUTASI\s*CR\s*[:\s]+([\d,]+\.\d{2})/i),
    mutasiCrCount:  extractCount('CR'),
    mutasiDb:       extract(/MUTASI\s*DB\s*[:\s]+([\d,]+\.\d{2})/i),
    mutasiDbCount:  extractCount('DB'),
    closingBalance: extract(/SALDO\s*AKHIR\s*[:\s]+([\d,]+\.\d{2})/i),
    coveredFrom,
    coveredThrough,
  };
}

export function isBCAStatementText(text: string): boolean {
  const transactionSignatures = [
    /TRSF\s+E-BANKING/i,
    /FT(?:FVA|QRS|SCY)\/WS/i,
    /TARIKAN\s+ATM/i,
    /SALDO\s+AWAL/i,
  ].filter(pattern => pattern.test(text)).length;
  return /PT\s*Bank\s*Central\s*Asia|KlikBCA|BCA\s*Mobile/i.test(text)
    || (/SALDO\s*AWAL/i.test(text)
      && /MUTASI\s*CR/i.test(text)
      && /MUTASI\s*DB/i.test(text)
      && /SALDO\s*AKHIR/i.test(text))
    || transactionSignatures >= 2;
}

export function reconcileBCA(txs: ParsedTx[], meta: BCAMeta): boolean {
  const income = txs.filter(tx => tx.type === 'income');
  const expense = txs.filter(tx => tx.type === 'expense');
  const inflow = income.reduce((sum, tx) => sum + tx.amount, 0);
  const outflow = expense.reduce((sum, tx) => sum + tx.amount, 0);
  const amountMatches = (actual: number, expected?: number) => expected === undefined || Math.abs(actual - expected) < 0.005;
  const countMatches = (actual: number, expected?: number) => expected === undefined || actual === expected;
  const hasStatementTotals = meta.mutasiCr !== undefined && meta.mutasiDb !== undefined;
  return hasStatementTotals
    && countMatches(income.length, meta.mutasiCrCount)
    && countMatches(expense.length, meta.mutasiDbCount)
    && amountMatches(inflow, meta.mutasiCr)
    && amountMatches(outflow, meta.mutasiDb);
}
