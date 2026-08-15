# Project Context

Status: Active, deployed
Owner: Ghaly and Intan
Updated: 2026-08-15

## Purpose

Ledger is a private personal-finance tracker for Ghaly and Intan. It supports
transaction tracking, wallet balances, analytics, file imports, and Telegram
quick-add/screenshot/PDF ingestion.

## Product or Domain

- A transaction belongs to a user and wallet and affects its balance.
- The web app is login-gated. Supported authentication is email/password and
  allow-listed Google OIDC.
- Telegram ingestion is owner-bound by chat and user IDs.
- Imported dates and amounts must be validated before persistence because bad
  OCR data can break downstream analytics.

## Repository Notes

- `backend/`: NestJS API, authentication, PostgreSQL access, Telegram ingestion,
  OCR and document parsing.
- `frontend/`: React/Vite single-page application and Hallmark-derived theme.
- `ops/`: Cloudflare tunnel and safe fast-forward auto-deployment scripts.
- `backend/src/main.ts`: API bootstrap; all API routes use the `/api` prefix.
- `backend/src/telegram/`: deterministic Telegram parsers and ingestion flow.
- The root `README.md` is stale where it describes SQLite/Next.js; trust this
  portable core and the current source/package metadata instead.
