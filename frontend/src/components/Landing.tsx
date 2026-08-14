import { ScanLine, Wallet, LineChart } from 'lucide-react';

// Public landing page shown before login: landing → login → dashboard.
// Uses the shared design tokens (Hallmark executive theme) and clamp() sizing
// so it reads well from phone to desktop with no media queries.
export default function Landing({ onStart }: { onStart: () => void }) {
  const features = [
    { Icon: ScanLine, title: 'Foto struk, beres', desc: 'Kirim screenshot ke Telegram, transaksi masuk otomatis.' },
    { Icon: Wallet, title: 'Semua dompet', desc: 'Bank, e-wallet, tunai, investasi — dalam satu tempat.' },
    { Icon: LineChart, title: 'Lihat ke mana uangmu', desc: 'Ringkasan cashflow & kategori tiap bulan.' },
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'var(--background)',
      padding: 'clamp(24px, 5vw, 56px) 20px', gap: 40, textAlign: 'center',
    }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        {/* Logo */}
        <div style={{
          width: 52, height: 52, borderRadius: 15, margin: '0 auto 22px',
          background: 'var(--gradient-income)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px oklch(1 0 0 / 0.2) inset, 0 8px 24px var(--accent-glow)',
        }}>
          <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
            <path d="M3 11 L7 5 L9.5 8.5 L13 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="13" cy="3" r="1.5" fill="white" />
          </svg>
        </div>

        <span className="eyebrow">Personal finance</span>
        <h1 className="display-heading" style={{
          fontSize: 'clamp(30px, 8vw, 48px)', lineHeight: 1.08, marginTop: 8,
          letterSpacing: '-0.03em',
        }}>
          Uang kamu, <br />rapi tanpa ribet.
        </h1>
        <p style={{
          color: 'var(--fg-faint)', fontSize: 'clamp(14px, 3.6vw, 16px)',
          maxWidth: 420, margin: '16px auto 0', lineHeight: 1.55,
        }}>
          Catat pemasukan & pengeluaran buat kamu dan Intan — cukup foto struk atau ketik singkat lewat Telegram.
        </p>

        <button onClick={onStart} style={{
          marginTop: 28, height: 50, padding: '0 30px', borderRadius: 14, border: 'none',
          background: 'var(--laccent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 0 0 1px oklch(1 0 0 / 0.18) inset, 0 6px 20px var(--accent-glow)',
          width: 'min(100%, 260px)',
        }}>
          Masuk →
        </button>
      </div>

      {/* Feature cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14, width: '100%', maxWidth: 720,
      }}>
        {features.map(({ Icon, title, desc }) => (
          <div key={title} className="glass glass-card" style={{ padding: 18, textAlign: 'left', borderRadius: 16 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, marginBottom: 10,
              background: 'var(--accent-soft)', color: 'var(--laccent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon style={{ width: 17, height: 17 }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-faint)', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      <footer style={{ color: 'var(--fg-faint)', fontSize: 11 }}>
        Ledger · privat & aman · paper-free finance
      </footer>
    </div>
  );
}
