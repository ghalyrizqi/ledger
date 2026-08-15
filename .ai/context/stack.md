# Stack Context

Status: Current
Owner: Ghaly
Updated: 2026-08-15

## Runtime

- Node.js 22 from `/home/ghaly/.local/node-v22`.
- Yarn via Corepack; do not switch this repository to npm lockfiles.
- Backend: NestJS, TypeScript, `pg`, PostgreSQL, PM2.
- Frontend: React 19, Vite 6, TypeScript, Tailwind CSS 4, Recharts.
- Ingestion: Tesseract.js, Sharp, `pdf-parse`, and optional `pdftotext -layout`.

## Commands

- Backend build: `cd backend && yarn build`
- Backend development: `cd backend && yarn start:dev`
- Backend lint: `cd backend && yarn lint`
- Frontend build: `cd frontend && yarn build`
- Frontend development: `cd frontend && yarn dev`
- Pakemin validation: `pakemin validate . --adapters`

There is currently no automated test script in either package. Validate changes
with the relevant builds and targeted manual checks until tests are introduced.

## Tooling Notes

- Rebuild the frontend after UI changes because production serves its `dist`.
- PM2 and deployment are production concerns; do not reload or deploy merely to
  validate a local change.
- Use the existing standalone Node installation; Hermes was removed and must
  not be reintroduced.
