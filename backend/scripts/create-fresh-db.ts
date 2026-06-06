import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const OUT_PATH = path.join(process.cwd(), 'ledger.db');

async function main() {
    if (fs.existsSync(OUT_PATH)) {
        fs.unlinkSync(OUT_PATH);
        console.log(`🗑️  Deleted existing ${OUT_PATH}`);
    }

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            wallet_id INTEGER,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            is_transfer INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (wallet_id) REFERENCES wallets(id)
        )
    `);

    db.run(`
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
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('bank', 'ewallet', 'cash', 'other')),
            balance REAL NOT NULL DEFAULT 0,
            icon TEXT,
            color TEXT,
            bank_type TEXT,
            account_number TEXT,
            gain_amt REAL,
            gain_pct REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    db.run(`
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
        )
    `);

    // Seed users
    db.run("INSERT INTO users (id, name) VALUES (1, 'Ghaly')");
    db.run("INSERT INTO users (id, name) VALUES (2, 'Intan')");

    // Seed default categories for both users
    const incomeCategories = [
        { name: 'Salary',       icon: '💰', color: '#10b981' },
        { name: 'Freelance',    icon: '💼', color: '#3b82f6' },
        { name: 'Investment',   icon: '📈', color: '#8b5cf6' },
        { name: 'Gift',         icon: '🎁', color: '#ec4899' },
        { name: 'Other Income', icon: '💵', color: '#6366f1' },
    ];

    const expenseCategories = [
        { name: 'Food & Dining',    icon: '🍔', color: '#ef4444' },
        { name: 'Transportation',   icon: '🚗', color: '#f59e0b' },
        { name: 'Shopping',         icon: '🛍️', color: '#ec4899' },
        { name: 'Bills & Utilities',icon: '📄', color: '#6366f1' },
        { name: 'Entertainment',    icon: '🎬', color: '#8b5cf6' },
        { name: 'Health',           icon: '🏥', color: '#10b981' },
        { name: 'Education',        icon: '📚', color: '#3b82f6' },
        { name: 'Other Expense',    icon: '💳', color: '#64748b' },
    ];

    for (const userId of [1, 2]) {
        for (const cat of incomeCategories) {
            const stmt = db.prepare('INSERT INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)');
            stmt.run([userId, cat.name, 'income', cat.icon, cat.color]);
            stmt.free();
        }
        for (const cat of expenseCategories) {
            const stmt = db.prepare('INSERT INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)');
            stmt.run([userId, cat.name, 'expense', cat.icon, cat.color]);
            stmt.free();
        }
    }

    const data = db.export();
    fs.writeFileSync(OUT_PATH, Buffer.from(data));
    console.log(`✅ Fresh database created at ${OUT_PATH}`);
    console.log('   Users: Ghaly (id=1), Intan (id=2)');
    console.log('   Tables: users, transactions, categories, wallets, initial_balances');
    console.log('   Default categories seeded for both users');
    console.log('\n   The backend is already configured to use ledger.db.');
}

main().catch(err => { console.error(err); process.exit(1); });
