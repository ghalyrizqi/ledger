import { useState, useMemo } from 'react';
import { Transaction } from '@/types';

interface Props {
  transactions: Transaction[];
  selectedMonth: string;
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

interface Slice {
  cat: string;
  amt: number;
  pct: number;
  color: string;
  path: string;
}

function buildSlices(data: { cat: string; amt: number; pct: number; color: string }[], cx: number, cy: number, outerR: number, innerR: number, gap: number): Slice[] {
  let angle = -Math.PI / 2;
  return data.map(d => {
    const sweep = Math.max((d.pct / 100) * 2 * Math.PI - gap, 0.001);
    const start = angle + gap / 2;
    const end = start + sweep;
    angle = end + gap / 2;

    const large = sweep > Math.PI ? 1 : 0;
    const ox1 = cx + outerR * Math.cos(start);
    const oy1 = cy + outerR * Math.sin(start);
    const ox2 = cx + outerR * Math.cos(end);
    const oy2 = cy + outerR * Math.sin(end);
    const ix1 = cx + innerR * Math.cos(end);
    const iy1 = cy + innerR * Math.sin(end);
    const ix2 = cx + innerR * Math.cos(start);
    const iy2 = cy + innerR * Math.sin(start);

    const path = `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    return { ...d, path };
  });
}

export default function CategoryDonut({ transactions, selectedMonth }: Props) {
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  const data = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (t.is_transfer) return false;
      if (t.type !== activeType) return false;
      if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return false;
      return true;
    });

    const map = new Map<string, number>();
    for (const t of filtered) {
      const cat = t.category || 'Uncategorized';
      map.set(cat, (map.get(cat) ?? 0) + t.amount);
    }

    const sorted = Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const total = sorted.reduce((s, [, v]) => s + v, 0);
    return sorted.map(([cat, amt], i) => ({
      cat,
      amt,
      pct: total > 0 ? (amt / total) * 100 : 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [transactions, selectedMonth, activeType]);

  const total = data.reduce((s, d) => s + d.amt, 0);

  if (data.length === 0 && transactions.filter(t => !t.is_transfer).length === 0) return null;

  const CX = 90, CY = 90;
  const slices = data.length > 0 ? buildSlices(data, CX, CY, 72, 44, data.length === 1 ? 0 : 0.022) : [];

  const hovered = hoveredCat ? data.find(d => d.cat === hoveredCat) : null;

  return (
    <div style={{
      background: 'var(--glass)',
      border: '1px solid var(--card-border)',
      borderRadius: 18,
      padding: '22px 24px',
      backdropFilter: 'blur(18px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🥧</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>Kategori</span>
        </div>
        {/* Toggle expense / income */}
        <div style={{
          display: 'flex', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--card-border)', fontSize: 12,
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

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-faint)', fontSize: 13 }}>
          Tidak ada data untuk ditampilkan
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Donut SVG */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width={180} height={180} viewBox="0 0 180 180">
              {slices.map(s => (
                <path
                  key={s.cat}
                  d={s.path}
                  fill={s.color}
                  opacity={hoveredCat === null || hoveredCat === s.cat ? 1 : 0.3}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                  onMouseEnter={() => setHoveredCat(s.cat)}
                  onMouseLeave={() => setHoveredCat(null)}
                />
              ))}
            </svg>
            {/* Center label */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              {hovered ? (
                <>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2, maxWidth: 70, textAlign: 'center', lineHeight: 1.2 }}>
                    {hovered.cat}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: activeType === 'expense' ? 'var(--neg)' : 'var(--pos)' }}>
                    {fmt(hovered.amt)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>
                    {hovered.pct.toFixed(1)}%
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>
                    {activeType === 'expense' ? 'Total' : 'Total'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: activeType === 'expense' ? 'var(--neg)' : 'var(--pos)' }}>
                    {fmt(total)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.map(d => (
              <div
                key={d.cat}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'default',
                  opacity: hoveredCat === null || hoveredCat === d.cat ? 1 : 0.35,
                  transition: 'opacity 0.15s',
                  padding: '3px 0',
                }}
                onMouseEnter={() => setHoveredCat(d.cat)}
                onMouseLeave={() => setHoveredCat(null)}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                  background: d.color,
                }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--fg)', fontWeight: 500, lineHeight: 1.2 }}>
                  {d.cat}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>
                    {fmt(d.amt)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)', marginLeft: 4 }}>
                    {d.pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}

            {/* Total row */}
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
