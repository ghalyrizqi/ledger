import { execSync } from 'child_process';
import { createWorker } from 'tesseract.js';
import { ParsedTx } from '../import.service';

const MONTH_EN: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// Parses Stockbit Portfolio → HISTORY tab screenshots.
// Row format: ACTION   AMOUNT   PRICE   DATE
// Actions: DEPOSIT, WITHDRAW, BUY TICKER, SELL TICKER, DIVIDEND TICKER
export async function parseStockbitRDN(buffer: Buffer, _ownAccounts: string[]): Promise<ParsedTx[]> {
  const worker = await createWorker('eng');
  let text: string;
  try {
    const { data } = await worker.recognize(buffer);
    text = data.text;
  } finally {
    await worker.terminate();
  }

  const txs: ParsedTx[] = [];

  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;

    // Each data row: ACTION [TICKER] AMOUNT [PRICE|-] DD Mon YYYY
    // Match the date at the end first to anchor the row
    const dateMatch = t.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (!dateMatch) continue;

    const mm = MONTH_EN[dateMatch[2].toLowerCase()];
    if (!mm) continue;
    const date = `${dateMatch[3]}-${mm}-${dateMatch[1].padStart(2, '0')}`;

    // Text before the date
    const before = t.slice(0, t.indexOf(dateMatch[0])).trim();

    // Extract the amount — last large number before the date (skip price which is smaller)
    // Amounts are like 1,000,000 or 20,000; price like 7,025 or 4,990
    const nums = [...before.matchAll(/([\d]{1,3}(?:,[\d]{3})+|[\d]{4,})/g)].map(m => parseFloat(m[1].replace(/,/g, '')));
    if (nums.length === 0) continue;
    // Amount is the largest number (price is smaller per-share price)
    const amount = Math.max(...nums);
    if (amount <= 0) continue;

    // Action: first word(s) before any digits
    const actionPart = before.replace(/([\d,]+|-)\s*$/, '').trim();
    const actionMatch = actionPart.match(/^(DEPOSIT|WITHDRAW|BUY|SELL|DIVIDEND)\s*([A-Z]{2,5})?/i);
    if (!actionMatch) continue;

    const action = actionMatch[1].toUpperCase();
    const ticker = actionMatch[2]?.toUpperCase() ?? '';

    let type: 'income' | 'expense';
    let isTransfer: boolean;
    let description: string;

    switch (action) {
      case 'DEPOSIT':
        type = 'income'; isTransfer = true;
        description = 'Stockbit — Deposit';
        break;
      case 'WITHDRAW':
        type = 'expense'; isTransfer = true;
        description = 'Stockbit — Withdraw';
        break;
      case 'BUY':
        type = 'expense'; isTransfer = true;
        description = ticker ? `Stockbit — Buy ${ticker}` : 'Stockbit — Buy';
        break;
      case 'SELL':
        type = 'income'; isTransfer = true;
        description = ticker ? `Stockbit — Sell ${ticker}` : 'Stockbit — Sell';
        break;
      case 'DIVIDEND':
        type = 'income'; isTransfer = false;
        description = ticker ? `Stockbit — Dividend ${ticker}` : 'Stockbit — Dividend';
        break;
      default:
        continue;
    }

    txs.push({ date, type, amount, description, isTransfer, raw: t });
  }

  return txs;
}

function parseAmt(raw: string): number {
  if (!raw || raw.trim() === '0' || raw.trim() === '') return 0;
  // Handle parentheses for negative: (281,000) → -281000
  const s = raw.trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    return -parseFloat(s.slice(1, -1).replace(/,/g, ''));
  }
  return parseFloat(s.replace(/,/g, '')) || 0;
}

function parseEnglishAmt(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

export function extractStockbitMeta(filePath: string): { closingBalance?: number; gainAmt?: number; gainPct?: number } {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });
  if (!/Statement of Account/i.test(raw)) return {};

  const cashMatch = raw.match(/Cash Investor\s+([\d,]+(?:\.\d{1,2})?)/);
  const cashInvestor = cashMatch ? parseEnglishAmt(cashMatch[1]) : 0;

  // Portfolio market value — exclude "Portfolio Caping" line
  const portfolioMatch = raw.match(/Portfolio(?! Caping)\s+([\d,]+)/);
  const portfolio = portfolioMatch ? parseEnglishAmt(portfolioMatch[1]) : 0;

  const closingBalance = cashInvestor + portfolio;

  const portfolioStart = raw.indexOf('PORTFOLIO STATEMENT');
  if (portfolioStart < 0) return { closingBalance };

  // TOTAL row: buying value, market value, gain/loss
  const totalMatch = raw.slice(portfolioStart).match(/\bTOTAL\b\s+([\d,]+)\s+([\d,]+)\s+(-?[\d,]+)/);
  if (!totalMatch) return { closingBalance };

  const buyingValue = parseEnglishAmt(totalMatch[1]);
  const gainAmt = parseEnglishAmt(totalMatch[3]);
  const gainPct = buyingValue > 0 ? (gainAmt / buyingValue) * 100 : 0;

  return { closingBalance, gainAmt, gainPct };
}

export function parseStockbit(filePath: string, ownAccounts: string[]): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });
  const lines = raw.split('\n');

  // Find the column header line to determine where amounts start
  const headerLine = lines.find(l => /Db Amount/i.test(l) && /Cr Amount/i.test(l));
  const dbAmtCol = headerLine ? headerLine.indexOf('Db Amount') : 88;

  const txs: ParsedTx[] = [];

  for (const line of lines) {
    // Transaction lines start with DD/MM/YYYY
    const dateMatch = line.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s/);
    if (!dateMatch) continue;

    const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

    // Skip non-transaction rows
    if (/Beginning Balance|Estimated Interest|TOTAL|Z\s+Z/i.test(line)) continue;

    // Extract reference code — single letter after the second date
    const refMatch = line.match(/\d{2}\/\d{2}\/\d{4}\s{2,}([A-Z])\s/);
    if (!refMatch) continue;
    const ref = refMatch[1];

    // Skip stock trade invoices — not personal cash flow
    if (ref === 'I') continue;

    // Extract amounts from the amount zone (right of column header position)
    const amtZone = line.length > dbAmtCol ? line.slice(dbAmtCol) : '';
    const amtTokens = [...amtZone.matchAll(/\([\d,]+(?:\.\d+)?\)|[\d,]+(?:\.\d+)?/g)].map(m => parseAmt(m[0]));
    const dbAmt = amtTokens[0] ?? 0;
    const crAmt = amtTokens[1] ?? 0;

    // Extract description from between the ref and the amount zone
    const descStart = line.indexOf(ref, 20) + ref.length;
    const descEnd = dbAmtCol;
    const description = line.slice(descStart, descEnd).replace(/\s{2,}/g, ' ').trim()
      .replace(/^\d{6}\s+/, '').trim().slice(0, 100);

    // D = Dividend received → income
    if (ref === 'D' && crAmt > 0) {
      txs.push({
        date,
        type: 'income',
        amount: crAmt,
        description: description || 'Dividend',
        isTransfer: false,
        raw: line.trim(),
      });
      continue;
    }

    // R = Receipt (deposit from user's bank to Stockbit) → internal transfer
    if (ref === 'R' && crAmt > 0) {
      txs.push({
        date,
        type: 'income',
        amount: crAmt,
        description: description || 'Deposit to Stockbit',
        isTransfer: true,
        raw: line.trim(),
      });
      continue;
    }

    // P = Payment (dividend payout to linked bank, or withdrawal) → internal transfer
    if (ref === 'P' && dbAmt > 0) {
      txs.push({
        date,
        type: 'expense',
        amount: dbAmt,
        description: description || 'Payout from Stockbit',
        isTransfer: true,
        raw: line.trim(),
      });
      continue;
    }

    // M = Memorial / adjustment
    if (ref === 'M') {
      const amount = crAmt > 0 ? crAmt : dbAmt;
      const type = crAmt > 0 ? 'income' : 'expense';
      if (amount > 0) {
        txs.push({
          date,
          type,
          amount,
          description: description || 'Adjustment',
          isTransfer: false,
          raw: line.trim(),
        });
      }
    }
  }

  return txs;
}
