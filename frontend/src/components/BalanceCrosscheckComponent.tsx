
import { useState, useEffect } from 'react';
import { BalanceCrosscheck } from '@/types';
import { getBalanceCrosscheck } from '@/lib/api';

interface BalanceCrosscheckProps {
  userId: number;
  year?: number;
  month?: number;
}

export default function BalanceCrosscheckComponent({ userId, year, month }: BalanceCrosscheckProps) {
  const [crosscheck, setCrosscheck] = useState<BalanceCrosscheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadCrosscheck(); }, [userId, year, month]);

  const loadCrosscheck = async () => {
    setIsLoading(true);
    try {
      setCrosscheck(await getBalanceCrosscheck(userId, year, month));
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  };

  const fmt = (n: number) => `Rp ${Math.abs(n).toLocaleString('id-ID')}`;

  if (isLoading || !crosscheck) {
    return null; // hidden while loading — non-critical widget
  }

  const ok = crosscheck.isMatch;

  return (
    <div
      className="glass glass-card"
      style={{
        padding: '16px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
        background: ok
          ? 'rgba(112,162,136,0.08)'
          : 'rgba(218,183,133,0.12)',
        borderColor: ok
          ? 'rgba(112,162,136,0.24)'
          : 'rgba(218,183,133,0.36)',
      }}
    >
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: ok ? 'var(--pos-soft)' : 'var(--warn-soft)',
          border: `1px solid ${ok ? 'rgba(112,162,136,0.30)' : 'rgba(218,183,133,0.40)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15,
        }}>
          {ok ? '✓' : '⚠'}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>Balance Crosscheck</div>
          <div style={{ fontSize: 11.5, color: ok ? 'var(--pos)' : '#8a6a2e', marginTop: 2 }}>
            {ok ? 'Wallets match calculated balance' : 'Mismatch detected — check wallet entries'}
          </div>
        </div>
      </div>

      {/* Numbers */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'right' }}>
          <div className="eyebrow" style={{ marginBottom: 3 }}>Calculated</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
            {fmt(crosscheck.currentBalance)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="eyebrow" style={{ marginBottom: 3 }}>Wallets total</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
            {fmt(crosscheck.totalWalletBalance)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="eyebrow" style={{ marginBottom: 3 }}>Difference</div>
          <div
            className="num"
            style={{ fontSize: 14, fontWeight: 600, color: ok ? 'var(--pos)' : 'var(--warn)' }}
          >
            {fmt(crosscheck.difference)}
          </div>
        </div>
      </div>

      <span className={ok ? 'chip chip-pos' : 'chip chip-warn'} style={{ flexShrink: 0 }}>
        {ok ? '✓ Balanced' : '⚠ Mismatch'}
      </span>
    </div>
  );
}
