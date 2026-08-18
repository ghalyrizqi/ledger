# Active Memory

Status: Active
Owner: Ghaly
Updated: 2026-08-15

## Current Focus

- Improve Telegram screenshot and PDF transaction import with deterministic
  per-bank parsers and regexes learned from real samples.
- Preserve image, image-file, PDF, and text quick-add flows, confirmation
  buttons, deduplication, categorization, and wallet balance updates.
- Telegram text quick-add recognizes explicit internal transfers such as
  `transfer 500rb dari Jago ke BCA`, resolves both wallets without guessing,
  and saves paired transfer-excluded balance entries after confirmation.
- Telegram `/format` documents inter-wallet and extra-wallet syntax. A
  directional transfer with exactly one owned wallet is saved as ordinary
  expense (owned source) or income (owned destination); two owned wallets stay
  an analytics-excluded internal transfer.

## Constraints

- `pdftotext -layout` is installed without root under
  `/home/ghaly/.local/opt/poppler-utils` and exposed through
  `/home/ghaly/.local/bin/pdftotext`. Jago and Permata retain deterministic
  pure-JavaScript text fallbacks; unrecognized PDFs use loose parsing.
- Telegram routes provider-named image files or photo captions to the dedicated
  ShopeePay, OVO, Stockbit, and Bibit parsers; other configured wallets use the
  common image parser. Provider-specific PDFs cover Permata, Jago, BCA, GoPay,
  and Stockbit.
- Tailscale Funnel is the public entry point at
  `https://ledger.tail65ef82.ts.net`; its background configuration persists
  across tailscaled restarts.

## Follow-ups

- Rotate any credentials previously pasted into chat, especially the Google
  client secret and Telegram bot token; save replacements only in the protected
  environment file.
- Set memorable web passwords through hidden terminal input rather than chat or
  tracked files.
- Push VPS commits promptly. Auto-deploy intentionally skips dirty, locally
  ahead, or diverged worktrees.
