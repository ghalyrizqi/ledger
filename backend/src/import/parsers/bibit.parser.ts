import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { ParsedTx } from '../import.service';

// Indonesian + English month names
const MONTH_MAP: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseBibitDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mm = MONTH_MAP[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
}

function parseAmount(text: string): number {
  // Handles "Rp1,000,000" or "Rp1.000.000" or bare "1,000,000"
  const clean = text.replace(/rp/i, '').replace(/\./g, ',').replace(/,/g, '');
  return parseFloat(clean) || 0;
}

// Sample pixel at (x, y) in the image buffer and return {r, g, b}
async function samplePixel(buffer: Buffer, x: number, y: number): Promise<{ r: number; g: number; b: number }> {
  try {
    const { data } = await sharp(buffer)
      .extract({ left: Math.max(0, x - 3), top: Math.max(0, y - 3), width: 7, height: 7 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Average over sampled pixels (3 channels: R, G, B)
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i + 2 < data.length; i += 3) {
      r += data[i]; g += data[i + 1]; b += data[i + 2];
      count++;
    }
    if (!count) return { r: 128, g: 128, b: 128 };
    return { r: r / count, g: g / count, b: b / count };
  } catch {
    return { r: 128, g: 128, b: 128 };
  }
}

export async function parseBibit(buffer: Buffer, _ownAccounts: string[]): Promise<ParsedTx[]> {
  const worker = await createWorker('ind+eng');
  let ocrData: Awaited<ReturnType<typeof worker.recognize>>['data'];
  try {
    const result = await worker.recognize(buffer);
    ocrData = result.data;
  } finally {
    await worker.terminate();
  }

  const fullText = ocrData.text;
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  // Detect which tab: Reksa Dana vs Saham
  const hasReksaDana = /pembelian|pencairan|order\s*jual|pembayaran\s*berhasil/i.test(fullText);
  const hasSaham = /\bMatch\b|\bPenerimaan\s*Dividen\b/i.test(fullText);

  const txs: ParsedTx[] = [];

  if (hasReksaDana) {
    // --- Reksa Dana tab ---
    // Pattern: fund name line → status line → date line
    // Amount appears on the fund name line (right-aligned)
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Find status keywords
      const isPembelian = /pembelian\s*berhasil/i.test(line);
      const isPencairan = /pencairan\s*dana\s*berhasil/i.test(line);
      const isOrderJual = /order\s*jual\s*berhasil/i.test(line);
      const isPembayaran = /pembayaran\s*berhasil/i.test(line);
      const isExpired = /\bexpired\b/i.test(line);

      if (isPembelian || isPencairan || isOrderJual || isPembayaran || isExpired) {
        if (isExpired) { i++; continue; }

        // Fund name is the line BEFORE (or 2 before) the status line
        const fundName = i > 0 ? lines[i - 1] : '';

        // Amount: look backward from status line for an "Rp" amount
        let amount = 0;
        let amtLineIdx = -1;
        for (let k = i - 2; k <= i; k++) {
          if (k < 0) continue;
          const amtM = lines[k].match(/Rp[\s]?([\d.,]+)/i);
          if (amtM) { amount = parseAmount(amtM[1]); amtLineIdx = k; break; }
        }

        // If not found, look on fund name line itself
        if (!amount) {
          const amtM = lines[i > 0 ? i - 1 : 0]?.match(/([\d]{1,3}(?:[,.][\d]{3})+)/);
          if (amtM) amount = parseAmount(amtM[1]);
        }

        // Date: look forward from status line
        let date: string | null = null;
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          date = parseBibitDate(lines[j]);
          if (date) { i = j; break; }
        }

        if (amount > 0 && date) {
          // Pembayaran Berhasil = Bea Meterai (stamp duty) — real expense, not a transfer
          const isBiaya = isPembayaran;
          const type = (isPencairan || isOrderJual) ? 'income' : 'expense';
          const statusLabel = isPembelian ? 'Pembelian'
            : isPencairan ? 'Pencairan Dana'
            : isOrderJual ? 'Order Jual'
            : 'Bea Meterai';
          const description = isBiaya
            ? 'Bibit — Bea Meterai'
            : fundName ? `${fundName} — ${statusLabel}` : `Bibit — ${statusLabel}`;
          txs.push({
            date,
            type,
            amount,
            description,
            isTransfer: !isBiaya,
            raw: line,
          });
        }
      }
      i++;
    }
  } else if (hasSaham) {
    // --- Saham tab ---
    // Pattern: ticker line → status line → date line
    // Amount on ticker line (right-aligned); color = green(buy)/red(sell)

    // Build a map of word bounding boxes for color sampling
    const wordBoxes: Array<{ text: string; x: number; y: number; w: number; h: number }> = [];
    for (const word of ocrData.blocks?.flatMap(b => b.paragraphs?.flatMap(p => p.lines?.flatMap(l => l.words ?? []) ?? []) ?? []) ?? []) {
      wordBoxes.push({
        text: word.text,
        x: word.bbox.x0,
        y: word.bbox.y0,
        w: word.bbox.x1 - word.bbox.x0,
        h: word.bbox.y1 - word.bbox.y0,
      });
    }

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const isMatch = /\bMatch\b/i.test(line);
      const isDividen = /Penerimaan\s*Dividen/i.test(line);

      if (isMatch || isDividen) {
        // Ticker is the line before
        const ticker = i > 0 ? lines[i - 1].replace(/[^A-Z]/g, '') : '';

        // Amount: look backward for Rp amount
        let amount = 0;
        let amtWord: typeof wordBoxes[0] | null = null;
        for (let k = Math.max(0, i - 2); k <= i; k++) {
          const amtM = lines[k].match(/Rp[\s]?([\d.,]+)/i);
          if (amtM) {
            amount = parseAmount(amtM[1]);
            // Find the bounding box of this Rp word
            const amtText = `Rp${amtM[1]}`.replace(/\s/g, '');
            amtWord = wordBoxes.find(w =>
              w.text.replace(/\s/g, '').toLowerCase() === amtText.toLowerCase()
            ) ?? null;
            break;
          }
        }

        // Date: look forward
        let date: string | null = null;
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          date = parseBibitDate(lines[j]);
          if (date) { i = j; break; }
        }

        if (amount > 0 && date) {
          if (isDividen) {
            txs.push({
              date,
              type: 'income',
              amount,
              description: ticker ? `${ticker} — Dividen` : 'Bibit — Dividen',
              isTransfer: false,
              raw: line,
            });
          } else {
            // Determine buy vs sell from pixel color
            let isBuy = true; // default to buy if color detection fails
            if (amtWord) {
              const cx = amtWord.x + Math.floor(amtWord.w / 2);
              const cy = amtWord.y + Math.floor(amtWord.h / 2);
              const { r, g } = await samplePixel(buffer, cx, cy);
              isBuy = g >= r; // green-dominant = buy; red-dominant = sell
            }

            txs.push({
              date,
              type: isBuy ? 'expense' : 'income',
              amount,
              description: ticker ? `${ticker} — Saham ${isBuy ? 'Beli' : 'Jual'}` : 'Bibit — Saham',
              isTransfer: true,
              raw: line,
            });
          }
        }
      }
      i++;
    }
  }

  return txs;
}
