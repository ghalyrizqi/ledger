/**
 * One-time migration: SQLite (sql.js) → PostgreSQL
 * Run with: npx ts-node migrate-to-pg.ts
 */
import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const DB_PATH = path.join(__dirname, 'ledger.db');
const PG_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/ledger';

async function main() {
  // ── 1. Load SQLite ──────────────────────────────────────────────────────────
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const sqlite = new SQL.Database(buf);

  const q = (sql: string) => {
    const res = sqlite.exec(sql);
    if (!res.length) return [];
    return res[0].values.map(row =>
      Object.fromEntries(res[0].columns.map((c, i) => [c, row[i]]))
    );
  };

  // ── 2. Connect to PostgreSQL ─────────────────────────────────────────────────
  const pool = new Pool({ connectionString: PG_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 3. Create schema ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id   SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        name       TEXT NOT NULL,
        type       TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
        icon       TEXT,
        color      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, name)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id),
        name           TEXT NOT NULL,
        type           TEXT NOT NULL CHECK (type IN ('bank', 'ewallet', 'cash', 'other')),
        balance        NUMERIC NOT NULL DEFAULT 0,
        icon           TEXT,
        color          TEXT,
        bank_type      TEXT,
        account_number TEXT,
        gain_amt       NUMERIC,
        gain_pct       NUMERIC,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id),
        wallet_id   INTEGER REFERENCES wallets(id),
        type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount      NUMERIC NOT NULL,
        category    TEXT NOT NULL,
        description TEXT,
        date        TEXT NOT NULL,
        is_transfer INTEGER DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS initial_balances (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        year       INTEGER NOT NULL,
        month      INTEGER NOT NULL,
        balance    NUMERIC NOT NULL,
        is_manual  INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, year, month)
      );
    `);

    // ── 4. Migrate data ────────────────────────────────────────────────────────
    // Seed both users (user 2 may be missing from SQLite due to prior manual edits)
    await client.query(
      `INSERT INTO users (id, name) VALUES (1, 'Ghaly'), (2, 'Intan') ON CONFLICT (id) DO NOTHING`
    );
    const users = q('SELECT * FROM users');
    console.log(`Migrating ${users.length} users (+ ensuring user 2 Intan)...`);

    const categories = q('SELECT * FROM categories');
    console.log(`Migrating ${categories.length} categories...`);
    for (const r of categories) {
      await client.query(
        `INSERT INTO categories (id, user_id, name, type, icon, color)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.user_id, r.name, r.type, r.icon, r.color]
      );
    }

    const wallets = q('SELECT * FROM wallets');
    console.log(`Migrating ${wallets.length} wallets...`);
    for (const r of wallets) {
      await client.query(
        `INSERT INTO wallets (id, user_id, name, type, balance, icon, color, bank_type, account_number, gain_amt, gain_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.user_id, r.name, r.type, r.balance, r.icon, r.color, r.bank_type, r.account_number, r.gain_amt, r.gain_pct]
      );
    }

    const transactions = q('SELECT * FROM transactions');
    console.log(`Migrating ${transactions.length} transactions...`);
    for (const r of transactions) {
      await client.query(
        `INSERT INTO transactions (id, user_id, wallet_id, type, amount, category, description, date, is_transfer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.user_id, r.wallet_id, r.type, r.amount, r.category, r.description, r.date, r.is_transfer ?? 0]
      );
    }

    const balances = q('SELECT * FROM initial_balances');
    console.log(`Migrating ${balances.length} initial balances...`);
    for (const r of balances) {
      await client.query(
        `INSERT INTO initial_balances (id, user_id, year, month, balance, is_manual)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.user_id, r.year, r.month, r.balance, r.is_manual ?? 0]
      );
    }

    // ── 5. Reset sequences ─────────────────────────────────────────────────────
    for (const table of ['users', 'categories', 'wallets', 'transactions', 'initial_balances']) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
      );
    }

    await client.query('COMMIT');
    console.log('✅ Migration complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main();
