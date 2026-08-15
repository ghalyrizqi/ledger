# Engineering Rules

Status: Enforced
Owner: Ghaly
Updated: 2026-08-15

## Change Rules

- Inspect current code before relying on stale README claims.
- Keep changes scoped and preserve the clean-tree requirement used by deploys.
- Never expose secrets or bind production services to `0.0.0.0`.
- Keep Telegram parsing deterministic; add or tune parsers and regexes instead
  of calling an LLM at runtime.
- Validate imported dates and amounts before database writes.
- Do not edit production environment values or restart PM2 unless the task
  explicitly requires a deployment or operational change.

## Testing Rules

- Backend changes: run `cd backend && yarn build`; run lint when applicable.
- Frontend changes: run `cd frontend && yarn build`.
- Parser changes: exercise representative valid, malformed, and duplicate input.
- Portable-core changes: run `pakemin validate . --adapters`.
- Report missing test coverage; do not imply tests passed when no test suite exists.

## Documentation Rules

Update `.ai` when architecture, deployment, security constraints, active work,
or durable decisions change. Keep vendor adapters thin and do not copy portable
knowledge into `AGENTS.md`, `CLAUDE.md`, or other adapter files.
