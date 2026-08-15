# Known Issues

Status: Current
Owner: Ghaly
Updated: 2026-08-15

## Issues

- The root README describes an obsolete SQLite/Next.js architecture.
- `ops/tunnel.sh` has a stale comment referring to Basic Auth; production uses
  the session-cookie login gate.
- Quick-tunnel rotation can temporarily break Google login until `PUBLIC_URL`
  and the provider callback URI are updated; email/password remains available.
- OCR can yield invalid dates or absurd amounts. Keep `safeDate` and amount
  validation in the save path and add regression coverage when changing parsers.
- The backend and frontend currently define no automated test scripts.

## Review Notes

Move resolved items out of this file. Promote stable decisions to context,
rules, workflows, or ADRs rather than accumulating session history here.
