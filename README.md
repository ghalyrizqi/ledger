# Ledger

A full-stack personal finance tracker with a light glassmorphism UI, built with NestJS, Next.js, and SQLite.

## Features

- Multi-user support (Ghaly & Intan)
- Track income and expenses by category and wallet
- Wallet management — bank, e-wallet, cash, and other types
- Bank statement PDF import (BCA, Permata, Jago, Stockbit)
- Initial balance tracking to anchor wallet history
- Monthly cashflow chart (income vs. expense breakdown)
- CSV import for bulk transactions
- Balance crosscheck — verifies wallet totals match calculated net balance
- Full CRUD for transactions, categories, and wallets
- Overall balance summary across all wallets

## Tech Stack

### Backend
- **NestJS** — Node.js framework
- **sql.js** — SQLite (in-process, no native bindings)
- **pdftotext** (poppler) — PDF text extraction for bank statement parsing
- **TypeScript**

### Frontend
- **Next.js** — React framework with App Router
- **Recharts** — Bar chart for monthly cashflow
- **Axios** — API client
- **TypeScript**

## Getting Started

### Prerequisites
- Node.js 18+
- yarn
- poppler (`brew install poppler` on macOS) — required for PDF statement import

### Installation

```bash
# Backend
cd backend && yarn install

# Frontend
cd frontend && yarn install
```

### Running

```bash
# Terminal 1 — backend on :3001
cd backend && yarn start:dev

# Terminal 2 — frontend on :3000
cd frontend && yarn dev
```

Open **http://localhost:3000**.

## Project Structure

```
ledger/
├── backend/
│   └── src/
│       ├── analytics/           # Monthly cashflow and balance crosscheck
│       ├── categories/
│       ├── database/            # SQLite connection and setup
│       ├── import/
│       │   └── parsers/         # PDF parsers: bca, permata, jago, stockbit
│       ├── initial-balances/    # Per-wallet opening balance records
│       ├── services/            # Shared import logic
│       ├── transactions/
│       ├── users/
│       ├── wallets/
│       └── main.ts
│
└── frontend/
    ├── app/
    │   ├── globals.css          # Design tokens and glass utility classes
    │   ├── layout.tsx
    │   └── page.tsx             # Main layout with user selector and tabs
    ├── components/
    │   ├── BalanceCrosscheckComponent.tsx
    │   ├── CategoryForm.tsx
    │   ├── CategoryManager.tsx
    │   ├── ConfirmDialog.tsx
    │   ├── Dashboard.tsx
    │   ├── FinancialSummary.tsx
    │   ├── ImportTransactions.tsx   # CSV import
    │   ├── InitialBalanceDialog.tsx
    │   ├── MonthlyChart.tsx
    │   ├── OverallBalanceSummary.tsx
    │   ├── StatementImportModal.tsx # PDF bank statement import
    │   ├── TransactionForm.tsx
    │   ├── TransactionList.tsx
    │   ├── UserManager.tsx
    │   ├── UserSelector.tsx
    │   ├── WalletCard.tsx
    │   ├── WalletForm.tsx
    │   └── WalletManager.tsx
    ├── lib/
    │   └── api.ts
    └── types/
        └── index.ts
```

## API Endpoints

### Users
- `GET /users`
- `POST /users`

### Transactions
- `GET /transactions?userId=X&year=Y&month=M`
- `GET /transactions/summary/:userId`
- `POST /transactions`
- `PUT /transactions/:id`
- `DELETE /transactions/:id`
- `POST /transactions/import` — CSV bulk import

### Categories
- `GET /categories?userId=X`
- `POST /categories`
- `PUT /categories/:id`
- `DELETE /categories/:id`

### Wallets
- `GET /wallets?userId=X`
- `POST /wallets`
- `PUT /wallets/:id`
- `DELETE /wallets/:id`

### Initial Balances
- `GET /initial-balances/:walletId`
- `POST /initial-balances`
- `PUT /initial-balances/:id`

### Import (Bank Statements)
- `POST /import/preview` — parse PDF and return transaction rows
- `POST /import/confirm` — save parsed transactions to the ledger

### Analytics
- `GET /analytics/monthly?userId=X&year=Y`
- `GET /analytics/crosscheck?userId=X`
- `GET /analytics/overall-balance?userId=X`

## License

MIT
