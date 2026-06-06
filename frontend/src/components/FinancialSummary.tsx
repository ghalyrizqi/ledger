
import { FinancialSummary } from '@/types';

interface FinancialSummaryProps {
  summary: FinancialSummary;
  initialBalance?: number;
  onEditInitialBalance?: () => void;
}

function fmt(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  onEdit,
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: 'neutral' | 'pos' | 'neg';
  onEdit?: () => void;
  icon: React.ReactNode;
}) {
  const valueColor = tone === 'pos' ? 'var(--pos)' : tone === 'neg' ? 'var(--neg)' : 'var(--fg)';
  const bgGradient =
    tone === 'pos'
      ? 'radial-gradient(120% 80% at 0% 0%, var(--pos-soft), transparent 55%)'
      : tone === 'neg'
      ? 'radial-gradient(120% 80% at 0% 0%, var(--neg-soft), transparent 55%)'
      : 'radial-gradient(120% 80% at 0% 0%, rgba(3,29,68,0.04), transparent 55%)';

  return (
    <div
      className="glass glass-card"
      style={{
        display: 'flex', flexDirection: 'column', gap: 14,
        position: 'relative', overflow: 'hidden', padding: '20px 22px',
      }}
    >
      {/* Inner radial tint */}
      <div style={{ position: 'absolute', inset: 0, background: bgGradient, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span className="eyebrow">{label}</span>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: 'rgba(3,29,68,0.04)', border: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg-muted)',
        }}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div
        className="num"
        style={{
          fontSize: 'clamp(18px, 2.4cqi + 12px, 30px)',
          fontWeight: 600,
          letterSpacing: '-.02em',
          color: valueColor,
          position: 'relative',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {fmt(value)}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {hint && <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{hint}</span>}
        {onEdit && (
          <button
            onClick={onEdit}
            className="chip chip-accent"
            style={{ cursor: 'pointer', border: 'none', background: 'var(--accent-soft)' }}
          >
            ✏ Edit
          </button>
        )}
      </div>
    </div>
  );
}

export default function FinancialSummaryComponent({
  summary,
  initialBalance = 0,
  onEditInitialBalance,
}: FinancialSummaryProps) {
  const savings = summary.totalIncome - summary.totalExpense;
  const currentBalance = initialBalance + savings;

  const cards = [
    {
      label: 'Initial Balance',
      value: initialBalance,
      tone: 'neutral' as const,
      onEdit: onEditInitialBalance,
      icon: <IconWallet />,
    },
    {
      label: 'Income',
      value: summary.totalIncome,
      tone: 'pos' as const,
      icon: <IconArrowDown />,
    },
    {
      label: 'Expense',
      value: summary.totalExpense,
      tone: 'neg' as const,
      icon: <IconArrowUp />,
    },
    {
      label: 'Savings',
      value: savings,
      tone: savings >= 0 ? ('pos' as const) : ('neg' as const),
      hint: summary.totalIncome > 0
        ? `${((savings / summary.totalIncome) * 100).toFixed(1)}% rate`
        : undefined,
      icon: <IconPiggy />,
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Four summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {cards.map(c => (
          <SummaryCard key={c.label} {...c} />
        ))}
      </div>

      {/* Current balance — full-width */}
      <div
        className="glass glass-card"
        style={{
          padding: '26px 28px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr)',
          gap: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(60% 100% at 100% 50%, var(--accent-soft), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <span className="eyebrow">Current Balance · Initial + Savings</span>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10, flexWrap: 'wrap',
          }}>
            <div
              className="num"
              style={{
                fontSize: 'clamp(28px, 4vw, 48px)',
                fontWeight: 600,
                letterSpacing: '-.025em',
                lineHeight: 1,
                color: currentBalance >= 0 ? 'var(--fg)' : 'var(--neg)',
              }}
            >
              {fmt(currentBalance)}
            </div>
            <span className={savings >= 0 ? 'chip chip-pos' : 'chip chip-neg'}>
              {savings >= 0 ? '↑' : '↓'} {fmt(Math.abs(savings))} saved
            </span>
          </div>
          <div style={{
            display: 'flex', gap: 20, marginTop: 12,
            color: 'var(--fg-subtle)', fontSize: 12.5, flexWrap: 'wrap',
          }}>
            <span>
              <span style={{ color: 'var(--fg-muted)' }}>Income </span>
              <span className="num" style={{ color: 'var(--pos)' }}>{fmt(summary.totalIncome)}</span>
            </span>
            <span style={{ color: 'var(--glass-border-hi)' }}>·</span>
            <span>
              <span style={{ color: 'var(--fg-muted)' }}>Expense </span>
              <span className="num" style={{ color: 'var(--neg)' }}>{fmt(summary.totalExpense)}</span>
            </span>
            <span style={{ color: 'var(--glass-border-hi)' }}>·</span>
            <span>
              <span style={{ color: 'var(--fg-muted)' }}>Started with </span>
              <span className="num">{fmt(initialBalance)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────── */
function IconWallet() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="12" height="9" rx="1.5" />
      <path d="M11 8.5h2" />
    </svg>
  );
}
function IconArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v9M4.5 8.5 8 12l3.5-3.5" />
    </svg>
  );
}
function IconArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V4M4.5 7.5 8 4l3.5 3.5" />
    </svg>
  );
}
function IconPiggy() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 9c0-2.2 2-4 4.5-4h3c2.5 0 4.5 1.8 4.5 4 0 1.4-.8 2.7-2 3.4V14h-2v-1h-3v1H5.5v-1.6C3.8 11.7 2.5 10.4 2.5 9z" />
      <circle cx="11" cy="8" r=".5" fill="currentColor" />
    </svg>
  );
}
