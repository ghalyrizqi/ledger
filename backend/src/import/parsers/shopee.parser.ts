import { createWorker } from 'tesseract.js';
import { ParsedTx } from '../import.service';

const MONTH_MAP: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07',
  agu: '08', sep: '09', okt: '10', nov: '11', des: '12',
};

// Titles that always mean inter-wallet transfer (top-up, send to own, receive from own)
const TRANSFER_TITLE_RE = /^(isi saldo|transfer keluar|kirim|kirim uang|transfer diterima|transfer masuk|tarik tunai)/i;

// Titles that are expenses regardless of sign
const EXPENSE_TITLE_RE = /^(pembayaran|transfer keluar|kirim|kirim uang|tarik tunai)/i;

// Titles that are income regardless of sign
const INCOME_TITLE_RE = /^(transfer diterima|isi saldo|cashback|refund|pengembalian|transfer masuk)/i;

// UI chrome lines to skip
const UI_RE = /^(semua|riwayat transaksi|riwayat|metode pembayaran|isi saldo|kirim|tanggal|beranda|keuangan|qris|saya|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s*(\d{4})?$/i;

function parseDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTH_MAP[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

function parseShopeeAmount(s: string): number {
  // Indonesian format: dots as thousands separators → "86.400" = 86400
  return parseInt(s.replace(/\./g, '').replace(/,/g, ''), 10) || 0;
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

export async function parseShopee(buffer: Buffer, ownAccounts: string[]): Promise<ParsedTx[]> {
  const rawText = await ocrImage(buffer);
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const txs: ParsedTx[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Transaction line pattern: "[Title words] +/-Rp XX.XXX"
    // The title and amount appear on the same visual line in ShopeePay screenshots
    const txMatch = line.match(/^(.+?)\s+([+\-])\s*Rp\s*([\d.,]+)\s*$/i);
    if (!txMatch) continue;

    const titleRaw = txMatch[1].trim();
    const sign = txMatch[2];
    const amount = parseShopeeAmount(txMatch[3]);
    if (amount === 0) continue;

    // Skip if the "title" looks like a UI chrome label
    if (UI_RE.test(titleRaw)) continue;

    // Determine type: sign is the fallback, but title keywords take priority
    let type: 'income' | 'expense';
    if (EXPENSE_TITLE_RE.test(titleRaw)) type = 'expense';
    else if (INCOME_TITLE_RE.test(titleRaw)) type = 'income';
    else type = sign === '+' ? 'income' : 'expense';

    // Look ahead for description and date (next 1-3 non-empty lines)
    const nextLines: string[] = [];
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      if (lines[j].trim()) nextLines.push(lines[j].trim());
    }

    // Find date among next lines
    let date = new Date().toISOString().slice(0, 10);
    for (const nl of nextLines) {
      const d = parseDate(nl);
      if (d) { date = d; break; }
    }

    // Description = title + first non-date non-UI next line
    const subDesc = nextLines.find(nl => !parseDate(nl) && nl.length >= 3 && !UI_RE.test(nl));
    const description = subDesc
      ? `${titleRaw} — ${subDesc}`.slice(0, 120)
      : titleRaw.slice(0, 120);

    // Transfer if title implies it, or if description mentions own account
    const fullCtx = `${titleRaw} ${subDesc ?? ''}`;
    const isTransfer = TRANSFER_TITLE_RE.test(titleRaw) ||
      ownAccounts.some(acc => fullCtx.toLowerCase().includes(acc.toLowerCase()));

    txs.push({ date, type, amount, description, isTransfer, raw: line });
  }

  return txs;
}
