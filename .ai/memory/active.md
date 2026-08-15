# Active Memory

Status: Active
Owner: Ghaly
Updated: 2026-08-15

## Current Focus

- Improve Telegram screenshot and PDF transaction import with deterministic
  per-bank parsers and regexes learned from real samples.
- Preserve image, image-file, PDF, and text quick-add flows, confirmation
  buttons, deduplication, categorization, and wallet balance updates.

## Constraints

- `pdftotext -layout` is unavailable on this no-sudo host, so PDF ingestion
  currently falls back to pure-JavaScript `pdf-parse` plus loose parsing.
- The public Cloudflare quick-tunnel URL rotates on restart, which also changes
  the Google OIDC callback configuration requirement.

## Follow-ups

- Rotate any credentials previously pasted into chat, especially the Google
  client secret and Telegram bot token; save replacements only in the protected
  environment file.
- Set memorable web passwords through hidden terminal input rather than chat or
  tracked files.
- Push VPS commits promptly. Auto-deploy intentionally skips dirty, locally
  ahead, or diverged worktrees.
