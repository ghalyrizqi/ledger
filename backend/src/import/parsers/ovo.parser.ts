import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { ParsedTx } from '../import.service';

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
  jul: '07', agu: '08', sep: '09', okt: '10', nov: '11', des: '12',
  januari: '01', februari: '02', maret: '03', april: '04', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
  may: '05',
};

function parseDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTH_MAP[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

function parseAmount(s: string): number {
  return parseInt(s.replace(/\./g, '').replace(/,/g, ''), 10) || 0;
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

// Lines that are OVO app UI chrome — not transactions
const UI_RE = /^(history|<|riwayat|semua|kembali|saldo|ovo\s*cash|ovo\s*points\s*balance|\d{1,2}:\d{2}|transfer|tarik|topup|bayar|notifikasi|akun|profil|\d+\.\d+\.\d+)/i;

function isChrome(line: string): boolean {
  return UI_RE.test(line) || parseDate(line) !== null || line.length < 2;
}

function pushTx(
  txs: ParsedTx[],
  sign: string,
  amount: number,
  title: string,
  subtitle: string,
  date: string,
  ownAccounts: string[],
  raw: string,
) {
  const isTopUp = /^top\s*up$/i.test(subtitle.trim());
  const isBiayaTopUp = /biaya\s+top\s*up/i.test(subtitle);
  const titleIsOVO = /^ovo$/i.test(title.trim());

  const isTransfer = (isTopUp && !titleIsOVO && title.length > 0) ||
    (!isBiayaTopUp && ownAccounts.some(acc =>
      `${title} ${subtitle}`.toLowerCase().includes(acc.toLowerCase()),
    ));

  const type: 'income' | 'expense' = sign === '+' ? 'income' : 'expense';
  const description = title
    ? `${title} — ${subtitle || 'OVO'}`.trim()
    : (subtitle || 'OVO Transaction');

  txs.push({
    date,
    type,
    amount,
    description: description.slice(0, 120),
    isTransfer,
    raw,
  });
}

export async function parseOVO(buffer: Buffer, ownAccounts: string[]): Promise<ParsedTx[]> {
  const processed = await preprocessImage(buffer);
  const rawText = await ocrImage(processed);
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const txs: ParsedTx[] = [];

  // Pre-scan: find the first date header in the image so we never fall back to today
  let currentDate: string =
    lines.map(l => parseDate(l)).find((d): d is string => d !== null)
    ?? new Date().toISOString().slice(0, 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Update current date from section headers
    const d = parseDate(line);
    if (d) { currentDate = d; continue; }

    // Skip OVO Points (loyalty points — not real money)
    if (/[+\-]\s*OVO\s*Points/i.test(line)) continue;

    // Pattern A: subtitle and amount on same line — "Pembayaran -Rp18.500"
    const inlineMatch = line.match(/^(.+?)\s+([+\-])\s*Rp\s*([\d.]+)\s*$/i);
    if (inlineMatch) {
      const subtitle = inlineMatch[1].trim();
      const sign = inlineMatch[2];
      const amount = parseAmount(inlineMatch[3]);
      if (!amount) continue;

      const prev = i > 0 ? lines[i - 1] : '';
      const title = !isChrome(prev) ? prev : '';

      pushTx(txs, sign, amount, title, subtitle, currentDate, ownAccounts, line);
      continue;
    }

    // Pattern B: standalone amount line — "+Rp50.000"
    const standaloneMatch = line.match(/^([+\-])\s*Rp\s*([\d.]+)\s*$/i);
    if (standaloneMatch) {
      const sign = standaloneMatch[1];
      const amount = parseAmount(standaloneMatch[2]);
      if (!amount) continue;

      const prev1 = i > 0 ? lines[i - 1] : '';
      const prev2 = i > 1 ? lines[i - 2] : '';

      const subtitle = !isChrome(prev1) ? prev1 : '';
      const title = !isChrome(prev2) && prev2 !== subtitle ? prev2 : '';

      pushTx(txs, sign, amount, title, subtitle, currentDate, ownAccounts, line);
      continue;
    }
  }

  return txs;
}
