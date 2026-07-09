import { useMemo } from 'react';
import { Transaction } from '@/types';

interface Props {
  transactions: Transaction[];
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return n.toLocaleString('id-ID');
}

function fmtFull(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function SalaryCard({ transactions }: Props) {
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.category !== 'Salary') continue;
      const ym = t.date.substring(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, total]) => ({ ym, total }));
  }, [transactions]);

  if (monthlyData.length === 0) return null;

  const avg = monthlyData.reduce((s, m) => s + m.total, 0) / monthlyData.length;
  const latest = monthlyData[monthlyData.length - 1];
  const maxVal = Math.max(...monthlyData.map(m => m.total));

  return (
    <div style={{
      background: 'var(--glass)',
      border: '1px solid var(--card-border)',
      borderRadius: 18,
      padding: '22px 24px',
      // backdrop removed
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>💰</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>Gaji Bulanan</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Rata-rata / bulan</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)' }}>{fmtFull(avg)}</div>
        </div>
      </div>

      {/* Monthly bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {monthlyData.map(({ ym, total }) => {
          const [year, mm] = ym.split('-');
          const label = `${MONTH_LABELS[mm]} ${year}`;
          const pct = (total / maxVal) * 100;
          const isLatest = ym === latest.ym;

          return (
            <div key={ym} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 52, fontSize: 11, fontWeight: isLatest ? 700 : 500,
                color: isLatest ? 'var(--fg)' : 'var(--fg-muted)', flexShrink: 0,
              }}>
                {label}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 20, background: 'var(--surface-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: isLatest
                    ? 'linear-gradient(90deg, var(--pos), rgba(95,160,122,0.7))'
                    : 'rgba(95,160,122,0.35)',
                  borderRadius: 6,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{
                width: 70, fontSize: 12, fontWeight: isLatest ? 700 : 500,
                color: isLatest ? 'var(--pos)' : 'var(--fg-muted)',
                textAlign: 'right', flexShrink: 0,
              }}>
                {fmt(total)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Latest month callout */}
      <div style={{
        marginTop: 16, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(95,160,122,0.07)', border: '1px solid rgba(95,160,122,0.18)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
          Terakhir diterima · {MONTH_LABELS[latest.ym.split('-')[1]]} {latest.ym.split('-')[0]}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)' }}>
          {fmtFull(latest.total)}
        </span>
      </div>
    </div>
  );
}
