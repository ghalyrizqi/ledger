import { ParsedTx } from '../import/import.service';

// A forgiving, layout-agnostic parser for text pulled from PDFs / OCR that the
// tuned screenshot parser can't handle. Best-effort: finds a date + amount(s)
// per line and treats the rest as the description. Users confirm every row in
// Telegram before it's saved, so occasional misreads are low-risk.

const MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', agu: '08', september: '09', sept: '09', oktober: '10',
  okt: '10', november: '11', nov: '11', desember: '12', des: '12', jan: '01',
  feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', sep: '09',
};

function extractDate(s: string): string | null {
  let m = s.match(/(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}

// Returns signed rupiah amounts found in the line (Rp 50.000 / -50.000 / 1.500.000,00).
function amountsIn(s: string): number[] {
  const out: number[] = [];
  const re = /(-)?\s*(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,})([.,]\d{2})?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const neg = !!m[1];
    const v = parseInt(m[2].replace(/[.,]/g, ''), 10);   // strip thousands seps
    if (v >= 100) out.push(neg ? -v : v);
  }
  return out;
}

const JUNK = /^(saldo|balance|total|sub\s*total|halaman|page|tanggal|keterangan|mutasi|debet|kredit|rekening|periode|no\b|nomor|--)/i;
const INCOME = /\b(kredit|cr|masuk|gaji|thr|bonus|refund|cashback|bunga|jasa\s*giro|setoran|setor|terima|deposit|pengembalian|dividen)\b/i;

export function looseParse(text: string): ParsedTx[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  let sectionDate: string | null = null;
  const rows: ParsedTx[] = [];

  for (const line of lines) {
    const d = extractDate(line);
    // Strip the date text FIRST so its year (e.g. 2026) isn't read as an amount.
    const noDate = line
      .replace(/(\d{1,2})\s+[A-Za-z]+\.?\s+\d{4}/, ' ')
      .replace(/\d{4}-\d{2}-\d{2}/, ' ')
      .replace(/\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/, ' ');

    const amts = amountsIn(noDate);
    if (!amts.length) { if (d) sectionDate = d; continue; }      // date-only header line
    if (JUNK.test(line) && !d) continue;                          // running totals etc.

    const amt = amts[0];                                          // tx amount (balance, if any, comes later)
    const type: 'income' | 'expense' = amt < 0 ? 'expense' : (INCOME.test(line) ? 'income' : 'expense');
    let desc = noDate
      .replace(/(-)?\s*(?:rp\.?\s*)?\d[\d.,]*/gi, '')
      .replace(/\b(db|cr|debet|kredit)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!desc) desc = 'Transaksi';

    rows.push({
      date: d || sectionDate || today,
      type,
      amount: Math.abs(amt),
      description: desc.slice(0, 80),
      isTransfer: false,
      raw: line,
    });
  }
  return rows;
}
