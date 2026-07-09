import { execSync } from 'child_process';
import { ParsedTx } from '../import.service';

export interface GopayMeta {
  totalInflow?: number;
  totalOutflow?: number;
}

export function extractGopayMeta(filePath: string): GopayMeta {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });
  const lines = raw.split('\n');

  // Header: "... Total pemasukan   Total pengeluaran"
  // Values: "... Rp1.790.500        Rp5.610.518"
  for (let i = 0; i < lines.length; i++) {
    if (/Total pemasukan\s+Total pengeluaran/i.test(lines[i])) {
      const vals = lines[i + 1] ?? '';
      const amounts = [...vals.matchAll(/Rp([\d.]+)/g)].map(m =>
        parseFloat(m[1].replace(/\./g, '')) || 0,
      );
      if (amounts.length >= 2) {
        return { totalInflow: amounts[0], totalOutflow: amounts[1] };
      }
    }
  }

  return {};
}

export function parseGoPay(filePath: string, _ownAccounts: string[]): ParsedTx[] {
  const raw = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });
  const lines = raw.split('\n');
  const txs: ParsedTx[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Transaction lines start with DD/MM/YYYY followed by spaces
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+/);
    if (!dateMatch) continue;

    const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

    // Amount is at the end of the line: -RpNNN.NNN or RpNNN.NNN
    // If only a bare number (coins), there's no "Rp" → skip
    const amtMatch = line.match(/(-Rp|Rp)([\d.]+)\s*$/);
    if (!amtMatch) continue;

    const isNegative = amtMatch[1] === '-Rp';
    const amount = parseFloat(amtMatch[2].replace(/\./g, '')) || 0;
    if (!amount) continue;

    // Middle section: everything between the date prefix and the amount
    const middle = line.slice(dateMatch[0].length, line.lastIndexOf(amtMatch[0])).trim();

    // Columns are separated by 3+ spaces: [description, txId, paymentMethod]
    const parts = middle.split(/\s{3,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    const description = parts[0];
    const paymentMethod1 = parts[parts.length - 1]; // last part = payment method

    // Check the continuation line (HH:MM) for additional payment method
    // e.g. "GoPay Coins Jago" split across two lines
    const nextLine = lines[i + 1] || '';
    let paymentMethod2 = '';
    const contMatch = nextLine.match(/^\s*\d{2}:\d{2}\s+/);
    if (contMatch) {
      const nextRest = nextLine.slice(contMatch[0].length);
      const nextParts = nextRest.split(/\s{3,}/).map(p => p.trim()).filter(Boolean);
      // Only keep known payment method tokens (whitelist) — ignore TX ID part 2 and location names
      paymentMethod2 = nextParts
        .filter(p => /^(GoPay\s+Saldo|GoPay\s+Coins|Jago|[xX]{2}-\d{4})$/.test(p))
        .join(' ').trim();
    }

    const fullPayment = [paymentMethod1, paymentMethod2].join(' ').trim();

    // Skip Jago-funded — already captured in Jago statement, would double-count
    if (/Jago/i.test(fullPayment)) continue;

    // Skip cashback/coin reward entries
    if (/^Cashback\b/i.test(description)) continue;
    if (/^Hadiah\s+kartu/i.test(description)) continue;

    // GoPay top up = incoming transfer from Jago/bank → isTransfer
    if (/GoPay\s+top\s+up/i.test(description)) {
      if (!isNegative) {
        txs.push({
          date, type: 'income', amount,
          description: 'GoPay — Top Up',
          isTransfer: true,
          raw: line.trim(),
        });
      }
      continue;
    }

    // Person-to-person transfer via GoPay
    const transferMatch = description.match(/^Ditransfer\s+ke\s+(.+)/i);
    if (transferMatch) {
      txs.push({
        date, type: 'expense', amount,
        description: `GoPay — Transfer ke ${transferMatch[1]}`,
        isTransfer: false,
        raw: line.trim(),
      });
      continue;
    }

    const type: 'income' | 'expense' = isNegative ? 'expense' : 'income';
    txs.push({
      date, type, amount,
      description: description.slice(0, 100),
      isTransfer: false,
      raw: line.trim(),
    });
  }

  return txs;
}
