// Parse a free-text Indonesian rupiah amount into an integer number of rupiah.
// Handles: "50000", "50.000", "50rb", "50k", "1,5jt", "2 juta", "Rp 12.500".
export function parseRupiah(raw: string): number | null {
  const s = raw.toLowerCase().replace(/rp\.?/g, '').trim();
  const m = s.match(/([\d.,]+)\s*(jt|juta|rb|ribu|k)?/);
  if (!m) return null;

  let num = m[1];
  const unit = m[2];

  // Decide whether '.'/',' are thousand separators or a decimal point.
  // With a unit (jt/rb/k) a single separator is decimal (1,5jt = 1.5m);
  // without a unit, separators are thousands (50.000 = 50000).
  if (unit) {
    num = num.replace(/\./g, '').replace(',', '.');
  } else {
    num = num.replace(/[.,]/g, '');
  }

  let value = parseFloat(num);
  if (isNaN(value)) return null;

  if (unit === 'jt' || unit === 'juta') value *= 1_000_000;
  else if (unit === 'rb' || unit === 'ribu' || unit === 'k') value *= 1_000;

  return Math.round(value);
}

// Format an integer rupiah amount as "Rp 12.500".
export function formatRupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
