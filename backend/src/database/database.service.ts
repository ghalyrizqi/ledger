import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private db: Database;
    private dbPath = path.join(process.cwd(), 'ledger.db'); // fresh db
    // private dbPath = path.join(process.cwd(), 'finance.db'); // original db

    async onModuleInit() {
        await this.initDatabase();
    }

    async onModuleDestroy() {
        // Save database to file before closing
        this.saveDatabase();
    }

    private async initDatabase(): Promise<void> {
        const SQL = await initSqlJs();

        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
            console.log('✅ SQLite database loaded from file');
        } else {
            this.db = new SQL.Database();
            console.log('✅ SQLite database created');
        }

        await this.createTables();
        await this.seedUsers();
        await this.seedDefaultCategories();
        this.saveDatabase();
        console.log('✅ Database initialized');
    }

    private saveDatabase(): void {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    private async createTables(): Promise<void> {
        const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;

        const createTransactionsTable = `
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

        const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
        icon TEXT,
        color TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name)
      );
    `;

        const createWalletsTable = `
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('bank', 'ewallet', 'cash', 'other')),
        balance REAL NOT NULL DEFAULT 0,
        icon TEXT,
        color TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

        this.db.run(createUsersTable);
        this.db.run(createTransactionsTable);
        this.db.run(createCategoriesTable);
        this.db.run(createWalletsTable);

        const createInitialBalancesTable = `
      CREATE TABLE IF NOT EXISTS initial_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        balance REAL NOT NULL,
        is_manual INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, year, month)
      );
    `;
        this.db.run(createInitialBalancesTable);

        // Migrations: add columns if they don't exist yet
        this.runMigrations();
    }

    private runMigrations(): void {
        const migrateColumn = (table: string, column: string, definition: string) => {
            try {
                this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            } catch {
                // Column already exists — ignore
            }
        };

        migrateColumn('wallets', 'bank_type', 'TEXT');
        migrateColumn('wallets', 'account_number', 'TEXT');
        migrateColumn('transactions', 'is_transfer', 'INTEGER DEFAULT 0');
        migrateColumn('wallets', 'gain_amt', 'REAL');
        migrateColumn('wallets', 'gain_pct', 'REAL');
        migrateColumn('transactions', 'wallet_id', 'INTEGER');
    }

    private async seedUsers(): Promise<void> {
        // Check if users already exist
        const result = this.db.exec('SELECT * FROM users');

        if (result.length === 0 || result[0].values.length === 0) {
            this.db.run("INSERT INTO users (id, name) VALUES (1, 'Ghaly')");
            this.db.run("INSERT INTO users (id, name) VALUES (2, 'Intan')");
            console.log('✅ Users seeded: Ghaly and Intan');
        }
    }

    private async seedDefaultCategories(): Promise<void> {
        // Check if categories already exist
        const result = this.db.exec('SELECT * FROM categories');

        if (result.length === 0 || result[0].values.length === 0) {
            const users = this.all('SELECT id FROM users');

            const incomeCategories = [
                { name: 'Salary', icon: '💰', color: '#10b981' },
                { name: 'Freelance', icon: '💼', color: '#3b82f6' },
                { name: 'Investment', icon: '📈', color: '#8b5cf6' },
                { name: 'Gift', icon: '🎁', color: '#ec4899' },
                { name: 'Other Income', icon: '💵', color: '#6366f1' },
            ];

            const expenseCategories = [
                { name: 'Food & Dining', icon: '🍔', color: '#ef4444' },
                { name: 'Transportation', icon: '🚗', color: '#f59e0b' },
                { name: 'Shopping', icon: '🛍️', color: '#ec4899' },
                { name: 'Bills & Utilities', icon: '📄', color: '#6366f1' },
                { name: 'Entertainment', icon: '🎬', color: '#8b5cf6' },
                { name: 'Health', icon: '🏥', color: '#10b981' },
                { name: 'Education', icon: '📚', color: '#3b82f6' },
                { name: 'Other Expense', icon: '💳', color: '#64748b' },
            ];

            users.forEach((user: any) => {
                incomeCategories.forEach(cat => {
                    this.run(
                        'INSERT INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
                        [user.id, cat.name, 'income', cat.icon, cat.color]
                    );
                });

                expenseCategories.forEach(cat => {
                    this.run(
                        'INSERT INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
                        [user.id, cat.name, 'expense', cat.icon, cat.color]
                    );
                });
            });

            console.log('✅ Default categories seeded for all users');
        }
    }

    run(sql: string, params: any[] = []): void {
        if (params.length > 0) {
            // Use prepared statement for parameterized queries
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            stmt.step();
            stmt.free();
        } else {
            // Use simple run for non-parameterized queries
            this.db.run(sql);
        }
        this.saveDatabase();
    }

    all(sql: string, params: any[] = []): any[] {
        const result = this.db.exec(sql, params);
        if (result.length === 0) return [];

        const columns = result[0].columns;
        const values = result[0].values;

        return values.map(row => {
            const obj: any = {};
            columns.forEach((col, index) => {
                obj[col] = row[index];
            });
            return obj;
        });
    }

    get(sql: string, params: any[] = []): any {
        const results = this.all(sql, params);
        return results.length > 0 ? results[0] : null;
    }
}
