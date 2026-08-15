import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { DatabaseService } from '../database/database.service';
import { parseVision } from '../import/parsers/vision.parser';
import { parseBCA } from '../import/parsers/bca.parser';
import { parsePermata } from '../import/parsers/permata.parser';
import { parseJago } from '../import/parsers/jago.parser';
import { parseGoPay } from '../import/parsers/gopay.parser';
import { parseStockbitTC, isStockbitTC } from '../import/parsers/stockbit-tc.parser';
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

// Route a PDF to the same tuned, layout-aware parser the web upload flow uses
// (they need `pdftotext -layout`, now installed) instead of the bank-agnostic
// looseParse fallback — sniff which bank it is from footer/header text.
function parseWithBankParser(tmpPath: string, ownAccounts: string[]): ParsedTx[] | null {
  if (isStockbitTC(tmpPath)) return parseStockbitTC(tmpPath);

  let raw: string;
  try {
    raw = execSync(`pdftotext -layout "${tmpPath}" -`, { encoding: 'utf8' });
  } catch {
    return null; // poppler missing or unreadable PDF — fall back to looseParse
  }

  if (/PermataBank|PT Bank Permata/i.test(raw)) return parsePermata(tmpPath, ownAccounts);
  if (/PT\s*Bank\s*Central\s*Asia|KlikBCA|BCA\s*Mobile/i.test(raw)) return parseBCA(tmpPath, ownAccounts);
  if (/Bank\s*Jago/i.test(raw)) return parseJago(tmpPath, ownAccounts);
  if (/GoPay/i.test(raw) && /Total pemasukan/i.test(raw)) return parseGoPay(tmpPath, ownAccounts);
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
}
interface Pending {
  userId: number;      // ledger user id (1=Ghaly, 2=Intan)
  drafts: Draft[];
  createdAt: number;
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
    // /start and /help
    await this.send(chatId,
      `👋 <b>Ledger bot</b>\n\n` +
      `Catat transaksi gampang:\n` +
      `• Kirim <b>foto</b> atau <b>PDF</b> struk/mutasi → aku baca otomatis\n` +
      `• Atau <b>ketik</b>, contoh:\n` +
      `   <code>50000 kopi</code>\n` +
      `   <code>gaji 5jt</code>\n` +
      `   <code>25rb parkir</code>\n\n` +
      `Nanti aku tunjukin hasilnya, tinggal pencet <b>Simpan</b> ✅\n` +
      `/saldo — lihat saldo dompet`);
  }

  // ---- text quick-add -----------------------------------------------------
  private async onText(text: string, chatId: number, userId: number) {
    const amount = parseRupiah(text);
    if (!amount || amount <= 0) {
      await this.send(chatId, `Hmm, ga nemu angkanya 😅. Contoh: <code>50000 kopi</code> atau <code>gaji 5jt</code>`);
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

  // ---- photo / document (image or PDF) → OCR/parse -----------------------
  private async onPhoto(msg: any, userId: number) {
    const photo = msg.photo[msg.photo.length - 1];        // largest size
    await this.ingestFile(msg.chat.id, userId, photo.file_id, 'image/jpeg', 'foto');
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
      isPdf ? 'application/pdf' : (mime || 'image/jpeg'), isPdf ? 'PDF' : 'gambar');
  }

  // Download a Telegram file, extract transactions (OCR for images; PDFs try
  // the tuned per-bank parsers first, falling back to the generic looseParse
  // for statements from banks we don't recognize), and present them to confirm.
  private async ingestFile(chatId: number, userId: number, fileId: string, mime: string, label: string) {
    await this.bot!.sendChatAction(chatId, 'typing').catch(() => {});
    let buf: Buffer;
    try {
      buf = await this.download(fileId);
    } catch {
      await this.send(chatId, `Gagal ngambil ${label}-nya 😔 coba kirim ulang.`);
      return;
    }

    let drafts: Draft[] = [];
    try {
      const ownAccounts = await this.ownAccounts(userId);
      let parsed: ParsedTx[];
      if (mime === 'application/pdf') {
        const tmpPath = join(tmpdir(), `ledger-tg-${Date.now()}.pdf`);
        writeFileSync(tmpPath, buf);
        try {
          parsed = parseWithBankParser(tmpPath, ownAccounts) ?? looseParse(await pdfToText(buf));
        } finally {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
      } else {
        parsed = await parseVision(buf, mime, 'Telegram', ownAccounts);
      }
      drafts = parsed
        // drop garbage from OCR misreads: non-positive or absurd amounts
        // (> Rp 100 bn for a personal ledger is a parse error, e.g. concatenated digits)
        .filter(p => p.amount > 0 && p.amount <= 100_000_000_000)
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
        `Kalau struk, foto yang lebih jelas. Atau ketik manual: <code>50000 kopi</code>`);
      return;
    }
    await this.presentConfirm(chatId, userId, drafts);
  }

  private async download(fileId: string): Promise<Buffer> {
    const link = await this.bot!.getFileLink(fileId);
    const res = await fetch(link);
    return Buffer.from(await res.arrayBuffer());
  }

  // ---- confirm flow -------------------------------------------------------
  private async presentConfirm(chatId: number, userId: number, drafts: Draft[]) {
    const pid = Math.random().toString(36).slice(2, 8);
    this.pending.set(pid, { userId, drafts, createdAt: Date.now() });
    this.gcPending();

    const lines = drafts.slice(0, 20).map(d => {
      const sign = d.type === 'income' ? '➕' : '➖';
      return `${sign} <b>${formatRupiah(d.amount)}</b> — ${d.description}\n     <i>${d.category} · ${d.date}</i>`;
    });
    const more = drafts.length > 20 ? `\n…dan ${drafts.length - 20} lagi` : '';
    const head = drafts.length > 1 ? `Ketemu <b>${drafts.length}</b> transaksi:\n\n` : `Ini ya:\n\n`;

    const wallets = await this.wallets(userId);
    const keyboard: any[][] = [];
    if (wallets.length) {
      // one button per wallet — tapping saves into that wallet
      for (const w of wallets) {
        keyboard.push([{ text: `💾 ${w.icon || ''} ${w.name}`.trim(), callback_data: `w:${pid}:${w.id}` }]);
      }
      keyboard.push([
        { text: 'Simpan tanpa dompet', callback_data: `w:${pid}:0` },
        { text: '❌ Batal', callback_data: `x:${pid}` },
      ]);
    } else {
      keyboard.push([
        { text: '✅ Simpan', callback_data: `w:${pid}:0` },
        { text: '❌ Batal', callback_data: `x:${pid}` },
      ]);
    }

    await this.send(chatId, head + lines.join('\n') + more +
      (wallets.length ? `\n\nSimpan ke dompet mana?` : ''),
      { reply_markup: { inline_keyboard: keyboard } });
  }

  private async onCallback(q: any) {
    const data: string = q.data || '';
    const chatId = q.message?.chat?.id;
    const [action, pid, extra] = data.split(':');
    const p = this.pending.get(pid);

    const ack = (text?: string) => this.bot!.answerCallbackQuery(q.id, text ? { text } : {}).catch(() => {});

    if (!p) { await ack('Sesi kadaluarsa, kirim ulang ya'); return; }
    // authorization: the tapping chat must own this pending item
    if (this.userFor(chatId) !== p.userId) { await ack('Bukan punya kamu'); return; }

    if (action === 'x') {
      this.pending.delete(pid);
      await this.editText(chatId, q.message.message_id, '❌ Dibatalkan.');
      await ack('Dibatalkan');
      return;
    }
    if (action === 'w') {
      const walletId = extra === '0' ? null : parseInt(extra, 10);
      const inserted = await this.saveDrafts(p.userId, p.drafts, walletId);
      this.pending.delete(pid);
      const total = p.drafts.reduce((s, d) => s + (d.type === 'income' ? d.amount : -d.amount), 0);
      const net = (total >= 0 ? '➕' : '➖') + ' ' + formatRupiah(Math.abs(total));
      await this.editText(chatId, q.message.message_id,
        `✅ Tersimpan <b>${inserted}</b> transaksi (${net}).`);
      await ack('Tersimpan ✅');
      return;
    }
  }

  // ---- persistence (mirrors ImportService.confirm dedup + balance) --------
  private async saveDrafts(userId: number, drafts: Draft[], walletId: number | null): Promise<number> {
    let inserted = 0;
    let delta = 0;
    for (const d of drafts) {
      const dup = await this.db.get(
        `SELECT id FROM transactions WHERE user_id=? AND wallet_id IS NOT DISTINCT FROM ?
           AND date=? AND amount=? AND type=? AND LOWER(description)=LOWER(?)`,
        [userId, walletId, d.date, d.amount, d.type, d.description],
      );
      if (dup) continue;
      await this.db.run(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, date, is_transfer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, walletId, d.type, d.amount, d.category, d.description, d.date, d.isTransfer ? 1 : 0],
      );
      inserted++;
      if (!d.isTransfer) delta += d.type === 'income' ? d.amount : -d.amount;
    }
    if (walletId && delta !== 0) {
      await this.db.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', [delta, walletId]);
    }
    return inserted;
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
    return this.db.all('SELECT id, name, icon FROM wallets WHERE user_id = ? ORDER BY created_at DESC', [userId]);
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
