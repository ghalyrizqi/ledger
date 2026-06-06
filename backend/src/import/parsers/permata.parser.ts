import { execSync } from 'child_process';
import { ParsedTx } from '../import.service';

const MONTH_MAP: Record<string, number> = {
  // Indonesian
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  // English
  january: 1, february: 2, march: 3, may: 5, june: 6,
  july: 7, august: 8, october: 10, december: 12,
};

const MONTH_NAMES = Object.keys(MONTH_MAP).join('|');

const EXPENSE_KEYWORDS = [
  'TRF BIFAST KE', 'QR PAYMENT', 'Biaya Adm', 'Biaya adm',
  'TOPUP', 'PEMBAYARAN', 'Pembelian', 'Transfer Keluar', 'DEBIT', 'TBK Permata',
];
const INCOME_KEYWORDS = [
  'PB DARI KREDITUR', 'PB Bagi Hasil', 'Bagi Hasil', 'KREDITUR',
  'Transfer Masuk', 'KREDIT', 'PAYROLL', 'Gaji',
];

function parsePermataAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, '')) || 0;
}

function inferType(text: string): 'income' | 'expense' {
  const upper = text.toUpperCase();
  for (const kw of EXPENSE_KEYWORDS) {
    if (upper.includes(kw.toUpperCase())) return 'expense';
  }
  for (const kw of INCOME_KEYWORDS) {
    if (upper.includes(kw.toUpperCase())) return 'income';
  }
  return 'expense';
}

export function parsePermata(filePath: string, ownAccounts: string[]): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });

  const txs: ParsedTx[] = [];
  const lines = raw.split('\n');

  let currentDate = '';
  let descBuffer: string[] = [];
  let afterAmount = false; // true while we're on reference/continuation lines after an amount

  const flush = (amount: number, rawLine: string) => {
    if (!currentDate || amount <= 0) return;
    const fullText = [...descBuffer, rawLine].join(' ');
    const type = inferType(fullText);
    const isTransfer = ownAccounts.some(acc => fullText.toLowerCase().includes(acc.toLowerCase()));
    const description = descBuffer.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 100)
      || 'Permata Transaction';
    txs.push({ date: currentDate, type, amount, description, isTransfer, raw: fullText.slice(0, 120) });
    descBuffer = [];
    afterAmount = true;
  };

  const DATE_RE = new RegExp(`^\\s*(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})\\s*$`, 'i');

  for (const line of lines) {
    // Date header line: "30 April 2026" or "31 January 2026"
    const dateMatch = line.match(DATE_RE);
    if (dateMatch) {
      descBuffer = [];
      afterAmount = false;
      const d = dateMatch[1].padStart(2, '0');
      const m = MONTH_MAP[dateMatch[2].toLowerCase()];
      const y = parseInt(dateMatch[3]);
      currentDate = `${y}-${String(m).padStart(2, '0')}-${d}`;
      continue;
    }

    if (!currentDate) continue;

    const trimmed = line.trim();

    // Blank line → reference section ended, next desc starts fresh
    if (!trimmed) {
      afterAmount = false;
      continue;
    }

    // Skip footers
    if (/PermataBank|Otoritas Jasa|Halaman\/Page|PT Bank Permata/i.test(trimmed)) continue;

    // Amount line: "Rp X,XXX.XX"
    const amtMatch = trimmed.match(/Rp\s*([\d,]+\.\d{2})/);
    if (amtMatch) {
      const amount = parsePermataAmount(amtMatch[1]);
      // Capture any desc text on the same line before "Rp"
      const beforeRp = trimmed.replace(/Rp.*/, '').trim();
      if (beforeRp) descBuffer.push(beforeRp);
      flush(amount, trimmed);
      continue;
    }

    // After an amount, lines until the next blank are reference/ID lines — skip them
    if (afterAmount) continue;

    // Accumulate description text
    descBuffer.push(trimmed);
  }

  return txs;
}
