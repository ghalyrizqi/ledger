
import { MonthData } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

interface MonthlyChartProps {
  data: MonthData[];
}

// Categories pulled out of income/expense into the Investment stack
const INVEST_INCOME_CATS  = new Set(['Investment Return', 'Dividend', 'Investment']);
const INVEST_EXPENSE_CATS = new Set(['Investment']);

function isInvestCat(type: 'income' | 'expense', category: string) {
  return type === 'income'
    ? INVEST_INCOME_CATS.has(category)
    : INVEST_EXPENSE_CATS.has(category);
}

function fmt(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const income  = payload.filter((p: any) => p.dataKey.startsWith('income_')).reduce((s: number, p: any) => s + (p.value || 0), 0);
  const expense = payload.filter((p: any) => p.dataKey.startsWith('expense_')).reduce((s: number, p: any) => s + (p.value || 0), 0);
  const invest  = payload.filter((p: any) => p.dataKey.startsWith('invest_')).reduce((s: number, p: any) => s + (p.value || 0), 0);
  const net = income - expense;

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
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 4, columnGap: 12, fontSize: 12 }}>
        <span style={{ color: 'var(--fg-muted)' }}>Income</span>
        <span className="num" style={{ textAlign: 'right', color: 'var(--pos)', fontWeight: 600 }}>{fmt(income)}</span>
        <span style={{ color: 'var(--fg-muted)' }}>Expense</span>
        <span className="num" style={{ textAlign: 'right', color: 'var(--neg)', fontWeight: 600 }}>{fmt(expense)}</span>
        {invest > 0 && <>
          <span style={{ color: 'var(--fg-muted)' }}>Investment</span>
          <span className="num" style={{ textAlign: 'right', color: '#38bdf8', fontWeight: 600 }}>{fmt(invest)}</span>
        </>}
        <span style={{ color: 'var(--fg-muted)', borderTop: '1px solid var(--card-border)', paddingTop: 4, marginTop: 2 }}>Net</span>
        <span className="num" style={{
          textAlign: 'right', fontWeight: 600,
          color: net >= 0 ? 'var(--pos)' : 'var(--neg)',
          borderTop: '1px solid var(--card-border)', paddingTop: 4, marginTop: 2,
        }}>
          {fmt(Math.abs(net))}
        </span>
      </div>
    </div>
  );
};

export default function MonthlyChart({ data }: MonthlyChartProps) {
  const chartData = data.map(month => {
    const point: any = { month: month.monthName.slice(0, 3), fullMonth: month.monthName };
    month.income.forEach(c => {
      const key = isInvestCat('income', c.category) ? `invest_${c.category}` : `income_${c.category}`;
      point[key] = c.amount;
    });
    month.expense.forEach(c => {
      const key = isInvestCat('expense', c.category) ? `invest_${c.category}` : `expense_${c.category}`;
      point[key] = c.amount;
    });
    return point;
  });

  const incomeCats  = new Map<string, { color: string; icon: string }>();
  const expenseCats = new Map<string, { color: string; icon: string }>();
  const investCats  = new Map<string, { color: string; icon: string }>();

  data.forEach(month => {
    month.income.forEach(c => {
      const key = `income_${c.category}`;
      if (isInvestCat('income', c.category)) {
        if (!investCats.has(`invest_${c.category}`))
          investCats.set(`invest_${c.category}`, { color: '#38bdf8', icon: c.icon });
      } else {
        if (!incomeCats.has(key))
          incomeCats.set(key, { color: c.color || '#5b9ec9', icon: c.icon });
      }
    });
    month.expense.forEach(c => {
      const key = `expense_${c.category}`;
      if (isInvestCat('expense', c.category)) {
        if (!investCats.has(`invest_${c.category}`))
          investCats.set(`invest_${c.category}`, { color: '#38bdf8', icon: c.icon });
      } else {
        if (!expenseCats.has(key))
          expenseCats.set(key, { color: c.color || '#e86252', icon: c.icon });
      }
    });
  });

  const incomeEntries  = Array.from(incomeCats.entries());
  const expenseEntries = Array.from(expenseCats.entries());
  const investEntries  = Array.from(investCats.entries());

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.95 0.005 215 / 8%)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-inter)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-geist-mono, monospace)' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(0.95 0.005 215 / 5%)' }} />

          {incomeEntries.map(([key, val]) => (
            <Bar key={key} dataKey={key} stackId="income" fill={val.color} radius={[3, 3, 0, 0]} maxBarSize={32} />
          ))}
          {expenseEntries.map(([key, val]) => (
            <Bar key={key} dataKey={key} stackId="expense" fill={val.color} radius={[3, 3, 0, 0]} maxBarSize={32} />
          ))}
          {investEntries.map(([key, val]) => (
            <Bar key={key} dataKey={key} stackId="invest" fill={val.color} radius={[3, 3, 0, 0]} maxBarSize={32} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      {(incomeEntries.length > 0 || expenseEntries.length > 0 || investEntries.length > 0) && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16, marginTop: 20, padding: '16px 0 0',
          borderTop: '1px solid var(--card-border)',
        }}>
          {incomeEntries.length > 0 && (
            <LegendGroup title="Income" dotColor="var(--pos)" items={incomeEntries} prefix="income_" />
          )}
          {expenseEntries.length > 0 && (
            <LegendGroup title="Expense" dotColor="var(--neg)" items={expenseEntries} prefix="expense_" />
          )}
          {investEntries.length > 0 && (
            <LegendGroup title="Investment" dotColor="#38bdf8" items={investEntries} prefix="invest_" />
          )}
        </div>
      )}
    </div>
  );
}

function LegendGroup({ title, dotColor, items, prefix }: {
  title: string;
  dotColor: string;
  items: [string, { color: string; icon: string }][];
  prefix: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: dotColor, flexShrink: 0 }} />
        <span className="eyebrow">{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: val.color, flexShrink: 0 }} />
            {val.icon} {key.replace(prefix, '')}
          </div>
        ))}
      </div>
    </div>
  );
}
