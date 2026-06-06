
import { MonthData } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MonthlyChartProps {
  data: MonthData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const incomeItems = payload.filter((p: any) => p.dataKey.startsWith('income_'));
  const expenseItems = payload.filter((p: any) => p.dataKey.startsWith('expense_'));
  const totalIncome = incomeItems.reduce((s: number, p: any) => s + (p.value || 0), 0);
  const totalExpense = expenseItems.reduce((s: number, p: any) => s + (p.value || 0), 0);
  const net = totalIncome - totalExpense;

  return (
    <div style={{
      padding: '10px 12px', minWidth: 180,
      background: 'rgba(255,255,255,0.94)',
      border: '1px solid var(--glass-border-hi)',
      backdropFilter: 'blur(16px) saturate(140%)',
      borderRadius: 12,
      boxShadow: '0 12px 32px -6px rgba(3,29,68,0.18), 0 1px 2px rgba(3,29,68,0.06)',
      pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, letterSpacing: '.10em',
        textTransform: 'uppercase', color: 'var(--fg-faint)', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 4, columnGap: 12, fontSize: 12 }}>
        <span style={{ color: 'var(--fg-muted)' }}>Income</span>
        <span className="num" style={{ textAlign: 'right', color: 'var(--pos)', fontWeight: 600 }}>
          Rp {totalIncome.toLocaleString('id-ID')}
        </span>
        <span style={{ color: 'var(--fg-muted)' }}>Expense</span>
        <span className="num" style={{ textAlign: 'right', color: 'var(--neg)', fontWeight: 600 }}>
          Rp {totalExpense.toLocaleString('id-ID')}
        </span>
        <span style={{ color: 'var(--fg-muted)', borderTop: '1px solid var(--glass-border)', paddingTop: 4, marginTop: 2 }}>
          Net
        </span>
        <span
          className="num"
          style={{
            textAlign: 'right', fontWeight: 600,
            color: net >= 0 ? 'var(--pos)' : 'var(--neg)',
            borderTop: '1px solid var(--glass-border)', paddingTop: 4, marginTop: 2,
          }}
        >
          Rp {Math.abs(net).toLocaleString('id-ID')}
        </span>
      </div>
    </div>
  );
};

export default function MonthlyChart({ data }: MonthlyChartProps) {
  const chartData = data.map(month => {
    const point: any = { month: month.monthName.slice(0, 3), fullMonth: month.monthName };
    month.income.forEach(c => { point[`income_${c.category}`] = c.amount; });
    month.expense.forEach(c => { point[`expense_${c.category}`] = c.amount; });
    point.totalIncome = month.totalIncome;
    point.totalExpense = month.totalExpense;
    return point;
  });

  const allCategories = new Map<string, { color: string; icon: string; type: string }>();
  data.forEach(month => {
    month.income.forEach(c => {
      if (!allCategories.has(`income_${c.category}`))
        allCategories.set(`income_${c.category}`, { color: c.color || '#70a288', icon: c.icon, type: 'income' });
    });
    month.expense.forEach(c => {
      if (!allCategories.has(`expense_${c.category}`))
        allCategories.set(`expense_${c.category}`, { color: c.color || '#d5896f', icon: c.icon, type: 'expense' });
    });
  });

  const incomeCats = Array.from(allCategories.entries()).filter(([, v]) => v.type === 'income');
  const expenseCats = Array.from(allCategories.entries()).filter(([, v]) => v.type === 'expense');

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={6}>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="rgba(3,29,68,0.07)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-inter)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-geist-mono, monospace)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            width={48}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(3,29,68,0.04)' }}
          />

          {incomeCats.map(([key, val]) => (
            <Bar key={key} dataKey={key} stackId="income" fill={val.color} radius={[3, 3, 0, 0]} maxBarSize={36} />
          ))}
          {expenseCats.map(([key, val]) => (
            <Bar key={key} dataKey={key} stackId="expense" fill={val.color} radius={[3, 3, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      {(incomeCats.length > 0 || expenseCats.length > 0) && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16, marginTop: 20, padding: '16px 0 0',
          borderTop: '1px solid var(--glass-border)',
        }}>
          {incomeCats.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--pos)', flexShrink: 0 }} />
                <span className="eyebrow">Income</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {incomeCats.map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: val.color, flexShrink: 0 }} />
                    {val.icon} {key.replace('income_', '')}
                  </div>
                ))}
              </div>
            </div>
          )}
          {expenseCats.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--neg)', flexShrink: 0 }} />
                <span className="eyebrow">Expense</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {expenseCats.map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: val.color, flexShrink: 0 }} />
                    {val.icon} {key.replace('expense_', '')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
