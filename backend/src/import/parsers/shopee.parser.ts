import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
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
const INCOME_TITLE_RE = /^(transfer diterima|isi saldo|cashback|refund|pengembalian|transfer masuk|dana dikembalikan)/i;

// Failed/cancelled transactions — never actually debited, skip entirely
const SKIP_RE = /gagal/i;

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
  return parseInt(s.replace(/\./g, '').replace(/,/g, ''), 10) || 0;
}

// Enhance screenshot for better OCR accuracy
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .grayscale()
    .normalise()
    .sharpen()
    .png()
    .toBuffer();
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

// Remove stray OCR artifact tokens that appear between "— " and the real text
// e.g. "— ) Dari INTAN" → "— Dari INTAN", "— nH Dari" → "— Dari"
function cleanDescription(s: string): string {
  return s.replace(/—\s*[^a-zA-Z\d]{1,4}\s+(?=\S)/, '— ').trim();
}

export async function parseShopee(buffer: Buffer, ownAccounts: string[]): Promise<ParsedTx[]> {
  const processed = await preprocessImage(buffer);
  const rawText = await ocrImage(processed);
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const txs: ParsedTx[] = [];

  // ShopeePay screenshots show date section headers (e.g. "5 Juli 2026") above transactions.
  // Track the most recently seen date header so transactions inherit it.
  let currentSectionDate: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // "Hari ini" → today
    if (/^hari\s+ini$/i.test(line)) {
      currentSectionDate = new Date().toISOString().slice(0, 10);
      continue;
    }

    // Standalone date header (e.g. "5 Juli 2026") — short line, no amount
    const sectionDate = parseDate(line);
    if (sectionDate && line.replace(/\s/g, '').length <= 20) {
      currentSectionDate = sectionDate;
      continue;
    }

    // Transaction line pattern: "[Title words] +/-Rp XX.XXX"
    const txMatch = line.match(/^(.+?)\s+([+\-])\s*Rp\s*([\d.,]+)\s*$/i);
    if (!txMatch) continue;

    const titleRaw = txMatch[1].trim();
    const sign = txMatch[2];
    const amount = parseShopeeAmount(txMatch[3]);
    if (amount === 0) continue;

    if (UI_RE.test(titleRaw)) continue;
    if (SKIP_RE.test(line)) continue;

    // Determine type: title keywords take priority over sign
    let type: 'income' | 'expense';
    if (EXPENSE_TITLE_RE.test(titleRaw)) type = 'expense';
    else if (INCOME_TITLE_RE.test(titleRaw)) type = 'income';
    else type = sign === '+' ? 'income' : 'expense';

    // Look ahead for description and inline date (next 1-3 non-empty lines)
    const nextLines: string[] = [];
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      if (lines[j].trim()) nextLines.push(lines[j].trim());
    }

    // Find date: prefer inline date in next lines, fall back to section header
    let date = currentSectionDate ?? new Date().toISOString().slice(0, 10);
    for (const nl of nextLines) {
      const d = parseDate(nl);
      if (d) { date = d; break; }
    }

    // Description = title + first non-date non-UI next line, cleaned of OCR artifacts
    const subDesc = nextLines.find(nl => !parseDate(nl) && nl.length >= 3 && !UI_RE.test(nl));
    const raw = subDesc ? `${titleRaw} — ${subDesc}` : titleRaw;
    const description = cleanDescription(raw).slice(0, 120);

    // Transfer if title implies it, or own account appears in context
    const fullCtx = `${titleRaw} ${subDesc ?? ''}`;
    const isTransfer = TRANSFER_TITLE_RE.test(titleRaw) ||
      ownAccounts.some(acc => fullCtx.toLowerCase().includes(acc.toLowerCase()));

    txs.push({ date, type, amount, description, isTransfer, raw: line });
  }

  return txs;
}
