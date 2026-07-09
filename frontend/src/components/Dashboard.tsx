
import { useState, useEffect } from 'react';
import { MonthlyAnalytics } from '@/types';
import { getMonthlyAnalytics, getAvailableYears } from '@/lib/api';
import MonthlyChart from './MonthlyChart';
import CashflowLineChart from './CashflowLineChart';

interface DashboardProps {
  userId: number;
}

export default function Dashboard({ userId }: DashboardProps) {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line'>('line');

  useEffect(() => { loadAvailableYears(); }, [userId]);
  useEffect(() => { if (selectedYear) loadAnalytics(); }, [userId, selectedYear]);

  const loadAvailableYears = async () => {
    try {
      const years = await getAvailableYears(userId);
      setAvailableYears(years.length > 0 ? years : [new Date().getFullYear()]);
    } catch {
      setAvailableYears([new Date().getFullYear()]);
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      setAnalytics(await getMonthlyAnalytics(userId, selectedYear));
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass glass-card" style={{ padding: '24px 26px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <span className="eyebrow">Cashflow</span>
          <div style={{ fontSize: 18, fontWeight: 400, letterSpacing: '-.01em', color: 'var(--fg)', marginTop: 4 }}>
            {chartType === 'line' ? 'Income · Expense · Savings' : 'Income · Expense · Investment'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Chart type toggle */}
          <div className="seg" style={{ borderRadius: 999 }}>
            {(['line', 'bar'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                style={{
                  height: 28, padding: '0 14px', borderRadius: 999,
                  background: chartType === type ? 'var(--card)' : 'transparent',
                  color: chartType === type ? 'var(--fg)' : 'var(--fg-muted)',
                  boxShadow: chartType === type ? 'var(--card-shadow), 0 0 0 1px var(--card-border)' : 'none',
                  border: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}
              >
                {type === 'line' ? 'Line' : 'Bar'}
              </button>
            ))}
          </div>

          {/* Year picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {availableYears.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                style={{
                  height: 28, padding: '0 12px', borderRadius: 999,
                  background: y === selectedYear ? 'var(--card)' : 'transparent',
                  color: y === selectedYear ? 'var(--fg)' : 'var(--fg-muted)',
                  boxShadow: y === selectedYear ? 'var(--card-shadow), 0 0 0 1px var(--card-border)' : 'none',
                  border: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div style={{
          height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid transparent', borderTopColor: 'var(--laccent)',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : analytics ? (
        chartType === 'line'
          ? <CashflowLineChart data={analytics.months} />
          : <MonthlyChart data={analytics.months} />
      ) : null}
    </div>
  );
}
