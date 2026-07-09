
import { useState } from 'react';
import { MonthData } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Props {
  data: MonthData[];
}

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
const fmtShort = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000
      ? `${(v / 1_000).toFixed(0)}k`
      : String(v);

const SERIES = [
  { key: 'savings', label: 'Savings', color: '#4eca8b', gradId: 'grad-savings' },
  { key: 'expense', label: 'Expense', color: '#e86252', gradId: 'grad-expense' },
  { key: 'income',  label: 'Income',  color: '#5b9ec9', gradId: 'grad-income'  },
] as const;

const CustomTooltip = ({ active, payload, label, cumulative }: any) => {
  if (!active || !payload?.length) return null;
  const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0;
  const income  = get('income');
  const expense = get('expense');
  const savings = get('savings');

  return (
    <div style={{
      padding: '10px 12px', minWidth: 190,
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 12,
      boxShadow: 'var(--card-shadow)',
      pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, letterSpacing: '.10em',
        textTransform: 'uppercase', color: 'var(--fg-faint)', marginBottom: 8,
      }}>
        {label}{cumulative ? ' · YTD' : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 4, columnGap: 12, fontSize: 12 }}>
        <span style={{ color: 'var(--fg-muted)' }}>Income</span>
        <span className="num" style={{ textAlign: 'right', color: '#5b9ec9', fontWeight: 600 }}>{fmt(income)}</span>
        <span style={{ color: 'var(--fg-muted)' }}>Expense</span>
        <span className="num" style={{ textAlign: 'right', color: '#e86252', fontWeight: 600 }}>{fmt(expense)}</span>
        <span style={{ color: 'var(--fg-muted)', borderTop: '1px solid var(--card-border)', paddingTop: 4, marginTop: 2 }}>Savings</span>
        <span className="num" style={{
          textAlign: 'right', fontWeight: 600,
          color: savings >= 0 ? '#4eca8b' : '#e86252',
          borderTop: '1px solid var(--card-border)', paddingTop: 4, marginTop: 2,
        }}>
          {savings < 0 ? '-' : ''}{fmt(Math.abs(savings))}
        </span>
      </div>
    </div>
  );
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  height: 28, padding: '0 14px', borderRadius: 999,
  background: active ? 'var(--card)' : 'transparent',
  color: active ? 'var(--fg)' : 'var(--fg-muted)',
  boxShadow: active ? 'var(--card-shadow), 0 0 0 1px var(--card-border)' : 'none',
  border: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  transition: 'all 0.15s',
});

export default function CashflowLineChart({ data }: Props) {
  const [view, setView] = useState<'monthly' | 'cumulative'>('monthly');

  const monthlyPoints = data.map(m => {
    const inc = m.totalRealIncome ?? m.totalIncome;
    const exp = m.totalRealExpense ?? m.totalExpense;
    return { month: m.monthName.slice(0, 3), income: inc, expense: exp, savings: inc - exp };
  });

  let cumIncome = 0, cumExpense = 0;
  const cumulativePoints = data.map(m => {
    cumIncome  += m.totalRealIncome ?? m.totalIncome;
    cumExpense += m.totalRealExpense ?? m.totalExpense;
    return { month: m.monthName.slice(0, 3), income: cumIncome, expense: cumExpense, savings: cumIncome - cumExpense };
  });

  const points = view === 'monthly' ? monthlyPoints : cumulativePoints;

  return (
    <div>
      {/* Monthly / Cumulative toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div className="seg" style={{ width: 'auto', display: 'inline-flex', borderRadius: 999 }}>
          <button style={tabStyle(view === 'monthly')}    onClick={() => setView('monthly')}>Monthly</button>
          <button style={tabStyle(view === 'cumulative')} onClick={() => setView('cumulative')}>Cumulative</button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {SERIES.map(({ color, gradId }) => (
              <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.95 0.005 215 / 8%)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-inter)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-geist-mono, monospace)' }}
            axisLine={false} tickLine={false}
            tickFormatter={fmtShort}
            width={52}
          />
          <Tooltip content={<CustomTooltip cumulative={view === 'cumulative'} />} />
          {view === 'monthly' && (
            <ReferenceLine y={0} stroke="rgba(3,29,68,0.15)" strokeDasharray="3 3" />
          )}

          {/* Render savings and expense first so income line sits on top */}
          {SERIES.map(({ key, color, gradId }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 5.5, fill: color, strokeWidth: 2, stroke: 'var(--card)' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 20, marginTop: 16, padding: '14px 0 0',
        borderTop: '1px solid var(--card-border)',
        flexWrap: 'wrap',
      }}>
        {[...SERIES].reverse().map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--fg-muted)' }}>
            <span style={{ width: 20, height: 2.5, background: color, borderRadius: 999, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
