# Known Issues

Status: Current
Owner: Ghaly
Updated: 2026-08-15

## Issues

- The root README describes an obsolete SQLite/Next.js architecture.
- `ops/tunnel.sh` is the retired Cloudflare quick-tunnel implementation and has
  a stale comment referring to Basic Auth. It is retained only as a fallback;
  the `ledger-tunnel` PM2 process has been removed.
- Google login requires its provider-side authorized callback URI to be
  `https://ledger.tail65ef82.ts.net/api/auth/google/callback`; email/password
  remains available if that external setting has not yet been updated.
- OCR can yield invalid dates or absurd amounts. Keep `safeDate` and amount
  validation in the save path and add regression coverage when changing parsers.
- The backend and frontend currently define no automated test scripts.

## Review Notes

Move resolved items out of this file. Promote stable decisions to context,
rules, workflows, or ADRs rather than accumulating session history here.
