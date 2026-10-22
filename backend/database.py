import sqlite3
import os
import sys
from pathlib import Path

# Ensure root directory is in sys.path
ROOT_DIR = Path(__file__).parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

DB_PATH = ROOT_DIR / "finance.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- checking, savings, credit_card, cash, investment
        initial_balance INTEGER NOT NULL DEFAULT 0, -- in cents
        current_balance INTEGER NOT NULL DEFAULT 0, -- in cents
        color TEXT DEFAULT '#4F46E5',
        icon TEXT DEFAULT 'wallet',
        credit_limit INTEGER DEFAULT 0, -- in cents (credit_card)
        closing_day INTEGER DEFAULT 1,
        due_day INTEGER DEFAULT 10,
        archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- expense, income
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        color TEXT DEFAULT '#64748B',
        icon TEXT DEFAULT 'tag',
        budget_limit INTEGER DEFAULT 0 -- in cents
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount INTEGER NOT NULL, -- in cents, always positive
        type TEXT NOT NULL, -- income, expense, transfer
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        destination_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        date TEXT NOT NULL, -- YYYY-MM-DD
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'completed', -- pending, completed
        notes TEXT,
        installment_current INTEGER DEFAULT 1,
        installment_total INTEGER DEFAULT 1,
        installment_group_id TEXT,
        is_recurring INTEGER DEFAULT 0,
        recurrence_period TEXT, -- monthly, weekly, yearly
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
