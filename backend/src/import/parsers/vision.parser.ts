import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { ParsedTx } from '../import.service';

const MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', agu: '08', september: '09', sept: '09',
  oktober: '10', okt: '10', november: '11', nov: '11', desember: '12', des: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', sep: '09',
  january: '01', february: '02', march: '03', may: '05', june: '06',
  july: '07', august: '08', october: '10', december: '12',
};

function parseDateFromLine(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

function parseAmount(s: string): number {
  const digits = s.replace(/[^0-9.,]/g, '');
  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  if (lastComma > lastDot) {
    return parseInt(digits.replace(/\./g, '').replace(',', '.'), 10) || 0;
  }
  return parseInt(digits.replace(/,/g, ''), 10) || 0;
}

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).grayscale().normalise().sharpen().png().toBuffer();
}

async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker('eng', 1, { logger: () => {} });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6' as any,
      preserve_interword_spaces: '0' as any,
    });
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

  // Pre-scan: find the first date in the image to use as initial section date
  let currentSectionDate: string | null =
    lines.map(l => parseDateFromLine(l)).find((d): d is string => d !== null) ?? null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track rolling section date header
    const sectionDate = parseDateFromLine(line);
    if (sectionDate && line.replace(/\s/g, '').length <= 20) {
      currentSectionDate = sectionDate;
      continue;
    }

    // ── Pattern A: signed Rp amount (Shopee / Dana) ──────────────────────────
    const rpMatch = line.match(/([+\-])\s*Rp\s*([\d.,]+)/i);
    if (rpMatch) {
      const amount = parseAmount(rpMatch[2]);
      if (amount === 0) continue;
      const type: 'income' | 'expense' = rpMatch[1] === '+' ? 'income' : 'expense';
      const ctx = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4));
      txs.push(buildTx(ctx, type, amount, bankName, ownAccounts, UI_RE, currentSectionDate));
      continue;
    }

    // ── Pattern B: IDR amount (BCA mobile app) ────────────────────────────────
    const idrMatch = line.match(/IDR\s+([\d,]+(?:\.\d{1,2})?)/i);
    if (idrMatch) {
      const amount = parseAmount(idrMatch[1]);
      if (amount === 0) continue;
      const ctx = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 4));
      const ctxText = ctx.join(' ');
      const type: 'income' | 'expense' = /kredit/i.test(ctxText) ? 'income' : 'expense';
      txs.push(buildTx(ctx, type, amount, bankName, ownAccounts, UI_RE, currentSectionDate));
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
  fallbackDate: string | null,
): ParsedTx {
  const ctxText = ctx.join(' ');

  // First date found in context; fall back to section date, then today as last resort
  let date = fallbackDate ?? new Date().toISOString().slice(0, 10);
  for (const cl of ctx) {
    const d = parseDateFromLine(cl);
    if (d) { date = d; break; }
  }

  const descLines = ctx.filter(cl =>
    !(/(?:Rp|IDR)[\s\d.,]+/i.test(cl)) &&
    !(/\d{1,2}\s+[a-zA-Z]+\s+\d{4}/.test(cl)) &&
    !UI_RE.test(cl) &&
    !/TRANSAKSI\s+(DEBIT|KREDIT)/i.test(cl) &&
    cl.length >= 3
  );
  const description = descLines.slice(0, 2).join(' — ').trim() || `${bankName} Transaction`;

  const isTransfer = /transfer|diterima|keluar|pencairan\s*reksa|reksa\s*dana/i.test(ctxText) ||
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
  const processed = await preprocessImage(buffer);
  const text = await ocrImage(processed);
  return parseText(text, bankName, ownAccounts);
}
