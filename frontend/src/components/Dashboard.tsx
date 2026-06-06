
import { useState, useEffect } from 'react';
import { MonthlyAnalytics } from '@/types';
import { getMonthlyAnalytics, getAvailableYears } from '@/lib/api';
import MonthlyChart from './MonthlyChart';

interface DashboardProps {
  userId: number;
}

export default function Dashboard({ userId }: DashboardProps) {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

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
            Income vs. expense
          </div>
        </div>

        {/* Year picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              style={{
                height: 30, padding: '0 14px', borderRadius: 999,
                background: y === selectedYear ? '#fff' : 'transparent',
                color: y === selectedYear ? 'var(--fg)' : 'var(--fg-muted)',
                boxShadow: y === selectedYear ? '0 1px 2px rgba(3,29,68,0.10), 0 0 0 1px var(--glass-border)' : 'none',
                border: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {y}
            </button>
          ))}
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
        <MonthlyChart data={analytics.months} />
      ) : null}
    </div>
  );
}
