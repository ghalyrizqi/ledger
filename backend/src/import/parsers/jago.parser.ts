import { execSync } from 'child_process';
import { ParsedTx } from '../import.service';

// Indonesian month abbreviations used in Jago exports
const JAGO_MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, Mei: 5, Jun: 6,
  Jul: 7, Agu: 8, Sep: 9, Okt: 10, Nov: 11, Des: 12,
};

function parseJagoAmount(raw: string): number {
  // Indonesian format: "15.825.875,00" → 15825875.00
  // Remove the sign prefix, convert separators
  const clean = raw.replace(/[+-]/, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function isOwnAccount(text: string, ownAccounts: string[]): boolean {
  return ownAccounts.some(acc => text.includes(acc));
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

export function extractJagoMeta(filePath: string): { closingBalance?: number } {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/Saldo terbaru/i.test(lines[i])) {
      for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
        const m = lines[j].match(/IDR\s+([\d.]+(?:,\d{1,2})?)/);
        if (m) return { closingBalance: parseJagoAmount(m[1]) };
      }
    }
  }
  return {};
}

export function parseJago(filePath: string, ownAccounts: string[]): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });

  const txs: ParsedTx[] = [];
  const lines = raw.split('\n');

  for (const line of lines) {
    // Transaction line starts with DD Mon YYYY and contains an amount with +/- sign
    const dateMatch = line.match(/^(\d{2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s+(\d{4})\s/);
    if (!dateMatch) continue;

    // Extract signed amount
    const amountMatch = line.match(/([+-][\d.]+(?:,\d{2})?)\s+[\d.]+(?:,\d{2})?\s*$/);
    if (!amountMatch) continue;

    const day = dateMatch[1].padStart(2, '0');
    const month = JAGO_MONTHS[dateMatch[2]];
    const year = parseInt(dateMatch[3]);
    const date = `${year}-${String(month).padStart(2, '0')}-${day}`;

    const rawAmount = amountMatch[1];
    const amount = parseJagoAmount(rawAmount);
    const type: 'income' | 'expense' = rawAmount.startsWith('+') ? 'income' : 'expense';

    const source = extractSource(line);
    const isTransfer = isOwnAccount(line, ownAccounts);

    // Description: prefer the Rincian Transaksi portion (Transfer Masuk/Keluar, Pembayaran QRIS, etc.)
    const descMatch = line.match(/(?:Transfer\s+(?:Masuk|Keluar)|Pembayaran\s+(?:QRIS|dengan\s+Jago\s+Pay)|Isi\s+Saldo|Transaksi\s+POS)/i);
    const description = descMatch
      ? `${descMatch[0]}${source ? ` — ${source}` : ''}`.slice(0, 100)
      : source || 'Jago Transaction';

    if (amount > 0) {
      txs.push({ date, type, amount, description, isTransfer, raw: line.trim() });
    }
  }

  return txs;
}
