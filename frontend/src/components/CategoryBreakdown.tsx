import { useState, useEffect, useMemo } from 'react';
import { Transaction, Wallet } from '@/types';
import { getWallets } from '@/lib/api';

interface Props {
  userId: number;
  transactions: Transaction[];
}

const PALETTE = [
  '#e07b4f', '#4a90d9', '#5fa07a', '#a06fc9', '#d4b44a',
  '#e05a7a', '#5ac8c8', '#8c7a5f', '#6bc96b', '#c96b6b',
  '#7a9fd4', '#d48a7a',
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return n.toLocaleString('id-ID');
}

function fmtFull(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function buildSlices(
  data: { cat: string; amt: number; pct: number; color: string }[],
  cx: number, cy: number, outerR: number, innerR: number, gap: number,
) {
  let angle = -Math.PI / 2;
  return data.map(d => {
    const sweep = Math.max((d.pct / 100) * 2 * Math.PI - gap, 0.001);
    const start = angle + gap / 2;
    const end = start + sweep;
    angle = end + gap / 2;
    const large = sweep > Math.PI ? 1 : 0;
    const ox1 = cx + outerR * Math.cos(start), oy1 = cy + outerR * Math.sin(start);
    const ox2 = cx + outerR * Math.cos(end),   oy2 = cy + outerR * Math.sin(end);
    const ix1 = cx + innerR * Math.cos(end),   iy1 = cy + innerR * Math.sin(end);
    const ix2 = cx + innerR * Math.cos(start), iy2 = cy + innerR * Math.sin(start);
    const path = `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    return { ...d, path };
  });
}

const MONTH_LABEL = (m: string) =>
  new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export default function CategoryBreakdown({ userId, transactions }: Props) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  useEffect(() => {
    getWallets(userId).then(setWallets).catch(() => {});
  }, [userId]);

  // Only months that have transactions for the selected wallet
  const availableMonths = useMemo(() => {
    const base = selectedWallet === 'all'
      ? transactions
      : transactions.filter(t => t.wallet_id === selectedWallet);
    const months = new Set<string>();
    base.forEach(t => months.add(t.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions, selectedWallet]);

  // Reset month if it's no longer available after wallet change
  useEffect(() => {
    if (selectedMonth !== 'all' && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth('all');
    }
  }, [availableMonths]);

  // Only wallets that have transactions
  const activeWallets = useMemo(() => {
    const ids = new Set(transactions.map(t => t.wallet_id).filter(Boolean));
    return wallets.filter(w => ids.has(w.id));
  }, [wallets, transactions]);

  const data = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (t.is_transfer) return false;
      if (t.type !== activeType) return false;
      if (selectedWallet !== 'all' && t.wallet_id !== selectedWallet) return false;
      if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return false;
      return true;
    });

    const map = new Map<string, number>();
    for (const t of filtered) {
      const cat = t.category || 'Uncategorized';
      map.set(cat, (map.get(cat) ?? 0) + t.amount);
    }

    const sorted = Array.from(map.entries()).sort(([, a], [, b]) => b - a).slice(0, 12);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    return sorted.map(([cat, amt], i) => ({
      cat, amt,
      pct: total > 0 ? (amt / total) * 100 : 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [transactions, selectedWallet, selectedMonth, activeType]);

  const total = data.reduce((s, d) => s + d.amt, 0);
  const CX = 90, CY = 90;
  const slices = data.length > 0
    ? buildSlices(data, CX, CY, 72, 44, data.length === 1 ? 0 : 0.022)
    : [];
  const hovered = hoveredCat ? data.find(d => d.cat === hoveredCat) : null;

  const pill = (active: boolean, onClick: () => void, label: string, color?: string) => (
    <button
      onClick={onClick}
      style={{
        height: 26, padding: '0 11px', borderRadius: 999, fontSize: 11, fontWeight: active ? 600 : 400,
        cursor: 'pointer', border: 0, whiteSpace: 'nowrap', flexShrink: 0,
        background: active ? (color ?? 'var(--card)') : 'transparent',
        color: active ? 'var(--fg)' : 'var(--fg-muted)',
        boxShadow: active ? 'var(--card-shadow), 0 0 0 1px var(--card-border)' : 'none',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="glass glass-card" style={{ padding: '24px 26px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">Categories</span>
          <div style={{ fontSize: 18, fontWeight: 400, letterSpacing: '-.01em', color: 'var(--fg)', marginTop: 4 }}>
            Breakdown per wallet &amp; month
          </div>
        </div>
        {/* Expense / Income toggle */}
        <div style={{
          display: 'flex', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--card-border)', fontSize: 12, alignSelf: 'flex-start',
        }}>
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              style={{
                padding: '5px 14px', border: 'none', cursor: 'pointer',
                background: activeType === t
                  ? (t === 'expense' ? 'rgba(224,123,79,0.18)' : 'rgba(95,160,122,0.18)')
                  : 'transparent',
                color: activeType === t
                  ? (t === 'expense' ? 'var(--neg)' : 'var(--pos)')
                  : 'var(--fg-muted)',
                fontWeight: activeType === t ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
            </button>
          ))}
        </div>
      </div>

      {/* Wallet filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', alignSelf: 'center', marginRight: 2 }}>Wallet</span>
        {pill(selectedWallet === 'all', () => setSelectedWallet('all'), 'All')}
        {activeWallets.map(w =>
          pill(selectedWallet === w.id, () => setSelectedWallet(w.id), w.name)
        )}
      </div>

      {/* Month filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', alignSelf: 'center', marginRight: 2 }}>Month</span>
        {pill(selectedMonth === 'all', () => setSelectedMonth('all'), 'All')}
        {availableMonths.map(m =>
          pill(selectedMonth === m, () => setSelectedMonth(m), MONTH_LABEL(m))
        )}
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-faint)', fontSize: 13 }}>
          No data for this selection
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Donut */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width={180} height={180} viewBox="0 0 180 180">
              {slices.map(s => (
                <path
                  key={s.cat}
                  d={s.path}
                  fill={s.color}
                  opacity={hoveredCat === null || hoveredCat === s.cat ? 1 : 0.28}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                  onMouseEnter={() => setHoveredCat(s.cat)}
                  onMouseLeave={() => setHoveredCat(null)}
                />
              ))}
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              {hovered ? (
                <>
                  <div style={{ fontSize: 10, color: 'var(--fg-muted)', maxWidth: 68, textAlign: 'center', lineHeight: 1.2, marginBottom: 2 }}>
                    {hovered.cat}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: activeType === 'expense' ? 'var(--neg)' : 'var(--pos)' }}>
                    {fmt(hovered.amt)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 1 }}>
                    {hovered.pct.toFixed(1)}%
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginBottom: 2 }}>Total</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: activeType === 'expense' ? 'var(--neg)' : 'var(--pos)' }}>
                    {fmt(total)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {data.map(d => (
              <div
                key={d.cat}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', padding: '3px 0',
                  opacity: hoveredCat === null || hoveredCat === d.cat ? 1 : 0.3,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={() => setHoveredCat(d.cat)}
                onMouseLeave={() => setHoveredCat(null)}
              >
                <div style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: d.color }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--fg)', fontWeight: 500, lineHeight: 1.2 }}>
                  {d.cat}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{fmt(d.amt)}</span>
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)', marginLeft: 4 }}>{d.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 6, paddingTop: 8,
              borderTop: '1px solid var(--card-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: activeType === 'expense' ? 'var(--neg)' : 'var(--pos)' }}>
                {fmtFull(total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
