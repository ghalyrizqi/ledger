import { createWorker } from 'tesseract.js';
import { ParsedTx } from '../import.service';

const MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', agu: '08', september: '09', sept: '09',
  oktober: '10', okt: '10', november: '11', nov: '11', desember: '12', des: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', sep: '09',
  // English month names (BCA mobile uses "May", "April", etc.)
  january: '01', february: '02', march: '03', may: '05', june: '06',
  july: '07', august: '08', october: '10', november: '11', december: '12',
};

function parseDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

function parseAmount(s: string): number {
  // Handles: "10,000.00", "83.500", "83,500", "10.000,00"
  const digits = s.replace(/[^0-9.,]/g, '');
  // Indonesian format: dots as thousands, comma as decimal → "83.500" = 83500
  // English format: commas as thousands, dot as decimal → "10,000.00" = 10000
  // Detect by last separator
  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  if (lastComma > lastDot) {
    // Comma is decimal separator (Indonesian) → remove dots, replace comma
    return parseInt(digits.replace(/\./g, '').replace(',', '.'), 10) || 0;
  }
  // Dot is decimal separator (English) → remove commas
  return parseInt(digits.replace(/,/g, ''), 10) || 0;
}

async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker('eng', 1, { logger: () => {} });
  try {
    const { data: { text } } = await worker.recognize(buffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

function parseText(text: string, bankName: string, ownAccounts: string[]): ParsedTx[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const txs: ParsedTx[] = [];

  const UI_RE = /^(Semua|Riwayat Transaksi|Riwayat|Metode Pembayaran|Isi Saldo|Kirin|Tanggal|Beranda|Keuangan|QRIS|Saya|Statement Summary|Account Transactions|Account Information|Card|Pocket|Search)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Pattern A: signed Rp amount (Shopee / Dana) ──────────────────────────
    const rpMatch = line.match(/([+\-])\s*Rp\s*([\d.,]+)/i);
    if (rpMatch) {
      const amount = parseAmount(rpMatch[2]);
      if (amount === 0) continue;
      const type: 'income' | 'expense' = rpMatch[1] === '+' ? 'income' : 'expense';
      const ctx = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4));
      txs.push(buildTx(ctx, type, amount, bankName, ownAccounts, UI_RE));
      continue;
    }

    // ── Pattern B: IDR amount (BCA mobile app) ────────────────────────────────
    // "IDR 10,000.00" — sign comes from TRANSAKSI DEBIT / KREDIT in context
    const idrMatch = line.match(/IDR\s+([\d,]+(?:\.\d{1,2})?)/i);
    if (idrMatch) {
      const amount = parseAmount(idrMatch[1]);
      if (amount === 0) continue;
      const ctx = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 4));
      const ctxText = ctx.join(' ');
      // DEBIT = money out = expense; KREDIT = money in = income
      const type: 'income' | 'expense' = /kredit/i.test(ctxText) ? 'income' : 'expense';
      txs.push(buildTx(ctx, type, amount, bankName, ownAccounts, UI_RE));
      continue;
    }
  }

  return txs;
}

function buildTx(
  ctx: string[],
  type: 'income' | 'expense',
  amount: number,
  bankName: string,
  ownAccounts: string[],
  UI_RE: RegExp,
): ParsedTx {
  const ctxText = ctx.join(' ');

  // First date found in context
  let date = new Date().toISOString().slice(0, 10);
  for (const cl of ctx) {
    const d = parseDateFromLine(cl);
    if (d) { date = d; break; }
  }

  // Description: non-amount, non-date, non-chrome lines
  const descLines = ctx.filter(cl =>
    !(/(?:Rp|IDR)[\s\d.,]+/i.test(cl)) &&
    !(/\d{1,2}\s+[a-zA-Z]+\s+\d{4}/.test(cl)) &&
    !UI_RE.test(cl) &&
    !/TRANSAKSI\s+(DEBIT|KREDIT)/i.test(cl) &&
    cl.length >= 3
  );
  const description = descLines.slice(0, 2).join(' — ').trim() || `${bankName} Transaction`;

  const isTransfer = /transfer|diterima|keluar/i.test(ctxText) ||
    ownAccounts.some(acc => ctxText.toLowerCase().includes(acc.toLowerCase()));

  return {
    date,
    type,
    amount,
    description: description.slice(0, 120),
    isTransfer,
    raw: ctx.join(' | '),
  };
}

function parseDateFromLine(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function parseVision(
  buffer: Buffer,
  mimeType: string,
  bankName: string,
  ownAccounts: string[],
): Promise<ParsedTx[]> {
  if (!SUPPORTED_MIME.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Upload a PNG or JPG screenshot.`);
  }
  const text = await ocrImage(buffer);
  return parseText(text, bankName, ownAccounts);
}
