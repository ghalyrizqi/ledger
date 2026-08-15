# Architecture Context

Status: Current production architecture
Owner: Ghaly
Updated: 2026-08-15

## Overview

Ledger is a NestJS and React/Vite monorepo deployed on a VPS. NestJS serves both
the API under `/api` and the built frontend from `frontend/dist`, producing one
browser origin. PostgreSQL runs in a dedicated Docker container. A Cloudflare
quick tunnel provides public HTTPS through an outbound connection.

## Key Components

- Backend (`127.0.0.1:3001`): API, session-cookie authentication, static SPA,
  imports, analytics, and Telegram long polling.
- Frontend: responsive React SPA; production assets are built into
  `frontend/dist` and served by the backend.
- Database (`127.0.0.1:5433`): dedicated PostgreSQL container and volume.
- `ledger-backend` and `ledger-tunnel`: production processes managed by PM2.
- `ops/autodeploy.sh`: fast-forwards clean `main`, rebuilds changed packages,
  and reloads the backend only after a successful build.

## Boundaries

- Never bind a service to `0.0.0.0`; VPS services must remain localhost-only.
- Keep the API and frontend on one origin and retain the `/api` global prefix.
- Do not commit `backend/.env`, credentials, session secrets, tokens, database
  URLs, chat/user IDs, or current tunnel URLs.
- The Cloudflare quick-tunnel URL rotates after restart. Google OIDC requires
  `PUBLIC_URL` and its configured callback URI to match the current URL.
- Telegram parsing is deterministic-only. Improve bank parsers and regexes; do
  not add an LLM or other runtime AI dependency for parsing.
