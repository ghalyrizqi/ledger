import { execSync } from 'child_process';
import { ParsedTx } from '../import.service';

const MONTH_MAP: Record<string, number> = {
  JANUARI: 1, FEBRUARI: 2, MARET: 3, APRIL: 4, MEI: 5, JUNI: 6,
  JULI: 7, AGUSTUS: 8, SEPTEMBER: 9, OKTOBER: 10, NOVEMBER: 11, DESEMBER: 12,
};

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

function isOwnAccount(line: string, ownAccounts: string[]): boolean {
  return ownAccounts.some(acc => line.includes(acc));
}

export function parseBCA(filePath: string, ownAccounts: string[]): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });

  // BCA headers have spaced characters (e.g. "P E R I O D E  :  M A R E T  2 0 2 6").
  // Extract month/year by removing all spaces from the PERIODE context line first.
  let month = new Date().getMonth() + 1;
  let year = new Date().getFullYear();
  for (const line of raw.split('\n')) {
    if (/PE\s*RIO\s*D\s*E|MARE T|JANUARI|FEBRUARI|MARET|APRIL|JUNI|JULI|AGUS|SEPTEM|OKTO|NOVEM|DESEM/i.test(line)) {
      const compact = line.replace(/\s/g, '');
      const m = compact.match(/(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)(\d{4})/i);
      if (m) {
        month = MONTH_MAP[m[1].toUpperCase()];
        year = parseInt(m[2]);
        break;
      }
    }
  }

  const txs: ParsedTx[] = [];
  const lines = raw.split('\n');

  for (const line of lines) {
    // Transaction lines start with DD/MM (with up to 12 leading spaces)
    const dateMatch = line.match(/^\s{0,12}(\d{2})\/(\d{2})\s/);
    if (!dateMatch) continue;

    const day = dateMatch[1].padStart(2, '0');
    // Use MM from the date line itself; year from statement header
    const txMonth = dateMatch[2].padStart(2, '0');
    const date = `${year}-${txMonth}-${day}`;

    // Skip opening balance marker and repeated column headers
    if (/SALDO\s*AWAL|TANG\s*GA\s*L|KET\s*ER\s*AN/i.test(line)) continue;

    // --- Debit: amount followed by "DB" ---
    const debitMatch = line.match(/([\d,]+\.\d{2})\s+DB/);
    if (debitMatch) {
      const amount = parseAmount(debitMatch[1]);
      const isTransfer = isOwnAccount(line, ownAccounts);
      const description = extractBCADescription(line);
      txs.push({ date, type: 'expense', amount, description, isTransfer, raw: line.trim() });
      continue;
    }

    // --- Credit: no DB, first amount is MUTASI ---
    // Matches: amount optionally followed by second amount (saldo)
    const creditAmounts = [...line.matchAll(/([\d,]+\.\d{2})/g)];
    if (creditAmounts.length >= 1) {
      const amount = parseAmount(creditAmounts[0][1]);
      if (amount <= 0) continue;
      const isTransfer = isOwnAccount(line, ownAccounts);
      const description = extractBCADescription(line);
      txs.push({ date, type: 'income', amount, description, isTransfer, raw: line.trim() });
    }
  }

  return txs;
}

function extractBCADescription(line: string): string {
  // Strip leading date token, strip trailing numbers, return key phrase
  const withoutDate = line.replace(/^\s*\d{2}\/\d{2}\s+/, '');
  // Remove amounts and DB suffix
  const withoutAmounts = withoutDate.replace(/([\d,]+\.\d{2})(\s+DB)?/g, '').trim();
  // Collapse whitespace, take first 80 chars
  const cleaned = withoutAmounts.replace(/\s{2,}/g, ' ').trim();
  return cleaned.slice(0, 80) || 'BCA Transaction';
}
