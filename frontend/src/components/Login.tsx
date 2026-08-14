import { useState, useEffect } from 'react';
import { login } from '@/lib/api';

const LOGIN_MSG: Record<string, string> = {
  google_unconfigured: 'Login Google belum aktif — pakai email + password dulu ya.',
  denied: 'Email ini belum diizinkan masuk. Hubungi admin.',
  error: 'Login Google gagal, coba lagi.',
};

// Login landing page. Email + password works now; the "Sign in with Google"
// button is a placeholder wired for a future /api/auth/google flow (needs the
// permanent link + Google OAuth credentials before it can be enabled).
export default function Login({ onSuccess, onBack }: { onSuccess: (email: string) => void; onBack?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Surface Google-callback outcomes passed back as ?login=…
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('login');
    if (code && LOGIN_MSG[code]) setError(LOGIN_MSG[code]);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const me = await login(email, password);
      onSuccess(me.email);
    } catch {
      setError('Email atau password salah.');
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px', fontSize: 14,
    borderRadius: 12, border: '1px solid var(--card-border)',
    background: 'var(--card, var(--background))', color: 'var(--fg)',
    outline: 'none', marginTop: 6,
  };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--fg-faint)' };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--background)', padding: 20,
    }}>
      <div className="glass glass-card" style={{ width: '100%', maxWidth: 380, padding: 32, borderRadius: 20 }}>
        {onBack && (
          <button type="button" onClick={onBack} style={{
            background: 'none', border: 'none', color: 'var(--fg-faint)', fontSize: 12.5,
            cursor: 'pointer', padding: 0, marginBottom: 8,
          }}>← kembali</button>
        )}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 30 }}>💸</div>
          <h1 className="display-heading" style={{ fontSize: 24, marginTop: 6 }}>Ledger</h1>
          <p style={{ color: 'var(--fg-faint)', fontSize: 13, marginTop: 4 }}>Masuk ke catatan keuanganmu</p>
        </div>

        <form onSubmit={submit}>
          <label style={label}>Email
            <input style={input} type="email" autoComplete="username" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="kamu@email.com" required autoFocus />
          </label>
          <div style={{ height: 14 }} />
          <label style={label}>Password
            <input style={input} type="password" autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </label>

          {error && <p style={{ color: 'var(--negative, #e5484d)', fontSize: 12.5, marginTop: 12 }}>{error}</p>}

          <button type="submit" disabled={busy} style={{
            width: '100%', height: 44, marginTop: 20, borderRadius: 12, border: 'none',
            background: 'var(--laccent, #3b6ea5)', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
          }}>
            {busy ? 'Masuk…' : 'Masuk'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
          <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>atau</span>
          <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
        </div>

        <button type="button"
          onClick={() => { window.location.href = '/api/auth/google'; }}
          style={{
            width: '100%', height: 44, borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--card, var(--background))', color: 'var(--fg)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
          <GoogleIcon /> Sign in with Google
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.8 6.1C12.2 13.4 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.4-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.5z" />
      <path fill="#FBBC05" d="M10.3 28.3c-.5-1.4-.7-2.9-.7-4.3s.3-3 .7-4.3l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.4z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.1-5.5c-2 1.3-4.6 2.1-7.9 2.1-6.4 0-11.8-3.9-13.7-9.4l-7.8 6.4C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}
