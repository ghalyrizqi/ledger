# AI Agent Rules

Status: Enforced
Owner: Ghaly
Updated: 2026-08-15

## Loading

Start with .ai/README.md, then read the context, rules, and workflow documents relevant to the task.

For deployment, authentication, Telegram, parsing, or database work, also read
`context/architecture.md`, `memory/active.md`, and `memory/known-issues.md`.

## Change Discipline

Do not invent project behavior. Prefer existing code, documentation, and ADRs.

Treat `.ai` as authoritative when the root README conflicts with current source.
Never read credential values merely to summarize configuration, and never print
secrets from `backend/.env`, PM2, logs, shell history, or process environments.

## Reporting

Report what changed, how it was validated, and any remaining risk.
