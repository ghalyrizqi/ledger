import { FinancialSummary } from '@/types';

interface FinancialSummaryProps {
  summary: FinancialSummary;
}

function fmt(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}M`;
  return fmt(n);
}

interface StatCardProps {
  label: string;
  value: number;
  hint?: string;
  accent: string;     // vivid accent CSS value (color of strip, icon, number)
  accentSoft: string; // low-opacity tint for bg glow
  icon: React.ReactNode;
}

function StatCard({ label, value, hint, accent, accentSoft, icon }: StatCardProps) {
  return (
    <div
      className="glass glass-card"
      style={{
        display: 'flex', flexDirection: 'column', gap: 14,
        padding: '20px 22px',
        position: 'relative', overflow: 'hidden',
        border: `1px solid color-mix(in oklch, ${accent} 40%, transparent)`,
      }}
    >
      {/* Background gradient glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(110% 90% at 100% 100%, color-mix(in oklch, ${accent} 17%, transparent), transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span className="eyebrow">{label}</span>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: `color-mix(in oklch, ${accent} 17%, transparent)`,
          border: `1px solid color-mix(in oklch, ${accent} 30%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent,
        }}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(17px, 2.4cqi + 10px, 28px)',
        fontWeight: 700,
        letterSpacing: '-0.025em',
        color: accent,
        lineHeight: 1.1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        position: 'relative',
      }}>
        {fmtCompact(value)}
      </div>

      {/* Hint */}
      {hint && (
        <span style={{ fontSize: 11.5, color: 'var(--fg-faint)', marginTop: -6, position: 'relative' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export default function FinancialSummaryComponent({ summary }: FinancialSummaryProps) {
  const savings = summary.totalIncome - summary.totalExpense;
  const savingsRate = summary.totalIncome > 0
    ? ((savings / summary.totalIncome) * 100).toFixed(1)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Three stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
      }}>
        <StatCard
          label="Income"
          value={summary.totalIncome}
          accent="var(--laccent)"
          accentSoft="var(--accent-soft)"
          icon={<IconArrowDown />}
        />
        <StatCard
          label="Expense"
          value={summary.totalExpense}
          accent="var(--neg)"
          accentSoft="var(--neg-soft)"
          icon={<IconArrowUp />}
        />
        <StatCard
          label="Savings"
          value={savings}
          hint={savingsRate ? `${savingsRate}% savings rate` : undefined}
          accent="var(--pos)"
          accentSoft="var(--pos-soft)"
          icon={<IconPiggy />}
        />
      </div>

      {/* Net Flow — full-width accent card */}
      <div
        className="glass glass-card"
        style={{
          padding: '22px 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          position: 'relative',
          overflow: 'hidden',
          border: savings >= 0
            ? '1px solid color-mix(in oklch, var(--pos) 40%, transparent)'
            : '1px solid color-mix(in oklch, var(--neg) 40%, transparent)',
        }}
      >
        {/* Subtle teal glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(55% 90% at 100% 50%, var(--accent-soft), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Left: label + big number */}
        <div style={{ position: 'relative' }}>
          <span className="eyebrow">Net Flow</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(24px, 4vw, 42px)',
              fontWeight: 700,
              letterSpacing: '-0.030em',
              lineHeight: 1,
              color: savings >= 0 ? 'var(--fg)' : 'var(--neg)',
            }}>
              {fmt(savings)}
            </div>
            <span className={savings >= 0 ? 'chip chip-pos' : 'chip chip-neg'}>
              {savings >= 0 ? '↑ surplus' : '↓ deficit'}
            </span>
          </div>
        </div>

        {/* Right: breakdown */}
        <div style={{
          display: 'flex', gap: 24,
          color: 'var(--fg-muted)', fontSize: 12.5, flexWrap: 'wrap',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: 'var(--fg-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Income</span>
            <span className="num" style={{ color: 'var(--pos)', fontWeight: 600, fontSize: 14 }}>{fmt(summary.totalIncome)}</span>
          </div>
          <div style={{ width: 1, background: 'var(--card-border)', alignSelf: 'stretch' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: 'var(--fg-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Expense</span>
            <span className="num" style={{ color: 'var(--neg)', fontWeight: 600, fontSize: 14 }}>{fmt(summary.totalExpense)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v9M4.5 8.5 8 12l3.5-3.5" />
    </svg>
  );
}
function IconArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V4M4.5 7.5 8 4l3.5 3.5" />
    </svg>
  );
}
function IconPiggy() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 9c0-2.2 2-4 4.5-4h3c2.5 0 4.5 1.8 4.5 4 0 1.4-.8 2.7-2 3.4V14h-2v-1h-3v1H5.5v-1.6C3.8 11.7 2.5 10.4 2.5 9z" />
      <circle cx="11" cy="8" r=".5" fill="currentColor" />
    </svg>
  );
}
