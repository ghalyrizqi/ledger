import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, types } from 'pg';

// pg returns NUMERIC as string by default — parse it as float globally
types.setTypeParser(1700, (val: string) => parseFloat(val));

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private pool: Pool;

    async onModuleInit() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ledger',
        });
        await this.createSchema();
        await this.seedUsers();
        await this.seedDefaultCategories();
        console.log('✅ Database initialized');
    }

    async onModuleDestroy() {
        await this.pool.end();
    }

    // Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ...
    private toPositional(sql: string): string {
        let i = 0;
        return sql.replace(/\?/g, () => `$${++i}`);
    }

    async run(sql: string, params: any[] = []): Promise<void> {
        await this.pool.query(this.toPositional(sql), params);
    }

    async all(sql: string, params: any[] = []): Promise<any[]> {
        const result = await this.pool.query(this.toPositional(sql), params);
        return result.rows;
    }

    async get(sql: string, params: any[] = []): Promise<any> {
        const result = await this.pool.query(this.toPositional(sql), params);
        return result.rows[0] ?? null;
    }

    private async createSchema(): Promise<void> {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id   SERIAL PRIMARY KEY,
                name TEXT NOT NULL
            );
        `);

        await this.pool.query(`
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

        await this.pool.query(`
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
                freshness_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                freshness_mode TEXT NOT NULL DEFAULT 'statement',
                update_frequency TEXT NOT NULL DEFAULT 'monthly',
                expected_day   INTEGER NOT NULL DEFAULT 7,
                grace_days     INTEGER NOT NULL DEFAULT 0,
                last_confirmed_at TIMESTAMPTZ,
                freshness_initialized BOOLEAN NOT NULL DEFAULT FALSE,
                created_at     TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await this.pool.query(`
            ALTER TABLE wallets ADD COLUMN IF NOT EXISTS freshness_enabled BOOLEAN NOT NULL DEFAULT TRUE;
            ALTER TABLE wallets ADD COLUMN IF NOT EXISTS freshness_mode TEXT NOT NULL DEFAULT 'statement';
            ALTER TABLE wallets ADD COLUMN IF NOT EXISTS update_frequency TEXT NOT NULL DEFAULT 'monthly';
            ALTER TABLE wallets ADD COLUMN IF NOT EXISTS expected_day INTEGER NOT NULL DEFAULT 7;
            ALTER TABLE wallets ADD COLUMN IF NOT EXISTS grace_days INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;
            ALTER TABLE wallets ADD COLUMN IF NOT EXISTS freshness_initialized BOOLEAN NOT NULL DEFAULT FALSE;
        `);

        await this.pool.query(`
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

        await this.pool.query(`
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

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS wallet_imports (
                id              SERIAL PRIMARY KEY,
                user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                wallet_id       INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
                source          TEXT NOT NULL CHECK (source IN ('web', 'telegram', 'manual')),
                status          TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'rejected')),
                uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                covered_from    TEXT,
                covered_through TEXT,
                closing_balance NUMERIC,
                imported_count  INTEGER NOT NULL DEFAULT 0,
                duplicate_count INTEGER NOT NULL DEFAULT 0,
                error_message   TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_wallet_imports_wallet_uploaded
                ON wallet_imports(wallet_id, uploaded_at DESC);
        `);

        await this.pool.query(`
            UPDATE wallets
            SET freshness_mode = CASE WHEN type IN ('cash', 'other') THEN 'manual' ELSE 'statement' END,
                update_frequency = CASE WHEN type = 'ewallet' THEN 'weekly' WHEN type IN ('cash', 'other') THEN 'manual' ELSE 'monthly' END
                , freshness_initialized = TRUE
            WHERE freshness_initialized = FALSE;
        `);

        console.log('✅ PostgreSQL schema ready');
    }

    private async seedUsers(): Promise<void> {
        await this.pool.query(
            `INSERT INTO users (id, name) VALUES (1, 'Ghaly'), (2, 'Intan') ON CONFLICT (id) DO NOTHING`
        );
    }

    private async seedDefaultCategories(): Promise<void> {
        const users = await this.all('SELECT id FROM users');

        const incomeCategories = [
            { name: 'Salary',            icon: '💰', color: '#10b981' },
            { name: 'Freelance',         icon: '💼', color: '#3b82f6' },
            { name: 'Investment Return', icon: '📈', color: '#8b5cf6' },
            { name: 'Dividend',          icon: '💹', color: '#06b6d4' },
            { name: 'Gift',              icon: '🎁', color: '#ec4899' },
            { name: 'Other Income',      icon: '💵', color: '#6366f1' },
        ];

        const expenseCategories = [
            { name: 'Food & Dining',     icon: '🍔', color: '#ef4444' },
            { name: 'Transportation',    icon: '🚗', color: '#f59e0b' },
            { name: 'Shopping',          icon: '🛍️', color: '#ec4899' },
            { name: 'Bills & Utilities', icon: '📄', color: '#6366f1' },
            { name: 'Entertainment',     icon: '🎬', color: '#8b5cf6' },
            { name: 'Health',            icon: '🏥', color: '#10b981' },
            { name: 'Education',         icon: '📚', color: '#3b82f6' },
            { name: 'Investment',        icon: '📊', color: '#0ea5e9' },
            { name: 'Other Expense',     icon: '💳', color: '#64748b' },
        ];

        for (const user of users) {
            for (const cat of incomeCategories) {
                await this.run(
                    `INSERT INTO categories (user_id, name, type, icon, color)
                     VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, name) DO NOTHING`,
                    [user.id, cat.name, 'income', cat.icon, cat.color]
                );
            }
            for (const cat of expenseCategories) {
                await this.run(
                    `INSERT INTO categories (user_id, name, type, icon, color)
                     VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, name) DO NOTHING`,
                    [user.id, cat.name, 'expense', cat.icon, cat.color]
                );
            }
        }

        console.log('✅ Default categories ensured for all users');
    }
}
