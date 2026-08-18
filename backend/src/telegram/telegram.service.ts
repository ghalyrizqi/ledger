import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { DatabaseService } from '../database/database.service';
import { parseVision } from '../import/parsers/vision.parser';
import { extractBCAMeta, isBCAStatementText, parseBCA, reconcileBCA } from '../import/parsers/bca.parser';
import { parsePermata, parsePermataText } from '../import/parsers/permata.parser';
import { parseJago, parseJagoText } from '../import/parsers/jago.parser';
import { parseGoPay } from '../import/parsers/gopay.parser';
import { parseStockbit, parseStockbitRDN } from '../import/parsers/stockbit.parser';
import { parseStockbitTC, isStockbitTC } from '../import/parsers/stockbit-tc.parser';
import { parseShopee } from '../import/parsers/shopee.parser';
import { parseOVO } from '../import/parsers/ovo.parser';
import { parseBibit } from '../import/parsers/bibit.parser';
import { ParsedTx } from '../import/import.service';
import { looseParse } from './loose-parse';
import { autoCategory } from '../import/category.util';
import { parseRupiah, formatRupiah } from './amount.util';

// Extract text from a PDF buffer using the bundled pdf-parse (pure JS — no
// poppler/pdftotext needed, which this box doesn't have). Works for text-based
// statements; scanned/image PDFs yield little text (user can send a photo).
async function pdfToText(buf: Buffer): Promise<string> {
  const mod: any = require('pdf-parse');
  const parser = new mod.PDFParse({ data: buf });
  try {
    const r = await parser.getText();
    return r?.text || '';
  } finally {
    try { await parser.destroy?.(); } catch { /* ignore */ }
  }
}

// Identify the bank from a statement's TEXT (not the file name) — so files like
// "4290910523_APR_2026.pdf" (BCA account number only, no bank word) still map to
// the right wallet. Mirrors the sniffing in parseWithBankParser.
function detectBankFromText(text: string): string | null {
  if (!text) return null;
  if (/PermataBank|PT Bank Permata/i.test(text)) return 'permata';
  if (isBCAStatementText(text)) return 'bca';
  if (/Bank\s*Jago/i.test(text)) return 'jago';
  if (/GoPay/i.test(text)) return 'gopay';
  if (/Stockbit|Statement of Account/i.test(text)) return 'stockbit';
  return null;
}

// Route a PDF to the same tuned, layout-aware parser the web upload flow uses
// (they need `pdftotext -layout`, now installed) instead of the bank-agnostic
// looseParse fallback — sniff which bank it is from footer/header text.
function parseWithBankParser(tmpPath: string, ownAccounts: string[], extractedText = ''): ParsedTx[] | null {
  if (isStockbitTC(tmpPath)) return parseStockbitTC(tmpPath);

  let raw = extractedText;
  if (!raw) {
    try {
      raw = execSync(`pdftotext -layout "${tmpPath}" -`, { encoding: 'utf8' });
    } catch {
      return null;
    }
  }

  if (/PermataBank|PT Bank Permata/i.test(raw)) {
    // pdf-parse is always available in the backend. Use its extracted text
    // when poppler/pdftotext is unavailable on the host.
    try {
      return parsePermata(tmpPath, ownAccounts);
    } catch {
      return parsePermataText(raw, ownAccounts);
    }
  }
  if (isBCAStatementText(raw)) {
    const rows = parseBCA(tmpPath, ownAccounts);
    const meta = extractBCAMeta(tmpPath);
    if (!reconcileBCA(rows, meta)) {
      throw new Error('BCA statement totals/counts do not match parsed transactions');
    }
    return rows;
  }
  if (/Bank\s*Jago/i.test(raw)) {
    const textRows = parseJagoText(raw, ownAccounts);
    try {
      const layoutRows = parseJago(tmpPath, ownAccounts);
      return textRows.length > layoutRows.length ? textRows : layoutRows;
    } catch {
      return textRows;
    }
  }
  if (/GoPay/i.test(raw) && /Total pemasukan/i.test(raw)) return parseGoPay(tmpPath, ownAccounts);
  if (/Stockbit|Statement of Account/i.test(raw)) return parseStockbit(tmpPath, ownAccounts);
  return null; // unrecognized bank — caller falls back to looseParse
}

// One parsed-but-unsaved transaction awaiting the user's Save/Cancel tap.
interface Draft {
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  isTransfer: boolean;
  walletId?: number;
}
interface Pending {
  userId: number;      // ledger user id (1=Ghaly, 2=Intan)
  drafts: Draft[];
  createdAt: number;
  isStatement: boolean;
}
interface SaveResult {
  inserted: number;
  ids: number[];
}

const PENDING_TTL_MS = 60 * 60 * 1000;   // drop drafts nobody confirmed after 1h

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly log = new Logger('Telegram');
  private bot: TelegramBot | null = null;
  private allowed = new Map<number, number>();   // telegram chat id -> ledger user id
  private pending = new Map<string, Pending>();

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    const token = process.env.LEDGER_TG_TOKEN?.trim();
    if (!token) {
      this.log.warn('LEDGER_TG_TOKEN not set — Telegram bot disabled (app runs normally).');
      return;
    }
    this.parseAllowed(process.env.LEDGER_TG_ALLOWED);

    this.bot = new TelegramBot(token);
    this.bot.on('message', (msg: any) => this.onMessage(msg).catch(e => this.log.error(e)));
    this.bot.on('callback_query', (q: any) => this.onCallback(q).catch(e => this.log.error(e)));
    this.bot.on('polling_error', (e: any) => this.log.error(`polling: ${e?.message || e}`));

    await this.bot.startPolling();
    await this.bot.setMyCommands([
      { command: 'start', description: 'Mulai / bantuan' },
      { command: 'format', description: 'Contoh format transaksi' },
      { command: 'saldo', description: 'Lihat saldo dompet' },
      { command: 'help', description: 'Cara pakai' },
    ]).catch(() => {});
    this.log.log(`Telegram bot online — ${this.allowed.size} chat(s) authorized.`);
  }

  private parseAllowed(raw?: string) {
    this.allowed.clear();
    for (const pair of (raw || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const [chat, user] = pair.split(':').map(s => parseInt(s.trim(), 10));
      if (chat && user) this.allowed.set(chat, user);
    }
  }

  // ---- auth ---------------------------------------------------------------
  private userFor(chatId: number): number | null {
    return this.allowed.get(chatId) ?? null;
  }

  // ---- message router -----------------------------------------------------
  private async onMessage(msg: any) {
    const chatId = msg.chat?.id;
    if (!chatId) return;
    const userId = this.userFor(chatId);

    if (userId === null) {
      // Never write to the ledger from an unknown chat. Hand back the chat id
      // so the owner can allow-list it (LEDGER_TG_ALLOWED=<chatId>:<userId>).
      await this.send(chatId,
        `Halo! Chat ID kamu: <code>${chatId}</code>\n\n` +
        `Bot ini privat. Minta admin daftarin ID ini dulu ya 🙏`);
      return;
    }

    if (Array.isArray(msg.photo) && msg.photo.length) return this.onPhoto(msg, userId);
    if (msg.document) return this.onDocument(msg, userId);
    const text: string = (msg.text || '').trim();
    if (text.startsWith('/')) return this.onCommand(text.split(/\s+/)[0].toLowerCase(), chatId, userId);
    if (text) return this.onText(text, chatId, userId);
  }

  private async onCommand(cmd: string, chatId: number, userId: number) {
    if (cmd === '/saldo') return this.sendBalances(chatId, userId);
    return this.sendGuide(chatId);
  }

  private sendGuide(chatId: number) {
    return this.send(chatId,
      `📖 <b>Panduan format Ledger</b>\n\n` +
      `<b>Pengeluaran</b>\n` +
      `<code>50000 kopi</code>\n` +
      `Preview muncul, lalu pilih dompet sumber.\n\n` +
      `<b>Pemasukan</b>\n` +
      `<code>gaji 5jt</code>\n` +
      `Kata gaji, bonus, refund, cashback, atau dividen dibaca sebagai pemasukan.\n\n` +
      `<b>Tanggal dan beberapa transaksi sekaligus</b>\n` +
      `<code>11 agustus dari jago ghaly 100k\n` +
      `12 agustus ke alfamidi 61.400\n` +
      `12 agustus dari ghaly 5.675.000\n` +
      `12 agustus ke bca syariah bayar ukt amel 5.675.000</code>\n` +
      `Tanggal dan wallet dari baris sebelumnya dipakai sebagai konteks bila baris berikutnya tidak menyebutkannya.\n\n` +
      `<b>Edit transaksi berdasarkan ID</b>\n` +
      `<code>edit 123 harga 120k</code>\n` +
      `<code>edit 123 bank BCA</code>\n` +
      `<code>edit 123 deskripsi bayar UKT Amel</code>\n` +
      `<code>edit 123 tanggal 11 agustus</code>\n` +
      `ID ditampilkan oleh bot setelah transaksi tersimpan.\n\n` +
      `<b>Inter-wallet</b> — kedua dompet milik Anda\n` +
      `<code>transfer 500rb dari Jago ke BCA</code>\n` +
      `Dicatat sebagai pasangan transfer internal dan tidak dihitung sebagai spending/income.\n\n` +
      `<b>Extra-wallet keluar</b> — hanya dompet asal milik Anda\n` +
      `<code>transfer 100rb dari BCA ke Andi</code>\n` +
      `Dicatat sebagai expense dari BCA.\n\n` +
      `<b>Extra-wallet masuk</b> — hanya dompet tujuan milik Anda\n` +
      `<code>transfer 250rb dari Andi ke Jago</code>\n` +
      `Dicatat sebagai income ke Jago.\n\n` +
      `Nama dompet harus sama dengan nama di Ledger. Bot selalu menampilkan preview sebelum menyimpan.\n\n` +
      `/format — tampilkan panduan ini\n` +
      `/saldo — lihat saldo semua dompet`);
  }

  // ---- text quick-add -----------------------------------------------------
  private async onText(text: string, chatId: number, userId: number) {
    if (/^(?:edit|ubah)\b/i.test(text)) {
      await this.editTransactionFromText(text, chatId, userId);
      return;
    }

    const datedLines = text.split('\n').map(line => line.trim()).filter(Boolean);
    if (datedLines.length > 1 || this.parseDatePrefix(datedLines[0]) !== null) {
      const wallets = await this.wallets(userId);
      const user = await this.db.get('SELECT name FROM users WHERE id = ?', [userId]);
      const drafts = this.parseContextTransactions(datedLines, wallets, user?.name || '');
      if (!drafts.length) {
        await this.send(chatId,
          `Format tanggalnya belum kebaca 😅 Contoh:\n` +
          `<code>12 agustus ke alfamidi 61.400</code>`);
        return;
      }
      await this.presentConfirm(chatId, userId, drafts);
      return;
    }

    const amount = parseRupiah(text);
    if (!amount || amount <= 0) {
      await this.send(chatId, `Hmm, ga nemu angkanya 😅. Contoh: <code>50000 kopi</code> atau <code>gaji 5jt</code>`);
      return;
    }

    const explicitDate = this.parseDateAnywhere(text);
    const transferText = explicitDate
      ? `${text.slice(0, explicitDate.index)} ${text.slice(explicitDate.index + explicitDate.length)}`.trim()
      : text;
    const transfer = this.parseTextTransfer(transferText);
    if (transfer) {
      const wallets = await this.wallets(userId);
      const from = this.resolveWallet(transfer.from, wallets);
      const to = this.resolveWallet(transfer.to, wallets);

      if (!from && !to) {
        const names = wallets.map(w => `${w.icon || '•'} ${w.name}`).join(', ');
        await this.send(chatId,
          `Minimal satu sisi transfer harus cocok dengan dompet kamu 😅\n` +
          `Tulis nama dompet persis seperti di Ledger. Dompet kamu: ${names || 'belum ada'}`);
        return;
      }
      if (from && to && from.id === to.id) {
        await this.send(chatId, 'Dompet asal dan tujuan harus berbeda ya.');
        return;
      }

      const date = explicitDate?.date ?? this.today();
      if (from && to) {
        const description = `Transfer ${from.name} → ${to.name}`;
        const drafts: Draft[] = [
          { date, type: 'expense', amount, category: 'Internal Transfer', description, isTransfer: true, walletId: from.id },
          { date, type: 'income', amount, category: 'Internal Transfer', description, isTransfer: true, walletId: to.id },
        ];
        await this.presentTransferConfirm(chatId, userId, drafts, from, to);
        return;
      }

      const type: 'income' | 'expense' = from ? 'expense' : 'income';
      const wallet = from || to;
      const externalParty = from ? transfer.to : transfer.from;
      const description = from ? `Transfer ke ${externalParty}` : `Transfer dari ${externalParty}`;
      const draft: Draft = {
        date, type, amount, description,
        category: autoCategory(description, type, false),
        isTransfer: false,
        walletId: wallet.id,
      };
      await this.presentExternalTransferConfirm(chatId, userId, draft, transfer.from, transfer.to, wallet);
      return;
    }
    if (/\b(transfer|pindah(?:kan)?|kirim)\b/i.test(text)) {
      await this.send(chatId,
        `Untuk transfer antar-dompet, pakai format:\n` +
        `<code>transfer 500rb dari Jago ke BCA</code>`);
      return;
    }

    // strip the amount token to get the description
    const desc = text.replace(/([\d.,]+)\s*(jt|juta|rb|ribu|k)?/i, '').replace(/rp\.?/i, '').trim() || 'Transaksi';
    const type: 'income' | 'expense' = /\b(gaji|masuk|terima|income|dividen|bonus|thr|refund|cashback|honor|freelance)\b/i.test(text)
      ? 'income' : 'expense';
    const category = autoCategory(desc, type, false);
    const draft: Draft = { date: this.today(), type, amount, category, description: desc, isTransfer: false };
    await this.presentConfirm(chatId, userId, [draft]);
  }

  private async editTransactionFromText(text: string, chatId: number, userId: number) {
    const command = text.match(/^(?:edit|ubah)\s+#?(\d+)\s+(harga|nominal|amount|bank|wallet|dompet|deskripsi|description|tanggal|date)\s+(.+)$/i);
    if (!command) {
      await this.send(chatId,
        `Format edit belum lengkap. Contoh:\n` +
        `<code>edit 123 harga 120k</code>\n` +
        `<code>edit 123 bank BCA</code>\n` +
        `<code>edit 123 deskripsi bayar UKT</code>`);
      return;
    }

    const id = Number(command[1]);
    const field = command[2].toLowerCase();
    const value = command[3].trim();
    const tx = await this.db.get(
      `SELECT t.*, w.name AS wallet_name FROM transactions t
       LEFT JOIN wallets w ON w.id=t.wallet_id
       WHERE t.id=? AND t.user_id=?`,
      [id, userId],
    );
    if (!tx) {
      await this.send(chatId, `Transaksi <code>#${id}</code> tidak ditemukan atau bukan milik kamu.`);
      return;
    }

    let changedIds = [id];
    let changeSummary = '';
    const pairedIds = async (): Promise<number[]> => {
      if (!Number(tx.is_transfer)) return [id];
      const pair = await this.db.all(
        `SELECT id FROM transactions WHERE user_id=? AND is_transfer=1
          AND date=? AND amount=? AND LOWER(description)=LOWER(?)`,
        [userId, tx.date, tx.amount, tx.description],
      );
      return pair.map((row: any) => Number(row.id));
    };

    if (/^(harga|nominal|amount)$/.test(field)) {
      const amount = parseRupiah(value);
      if (!amount || amount <= 0 || amount > 1_000_000_000) {
        await this.send(chatId, 'Nominal tidak valid. Contoh: <code>edit 123 harga 120k</code>');
        return;
      }
      changedIds = await pairedIds();
      await this.db.run('UPDATE transactions SET amount=? WHERE user_id=? AND id = ANY(?)', [amount, userId, changedIds]);
      changeSummary = `${formatRupiah(Number(tx.amount))} → <b>${formatRupiah(amount)}</b>`;
    } else if (/^(bank|wallet|dompet)$/.test(field)) {
      const wallets = await this.wallets(userId);
      const wallet = this.resolveWallet(value, wallets);
      if (!wallet) {
        const names = wallets.map(w => w.name).join(', ');
        await this.send(chatId, `Wallet “${this.escapeHtml(value)}” tidak ditemukan. Pilihan: ${this.escapeHtml(names)}`);
        return;
      }
      await this.db.run('UPDATE transactions SET wallet_id=? WHERE id=? AND user_id=?', [wallet.id, id, userId]);
      changeSummary = `${this.escapeHtml(tx.wallet_name || 'Tanpa wallet')} → <b>${this.escapeHtml(wallet.name)}</b>`;
    } else if (/^(deskripsi|description)$/.test(field)) {
      if (!value) return;
      changedIds = await pairedIds();
      const category = autoCategory(value, tx.type, Boolean(tx.is_transfer));
      await this.db.run(
        'UPDATE transactions SET description=?, category=? WHERE user_id=? AND id = ANY(?)',
        [value.slice(0, 120), category, userId, changedIds],
      );
      changeSummary = `“${this.escapeHtml(tx.description || '')}” → <b>“${this.escapeHtml(value.slice(0, 120))}”</b>`;
    } else {
      const parsedDate = this.parseDateAnywhere(value);
      const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : parsedDate?.date;
      if (!isoDate || this.safeDate(isoDate) !== isoDate) {
        await this.send(chatId, 'Tanggal tidak valid. Contoh: <code>edit 123 tanggal 11 agustus</code>');
        return;
      }
      changedIds = await pairedIds();
      await this.db.run('UPDATE transactions SET date=? WHERE user_id=? AND id = ANY(?)', [isoDate, userId, changedIds]);
      changeSummary = `${tx.date} → <b>${isoDate}</b>`;
    }

    const idLabel = changedIds.map(changedId => `#${changedId}`).join(', ');
    await this.send(chatId, `✅ Transaksi ${idLabel} diperbarui.\n${changeSummary}`);
  }

  private parseContextTransactions(lines: string[], wallets: any[], userName: string): Draft[] {
    const drafts: Draft[] = [];
    let contextDate: string | null = null;
    let contextWallet: any | null = null;

    for (const original of lines) {
      const datePrefix = this.parseDatePrefix(original);
      if (datePrefix) contextDate = datePrefix.date;
      const body = datePrefix ? original.slice(datePrefix.length).trim() : original;
      if (!body) continue; // A date-only line sets context for the following rows.

      const amount = parseRupiah(body);
      if (!amount || amount <= 0 || !contextDate) continue;
      const withoutAmount = body
        .replace(/(?:rp\.?\s*)?[\d.,]+\s*(?:jt|juta|rb|ribu|k)?/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      const direction = withoutAmount.match(/^(dari|from|ke|to)\s+(.+)$/i);

      if (direction) {
        const incoming = /^(dari|from)$/i.test(direction[1]);
        const party = direction[2].trim();
        const explicitWallet = this.resolveOwnedParty(party, wallets, userName);

        if (incoming && explicitWallet) {
          // "dari jago ghaly" establishes Jago as the source wallet context.
          contextWallet = explicitWallet;
          const description = `Pengeluaran dari ${explicitWallet.name}`;
          drafts.push({
            date: contextDate, type: 'expense', amount,
            category: autoCategory(description, 'expense', false),
            description, isTransfer: false, walletId: explicitWallet.id,
          });
          continue;
        }

        if (!incoming && explicitWallet && contextWallet && explicitWallet.id !== contextWallet.id) {
          const description = `Transfer ${contextWallet.name} → ${explicitWallet.name}`;
          drafts.push(
            { date: contextDate, type: 'expense', amount, category: 'Internal Transfer', description, isTransfer: true, walletId: contextWallet.id },
            { date: contextDate, type: 'income', amount, category: 'Internal Transfer', description, isTransfer: true, walletId: explicitWallet.id },
          );
          continue;
        }

        const type: 'income' | 'expense' = incoming ? 'income' : 'expense';
        const description = incoming ? `Transfer dari ${party}` : `Transfer ke ${party}`;
        drafts.push({
          date: contextDate, type, amount,
          category: autoCategory(description, type, false),
          description, isTransfer: false,
          walletId: contextWallet?.id ?? (incoming ? explicitWallet?.id : undefined),
        });
        if (incoming && explicitWallet) contextWallet = explicitWallet;
        continue;
      }

      const type: 'income' | 'expense' = /\b(gaji|masuk|terima|income|dividen|bonus|thr|refund|cashback|honor|freelance)\b/i.test(withoutAmount)
        ? 'income' : 'expense';
      const description = withoutAmount || 'Transaksi';
      drafts.push({
        date: contextDate, type, amount,
        category: autoCategory(description, type, false),
        description, isTransfer: false, walletId: contextWallet?.id,
      });
    }
    return drafts;
  }

  private parseDatePrefix(value: string): { date: string; length: number } | null {
    const parsed = this.parseDateAnywhere(value);
    return parsed?.index === 0 ? { date: parsed.date, length: parsed.length } : null;
  }

  private parseDateAnywhere(value: string): { date: string; index: number; length: number } | null {
    const months: Record<string, number> = {
      januari: 1, jan: 1, februari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4,
      mei: 5, juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agu: 8, agt: 8,
      september: 9, sep: 9, oktober: 10, okt: 10, november: 11, nov: 11,
      desember: 12, des: 12,
    };
    const match = value.match(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/i);
    if (!match) return null;
    const month = months[match[2].toLowerCase()];
    if (!month) return null;
    const day = Number(match[1]);
    const year = match[3] ? Number(match[3]) : Number(this.today().slice(0, 4));
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      index: match.index ?? 0,
      length: match[0].length,
    };
  }

  private resolveOwnedParty(input: string, wallets: any[], userName: string): any | null {
    const exact = this.resolveWallet(input, wallets);
    if (exact) return exact;
    const normalized = this.normalizeWalletName(input);
    const normalizedUser = this.normalizeWalletName(userName);
    const matches = wallets.filter(wallet => {
      const names = [wallet.name, wallet.bank_type].filter(Boolean).map((name: string) => this.normalizeWalletName(name));
      return names.some(name => normalized === `${name} ${normalizedUser}`);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  private parseTextTransfer(text: string): { from: string; to: string } | null {
    if (!/\b(transfer|pindah(?:kan)?|kirim)\b/i.test(text)) return null;
    const withoutAmount = text
      .replace(/(?:rp\.?\s*)?[\d.,]+\s*(?:jt|juta|rb|ribu|k)?/i, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const direction = withoutAmount.match(/\b(?:dari|from)\s+(.+?)\s+\b(?:ke|to)\s+(.+?)\s*$/i);
    if (!direction) return null;
    return { from: direction[1].trim(), to: direction[2].trim() };
  }

  private resolveWallet(input: string, wallets: any[]): any | null {
    const normalized = this.normalizeWalletName(input);
    const matches = wallets.filter(w =>
      this.normalizeWalletName(w.name) === normalized ||
      (w.bank_type && this.normalizeWalletName(w.bank_type) === normalized),
    );
    return matches.length === 1 ? matches[0] : null;
  }

  private normalizeWalletName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- photo / document (image or PDF) → OCR/parse -----------------------
  private async onPhoto(msg: any, userId: number) {
    const photo = msg.photo[msg.photo.length - 1];        // largest size
    await this.ingestFile(msg.chat.id, userId, photo.file_id, 'image/jpeg', 'foto', msg.caption || '');
  }

  private async onDocument(msg: any, userId: number) {
    const doc = msg.document || {};
    const mime: string = doc.mime_type || '';
    const name: string = doc.file_name || '';
    const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name);
    const isImg = mime.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(name);
    if (!isPdf && !isImg) {
      await this.send(msg.chat.id, 'Kirim <b>foto</b> atau <b>PDF</b> mutasi/struk ya 🙏');
      return;
    }
    await this.ingestFile(msg.chat.id, userId, doc.file_id,
      isPdf ? 'application/pdf' : (mime || 'image/jpeg'), isPdf ? 'PDF' : 'gambar', name);
  }

  // Download a Telegram file, extract transactions (OCR for images; PDFs try
  // the tuned per-bank parsers first, falling back to the generic looseParse
  // for statements from banks we don't recognize), and present them to confirm.
  private async ingestFile(chatId: number, userId: number, fileId: string, mime: string, label: string, sourceName = '') {
    await this.bot!.sendChatAction(chatId, 'typing').catch(() => {});
    let buf: Buffer;
    try {
      buf = await this.download(fileId);
    } catch {
      await this.send(chatId, `Gagal ngambil ${label}-nya 😔 coba kirim ulang.`);
      return;
    }

    let drafts: Draft[] = [];
    let bankHint = '';   // bank_type detected from content/filename → wallet suggestion
    try {
      const ownAccounts = await this.ownAccounts(userId);
      let parsed: ParsedTx[];
      if (mime === 'application/pdf') {
        const tmpPath = join(tmpdir(), `ledger-tg-${Date.now()}.pdf`);
        writeFileSync(tmpPath, buf);
        try {
          const extractedText = await pdfToText(buf);
          parsed = parseWithBankParser(tmpPath, ownAccounts, extractedText) ?? looseParse(extractedText);
          bankHint = detectBankFromText(extractedText) || this.providerFromHint(sourceName) || '';
        } finally {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
      } else {
        const provider = this.providerFromHint(sourceName);
        bankHint = provider || '';
        if (provider === 'shopee') parsed = await parseShopee(buf, ownAccounts);
        else if (provider === 'ovo') parsed = await parseOVO(buf, ownAccounts);
        else if (provider === 'stockbit') parsed = await parseStockbitRDN(buf, ownAccounts);
        else if (provider === 'bibit') parsed = await parseBibit(buf, ownAccounts);
        else parsed = await parseVision(buf, mime, provider || 'Telegram', ownAccounts);
      }
      drafts = parsed
        // drop garbage from OCR misreads: non-positive or absurd amounts
        // (> Rp 1 bn is held back for manual review; statement OCR commonly
        // concatenates reference/balance digits into a multi-billion amount)
        .filter(p => p.amount > 0 && p.amount <= 1_000_000_000)
        .map(p => ({
          date: this.safeDate(p.date), type: p.type, amount: p.amount,
          description: p.description, isTransfer: p.isTransfer,
          category: autoCategory(p.description, p.type, p.isTransfer),
        }));
    } catch (e) {
      this.log.error(`parse failed (${mime}): ${e}`);
    }

    if (!drafts.length) {
      await this.send(chatId,
        `Aku ga bisa baca transaksinya dari ${label} itu 😅\n` +
        `Kalau screenshot, kirim sebagai file dengan nama dompet (contoh <code>ovo.png</code>) ` +
        `atau tulis nama dompet di caption. Atau ketik manual: <code>50000 kopi</code>`);
      return;
    }
    await this.presentConfirm(chatId, userId, drafts, true, sourceName, bankHint);
  }

  private providerFromHint(value: string): string | null {
    const hint = value.toLowerCase();
    if (/shopee/.test(hint)) return 'shopee';
    if (/\bovo\b/.test(hint)) return 'ovo';
    if (/stockbit/.test(hint)) return 'stockbit';
    if (/bibit/.test(hint)) return 'bibit';
    if (/\bdana\b/.test(hint)) return 'dana';
    if (/gopay|go-pay/.test(hint)) return 'gopay';
    if (/\bbca\b/.test(hint)) return 'bca';
    if (/permata/.test(hint)) return 'permata';
    if (/jago/.test(hint)) return 'jago';
    return null;
  }

  private async download(fileId: string): Promise<Buffer> {
    const link = await this.bot!.getFileLink(fileId);
    const res = await fetch(link);
    return Buffer.from(await res.arrayBuffer());
  }

  // ---- confirm flow -------------------------------------------------------
  private async presentConfirm(chatId: number, userId: number, drafts: Draft[], isStatement = false, sourceName = '', bankHint = '') {
    const pid = Math.random().toString(36).slice(2, 8);
    this.pending.set(pid, { userId, drafts, createdAt: Date.now(), isStatement });
    this.gcPending();

    const lines = drafts.slice(0, 20).map(d => {
      const sign = d.type === 'income' ? '➕' : '➖';
      return `${sign} <b>${formatRupiah(d.amount)}</b> — ${d.description}\n     <i>${d.category} · ${d.date}</i>`;
    });
    const more = drafts.length > 20 ? `\n…dan ${drafts.length - 20} lagi` : '';
    const head = drafts.length > 1 ? `Ketemu <b>${drafts.length}</b> transaksi:\n\n` : `Ini ya:\n\n`;

    const wallets = await this.wallets(userId);
    // Guess the wallet from the detected bank (PDF content) + file name.
    const suggested = (sourceName || bankHint) ? this.suggestWallet(sourceName, wallets, bankHint) : null;

    const keyboard: any[][] = [];
    let prompt: string;
    if (wallets.length) {
      // detected wallet goes first as a one-tap "save here" button
      if (suggested) {
        keyboard.push([{ text: `✅ ${suggested.icon || ''} ${suggested.name} (terdeteksi)`.replace(/\s+/g, ' ').trim(), callback_data: `w:${pid}:${suggested.id}` }]);
      }
      for (const w of wallets) {
        if (suggested && w.id === suggested.id) continue;  // already on top
        keyboard.push([{ text: `💾 ${w.icon || ''} ${w.name}`.replace(/\s+/g, ' ').trim(), callback_data: `w:${pid}:${w.id}` }]);
      }
      keyboard.push([
        { text: 'Simpan tanpa dompet', callback_data: `w:${pid}:0` },
        { text: '❌ Batal', callback_data: `x:${pid}` },
      ]);
      prompt = suggested
        ? `\n\nKayaknya ini dari <b>${this.escapeHtml(suggested.name)}</b> — tinggal pencet buat simpan, atau pilih dompet lain.`
        : `\n\nSimpan ke dompet mana?`;
    } else {
      keyboard.push([
        { text: '✅ Simpan', callback_data: `w:${pid}:0` },
        { text: '❌ Batal', callback_data: `x:${pid}` },
      ]);
      prompt = '';
    }

    await this.send(chatId, head + lines.join('\n') + more + prompt,
      { reply_markup: { inline_keyboard: keyboard } });
  }

  // Guess which wallet a statement belongs to from its file name. Scores each
  // wallet by bank-type match + name-token overlap; returns a wallet only when
  // there's a single clear winner (otherwise we fall back to the full picker).
  private suggestWallet(sourceName: string, wallets: any[], bankHint = ''): any | null {
    const norm = this.normalizeWalletName(sourceName);       // "jago kantong utama history 16082026"
    const noSpace = norm.replace(/\s+/g, '');
    const hint = bankHint ? this.normalizeWalletName(bankHint) : '';
    if (!norm && !hint) return null;

    const scored = wallets
      .map(w => {
        const bt = w.bank_type ? this.normalizeWalletName(w.bank_type) : '';
        let score = 0;
        if (bt && hint && bt === hint) score += 3;                                 // bank detected from PDF content
        if (bt && norm && new RegExp(`\\b${bt}\\b`).test(norm)) score += 2;         // bank name in file name
        for (const tok of this.normalizeWalletName(w.name).split(' ').filter(t => t.length >= 3)) {
          if (norm && new RegExp(`\\b${tok}\\b`).test(norm)) score += 2;            // wallet-name token in file name
        }
        const acct = w.account_number ? String(w.account_number).replace(/\D/g, '') : '';
        if (acct.length >= 5 && noSpace.includes(acct)) score += 3;                 // account number in file name
        return { w, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;
    if (scored.length > 1 && scored[0].score === scored[1].score) return null;      // ambiguous
    return scored[0].w;
  }

  private async presentTransferConfirm(chatId: number, userId: number, drafts: Draft[], from: any, to: any) {
    const pid = Math.random().toString(36).slice(2, 8);
    this.pending.set(pid, { userId, drafts, createdAt: Date.now(), isStatement: false });
    this.gcPending();
    await this.send(chatId,
      `Konfirmasi transfer:\n\n` +
      `💸 <b>${formatRupiah(drafts[0].amount)}</b>\n` +
      `${from.icon || '•'} ${from.name} → ${to.icon || '•'} ${to.name}\n` +
      `<i>${drafts[0].date}</i>`,
      { reply_markup: { inline_keyboard: [[
        { text: '✅ Simpan transfer', callback_data: `t:${pid}` },
        { text: '❌ Batal', callback_data: `x:${pid}` },
      ]] } },
    );
  }

  private async presentExternalTransferConfirm(
    chatId: number,
    userId: number,
    draft: Draft,
    fromName: string,
    toName: string,
    wallet: any,
  ) {
    const pid = Math.random().toString(36).slice(2, 8);
    this.pending.set(pid, { userId, drafts: [draft], createdAt: Date.now(), isStatement: false });
    this.gcPending();
    const direction = draft.type === 'expense' ? 'keluar / expense' : 'masuk / income';
    await this.send(chatId,
      `Konfirmasi transfer <b>${direction}</b>:\n\n` +
      `💸 <b>${formatRupiah(draft.amount)}</b>\n` +
      `${this.escapeHtml(fromName)} → ${this.escapeHtml(toName)}\n` +
      `Dompet Ledger: ${wallet.icon || '•'} ${this.escapeHtml(wallet.name)}\n` +
      `<i>${draft.date}</i>`,
      { reply_markup: { inline_keyboard: [[
        { text: '✅ Simpan transfer', callback_data: `t:${pid}` },
        { text: '❌ Batal', callback_data: `x:${pid}` },
      ]] } },
    );
  }

  private async onCallback(q: any) {
    const data: string = q.data || '';
    const chatId = q.message?.chat?.id;
    const [action, pid, extra] = data.split(':');
    const p = this.pending.get(pid);

    const ack = (text?: string) => this.bot!.answerCallbackQuery(q.id, text ? { text } : {}).catch(() => {});

    // Cancellation must also close stale confirmations. Pending drafts live in
    // memory and disappear after a deploy/restart, but an old Telegram button
    // can still be tapped. It is safe to cancel without the draft as long as
    // the chat itself is allow-listed.
    if (action === 'x') {
      const tappingUserId = this.userFor(chatId);
      if (tappingUserId === null || (p && tappingUserId !== p.userId)) {
        await ack('Bukan punya kamu');
        return;
      }
      if (p) this.pending.delete(pid);
      await ack('Dibatalkan');
      if (chatId && q.message?.message_id) {
        await this.editText(chatId, q.message.message_id, '❌ Dibatalkan.');
      }
      return;
    }

    if (!p) { await ack('Sesi kadaluarsa, kirim ulang ya'); return; }
    // authorization: the tapping chat must own this pending item
    if (this.userFor(chatId) !== p.userId) { await ack('Bukan punya kamu'); return; }

    if (action === 'w') {
      const walletId = extra === '0' ? null : parseInt(extra, 10);
      const saved = await this.saveDrafts(p.userId, p.drafts, walletId);
      if (p.isStatement && walletId) {
        const dates = p.drafts.map(d => d.date).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
        await this.db.run(
          `INSERT INTO wallet_imports
            (user_id, wallet_id, source, status, covered_from, covered_through, imported_count, duplicate_count)
           VALUES (?, ?, 'telegram', ?, ?, ?, ?, ?)`,
          [p.userId, walletId, dates.length ? 'success' : 'partial', dates[0] ?? null,
           dates[dates.length - 1] ?? null, saved.inserted, Math.max(0, p.drafts.length - saved.inserted)],
        );
      }
      this.pending.delete(pid);
      const total = p.drafts.reduce((s, d) => s + (d.type === 'income' ? d.amount : -d.amount), 0);
      const net = (total >= 0 ? '➕' : '➖') + ' ' + formatRupiah(Math.abs(total));
      await this.editText(chatId, q.message.message_id,
        `✅ Tersimpan <b>${saved.inserted}</b> transaksi (${net}).\n` +
        `ID: <code>${saved.ids.map(id => `#${id}`).join(', ')}</code>`);
      await ack('Tersimpan ✅');
      return;
    }
    if (action === 't') {
      const saved = await this.saveDrafts(p.userId, p.drafts, null);
      this.pending.delete(pid);
      await this.editText(chatId, q.message.message_id,
        `✅ Transfer tersimpan (${saved.inserted} catatan dompet).\n` +
        `ID: <code>${saved.ids.map(id => `#${id}`).join(', ')}</code>`);
      await ack('Transfer tersimpan ✅');
      return;
    }
  }

  // ---- persistence (mirrors ImportService.confirm dedup + balance) --------
  private async saveDrafts(userId: number, drafts: Draft[], walletId: number | null): Promise<SaveResult> {
    let inserted = 0;
    const ids: number[] = [];
    for (const d of drafts) {
      const targetWalletId = d.walletId ?? walletId;
      const dup = await this.db.get(
        `SELECT id FROM transactions WHERE user_id=? AND wallet_id IS NOT DISTINCT FROM ?
           AND date=? AND amount=? AND type=? AND LOWER(description)=LOWER(?)`,
        [userId, targetWalletId, d.date, d.amount, d.type, d.description],
      );
      if (dup) {
        ids.push(Number(dup.id));
        continue;
      }
      const created = await this.db.get(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, date, is_transfer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [userId, targetWalletId, d.type, d.amount, d.category, d.description, d.date, d.isTransfer ? 1 : 0],
      );
      inserted++;
      ids.push(Number(created.id));
    }
    return { inserted, ids };
  }

  // ---- helpers ------------------------------------------------------------
  private async sendBalances(chatId: number, userId: number) {
    const wallets = await this.wallets(userId, true);
    if (!wallets.length) { await this.send(chatId, 'Belum ada dompet. Bikin dulu di web ya.'); return; }
    const lines = wallets.map(w => `${w.icon || '•'} ${w.name}: <b>${formatRupiah(Number(w.balance))}</b>`);
    const total = wallets.reduce((s, w) => s + Number(w.balance), 0);
    await this.send(chatId, `💼 <b>Saldo</b>\n\n${lines.join('\n')}\n\n<b>Total: ${formatRupiah(total)}</b>`);
  }

  private async wallets(userId: number, withBalance = false): Promise<any[]> {
    if (withBalance) {
      return this.db.all(`
        SELECT w.id, w.name, w.icon,
          w.balance + COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount
                                        WHEN t.type='expense' THEN -t.amount ELSE 0 END),0) AS balance
        FROM wallets w LEFT JOIN transactions t ON t.wallet_id = w.id
        WHERE w.user_id = ? GROUP BY w.id ORDER BY w.created_at DESC`, [userId]);
    }
    return this.db.all('SELECT id, name, icon, bank_type, account_number FROM wallets WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  private async ownAccounts(userId: number): Promise<string[]> {
    const w: any[] = await this.db.all(
      'SELECT account_number FROM wallets WHERE user_id = ? AND account_number IS NOT NULL', [userId]);
    const u: any[] = await this.db.all('SELECT name FROM users');
    return [...w.map(x => x.account_number), ...u.map(x => x.name)].filter(Boolean);
  }

  private today(): string {
    // WIB date as YYYY-MM-DD (transactions.date is stored as text)
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  }

  // Guard against OCR/parse misreads (e.g. "2026-07-76") that would poison the
  // TEXT date column and crash analytics casts. Valid YYYY-MM-DD calendar date
  // passes through; anything else falls back to today.
  private safeDate(d: string): string {
    return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d || '') ? d : this.today();
  }

  private gcPending() {
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.createdAt > PENDING_TTL_MS) this.pending.delete(k);
  }

  private send(chatId: number, text: string, extra: any = {}) {
    return this.bot!.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra }).catch(e => this.log.error(e));
  }
  private editText(chatId: number, messageId: number, text: string) {
    return this.bot!.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' })
      .catch(e => this.log.error(e));
  }
}
