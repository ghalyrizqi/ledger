import { execSync } from 'child_process';
import { ParsedTx } from '../import.service';

function parseAmt(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

export function isStockbitTC(filePath: string): boolean {
  try {
    const text = execSync(`pdftotext "${filePath}" -`, { encoding: 'utf8' });
    return /Trade Confirmation/i.test(text);
  } catch {
    return false;
  }
}

export function parseStockbitTC(filePath: string): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });

  if (!/Trade Confirmation/i.test(raw)) return [];

  const dateMatch = raw.match(/Transaction Date\s+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dateMatch) return [];
  const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

  const buyStocks: string[] = [];
  const sellStocks: string[] = [];

  for (const line of raw.split('\n')) {
    // REF# (7 digits) + Board (2 chars) + Stock code (4 uppercase letters)
    const tradeMatch = line.match(/^\s*\d{7}\s+\w{2}\s+([A-Z]{4})\s/);
    if (!tradeMatch) continue;
    const code = tradeMatch[1];

    // Last two decimal amounts on the line are Buy and Sell columns
    const amounts = [...line.matchAll(/([\d,]+\.\d{2})/g)].map(m => parseAmt(m[0]));
    if (amounts.length < 2) continue;
    const buyAmt = amounts[amounts.length - 2];
    const sellAmt = amounts[amounts.length - 1];

    if (buyAmt > 0 && !buyStocks.includes(code)) buyStocks.push(code);
    if (sellAmt > 0 && !sellStocks.includes(code)) sellStocks.push(code);
  }

  // "Payment due to us IDR X 0.00" → expense; "Payment due to you IDR 0.00 X" → income
  const paymentLine = raw.match(/Payment due to (us|you)\s+IDR\s+([\s\d,.]+)/i);
  if (!paymentLine) return [];

  const direction = paymentLine[1].toLowerCase();
  const nums = [...paymentLine[2].matchAll(/([\d,]+\.\d{2})/g)]
    .map(m => parseAmt(m[0]))
    .filter(n => n > 0);
  const amount = nums[0] ?? 0;
  if (amount === 0) return [];

  const type: 'income' | 'expense' = direction === 'you' ? 'income' : 'expense';

  const parts: string[] = [];
  if (buyStocks.length > 0) parts.push(`Buy ${buyStocks.join(', ')}`);
  if (sellStocks.length > 0) parts.push(`Sell ${sellStocks.join(', ')}`);
  const description = parts.join(' / ') || 'Stockbit Trade';

  return [{
    date,
    type,
    amount,
    description,
    isTransfer: false,
    raw: `TC ${date}: ${description}`,
  }];
}
