import { execSync } from 'child_process';
import { ParsedTx } from '../import.service';

// Indonesian month abbreviations used in Jago exports
const JAGO_MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, Mei: 5, Jun: 6,
  Jul: 7, Agu: 8, Agt: 8, Sep: 9, Okt: 10, Nov: 11, Des: 12,
};

function parseJagoAmount(raw: string): number {
  // Indonesian format: "15.825.875,00" → 15825875.00
  // Remove the sign prefix, convert separators
  const clean = raw.replace(/[+-]/, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

const INVESTMENT_PLATFORM_RE = /\bbibit\b|\bstockbit\b|pencairan\s*reksa|reksa\s*dana/i;
const EWALLET_RE = /\bovo\b|\bshopeepay\b|\bshopee\s*pay\b|\bdana\b|\bgopay\b/i;

function isOwnAccount(text: string, ownAccounts: string[]): boolean {
  const lower = text.toLowerCase();
  return INVESTMENT_PLATFORM_RE.test(text)
    || EWALLET_RE.test(text)
    || ownAccounts.some(acc => lower.includes(acc.toLowerCase()));
}

function extractSource(line: string): string {
  // The Sumber/Tujuan column starts around character 18 in layout mode
  // Grab everything between the date and the Rincian Transaksi / amount
  // We take the middle portion of the line
  const withoutDate = line.replace(/^\d{2}\s+\w+\s+\d{4}\s*/, '');
  // Remove trailing amount and balance
  const withoutAmounts = withoutDate.replace(/\s+[+-]?[\d.]+,\d{2}\s+[\d.]+,\d{2}\s*$/, '')
    .replace(/\s+[+-]?[\d.]+\s+[\d.]+,\d{2}\s*$/, '');
  return withoutAmounts.trim().replace(/\s{2,}/g, ' ').slice(0, 80);
}

function numberDuplicateDescriptions(txs: ParsedTx[]): ParsedTx[] {
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

// Parse the reading-order text returned by pdf-parse. Jago's PDF stores each
// transaction as date, time, details, then a signed amount and balance. This
// path keeps Telegram PDF ingestion working on hosts without poppler/pdftotext.
export function parseJagoText(raw: string, ownAccounts: string[]): ParsedTx[] {
  const lines = raw.split('\n').map(line => line.trim());
  const txs: ParsedTx[] = [];
  const DATE_RE = /^(\d{2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Agt|Sep|Okt|Nov|Des)\s+(\d{4})$/;
  const AMOUNT_RE = /([+-][\d.]+(?:,\d{2})?)\s+[\d.]+(?:,\d{2})?$/;
  const HEADER_RE = /^(Tanggal & Waktu|Pockets Transactions History|Halaman \d+ dari \d+)/i;

  for (let i = 0; i < lines.length; i++) {
    const dm = lines[i].match(DATE_RE);
    if (!dm || !/^\d{2}\.\d{2}$/.test(lines[i + 1] || '')) continue;

    const date = `${dm[3]}-${String(JAGO_MONTHS[dm[2]]).padStart(2, '0')}-${dm[1]}`;
    const block: string[] = [];
    let amountMatch: RegExpMatchArray | null = null;
    let amountLine = '';
    let j = i + 2;
    for (; j < lines.length; j++) {
      if (DATE_RE.test(lines[j]) && /^\d{2}\.\d{2}$/.test(lines[j + 1] || '')) break;
      const match = lines[j].match(AMOUNT_RE);
      if (match) {
        amountMatch = match;
        amountLine = lines[j];
        break;
      }
      if (lines[j] && !HEADER_RE.test(lines[j])) block.push(lines[j]);
    }
    if (!amountMatch) continue;

    const rawAmount = amountMatch[1];
    const amount = parseJagoAmount(rawAmount);
    if (amount <= 0) continue;
    const type: 'income' | 'expense' = rawAmount.startsWith('+') ? 'income' : 'expense';
    const fullText = block.join(' ');
    const detail = fullText.match(/(?:Transfer\s+(?:Masuk|Keluar)|Pembayaran\s+(?:QRIS|dengan\s+Jago\s+Pay)|Isi\s+Saldo|Transaksi\s+POS|Biaya\s+(?:Transfer|dari\s+Kekurangan)|Cashback[^+\-]*)/i)?.[0];
    const source = block.slice(0, 2).join(' ').replace(/\s{2,}/g, ' ').trim();
    const description = (detail || source || 'Jago Transaction').slice(0, 100);

    txs.push({
      date, type, amount, description,
      isTransfer: isOwnAccount(fullText, ownAccounts),
      raw: `${lines[i]} ${lines[i + 1]} ${amountLine}`,
    });
    i = j;
  }

  return numberDuplicateDescriptions(txs);
}

export interface JagoMeta {
  openingBalance?: number;
  totalInflow?: number;
  totalOutflow?: number;
  closingBalance?: number;
}

export function extractJagoMeta(filePath: string): JagoMeta {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });
  const lines = raw.split('\n');

  // Format A: in-app history export — "Saldo terbaru ... IDR 456.898"
  for (let i = 0; i < lines.length; i++) {
    if (/Saldo terbaru/i.test(lines[i])) {
      for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
        const m = lines[j].match(/IDR\s+([\d.]+(?:,\d{1,2})?)/);
        if (m) return { closingBalance: parseJagoAmount(m[1]) };
      }
    }
  }

  // Format B: "mutasi rekening" — comma-as-thousands integers, e.g. "349,324"
  function parseIntAmt(s: string): number {
    return parseFloat(s.replace(/[+\-,]/g, '')) || 0;
  }

  let openingBalance: number | undefined;
  let totalInflow: number | undefined;
  let totalOutflow: number | undefined;
  let closingBalance: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Summary header row → values on the very next line
    if (/Saldo Awal\s+Total Pemasukan\s+Total Pengeluaran\s+Saldo Akhir/i.test(line)) {
      const vals = lines[i + 1] ?? '';
      const nums = [...vals.matchAll(/[+-]?[\d,]+/g)].map(m => parseIntAmt(m[0]));
      if (nums.length >= 4) {
        if (openingBalance === undefined) openingBalance = nums[0];
        if (totalInflow === undefined)    totalInflow    = nums[1];
        if (totalOutflow === undefined)   totalOutflow   = nums[2];
        closingBalance = nums[3]; // keep overwriting → last month wins
      }
      continue;
    }

    // Inline "Saldo Akhir   159,713" — appears at end of each month section
    const akhirM = line.match(/^\s+Saldo Akhir\s+([\d,]+)\s*$/i);
    if (akhirM) { closingBalance = parseIntAmt(akhirM[1]); continue; }

    // Inline "Saldo Awal   349,324" — appears at start; take the first occurrence only
    if (openingBalance === undefined) {
      const awalM = line.match(/^\s+Saldo Awal\s+([\d,]+)\s*$/i);
      if (awalM) openingBalance = parseIntAmt(awalM[1]);
    }
  }

  if (closingBalance !== undefined) {
    return { openingBalance, totalInflow, totalOutflow, closingBalance };
  }

  return {};
}

export function parseJago(filePath: string, ownAccounts: string[]): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });

  const txs: ParsedTx[] = [];
  const lines = raw.split('\n');

  // Group lines into blocks: each block starts with a date line plus any continuation lines.
  // This handles cases where the amount is on a continuation line (long Catatan overflows).
  interface Block { dateLine: string; date: string; allLines: string[] }
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const DATE_RE = /^(\d{2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s+(\d{4})\s/;

  for (const line of lines) {
    const dm = line.match(DATE_RE);
    if (dm) {
      if (cur) blocks.push(cur);
      const day = dm[1].padStart(2, '0');
      const month = JAGO_MONTHS[dm[2]];
      const year = parseInt(dm[3]);
      const date = `${year}-${String(month).padStart(2, '0')}-${day}`;
      cur = { dateLine: line, date, allLines: [line] };
    } else if (cur) {
      cur.allLines.push(line);
    }
  }
  if (cur) blocks.push(cur);

  for (const block of blocks) {
    const { dateLine, date, allLines } = block;

    // Find signed amount+balance in the date line first; if not found, scan continuation lines
    const AMOUNT_RE = /([+-][\d.]+(?:,\d{2})?)\s+[\d.]+(?:,\d{2})?\s*$/;
    let amountMatch = dateLine.match(AMOUNT_RE);
    let amountLine = dateLine;
    if (!amountMatch) {
      for (const cl of allLines.slice(1)) {
        const m = cl.match(AMOUNT_RE);
        if (m) { amountMatch = m; amountLine = cl; break; }
      }
    }
    if (!amountMatch) continue;

    const rawAmount = amountMatch[1];
    const amount = parseJagoAmount(rawAmount);
    const type: 'income' | 'expense' = rawAmount.startsWith('+') ? 'income' : 'expense';

    const source = extractSource(dateLine);
    const fullText = allLines.join(' ');
    const isTransfer = isOwnAccount(fullText, ownAccounts);

    // Description: prefer the Rincian Transaksi portion
    const descMatch = dateLine.match(/(?:Transfer\s+(?:Masuk|Keluar)|Pembayaran\s+(?:QRIS|dengan\s+Jago\s+Pay)|Isi\s+Saldo|Transaksi\s+POS|Biaya\s+(?:Transfer|dari\s+Kekurangan))/i);
    const description = descMatch
      ? `${descMatch[0]}${source ? ` — ${source}` : ''}`.slice(0, 100)
      : source || 'Jago Transaction';

    if (amount > 0) {
      txs.push({ date, type, amount, description, isTransfer, raw: dateLine.trim() });
    }
  }

  return numberDuplicateDescriptions(txs);
}
