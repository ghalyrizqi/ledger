// pm2 process definitions for the ledger app.
// Single origin: the backend serves the built frontend (frontend/dist) AND the
// API (under /api) on 127.0.0.1:3001. Remote access points at that one port
// (SSH tunnel / Tailscale) — never a public port on this box.
// Rebuild the frontend (`cd frontend && yarn build`) after UI changes; the
// backend serves the fresh dist. Rebuild the backend after backend changes.
module.exports = {
  apps: [
    {
      name: 'ledger-backend',
      cwd: './backend',
      script: 'dist/main.js',      // built output; `yarn build` before reload
      env: { NODE_ENV: 'production' },
      // backend/.env supplies DATABASE_URL + LEDGER_TG_* (loaded via dotenv)
    },
    {
      // Public HTTPS link via a Cloudflare quick tunnel (free, no account).
      // Outbound only — never opens a public port. Texts the current link to
      // the owner's Telegram on (re)start, since the trycloudflare URL rotates.
      name: 'ledger-tunnel',
      script: 'ops/tunnel.sh',
      interpreter: 'bash',
    },
  ],
};
