import { useEffect, useState } from 'react';
import { WalletFreshnessSummary as Summary } from '@/types';
import { getWalletFreshnessSummary } from '@/lib/api';

interface Props {
  userId: number;
  refreshTrigger?: number;
  onReview: () => void;
  onUpload: () => void;
}

export default function WalletFreshnessSummary({ userId, refreshTrigger, onReview, onUpload }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    getWalletFreshnessSummary(userId).then(setSummary).catch(() => setSummary(null));
  }, [userId, refreshTrigger]);

  if (!summary || summary.total === 0) return null;
  const attention = summary.walletsNeedingAttention;
  const names = attention.slice(0, 3).map(wallet => wallet.name).join(', ');

  return (
    <div className="glass glass-card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Wallet freshness</span>
          <div style={{ fontSize: 19, color: 'var(--fg)', marginTop: 5 }}>
            <span className="num" style={{ fontWeight: 700 }}>{summary.upToDate}</span> of{' '}
            <span className="num" style={{ fontWeight: 700 }}>{summary.total}</span> wallets current
          </div>
          <div style={{ fontSize: 12, color: attention.length ? 'var(--fg-muted)' : 'var(--pos)', marginTop: 5 }}>
            {attention.length
              ? `${names}${attention.length > 3 ? ` and ${attention.length - 3} more` : ''} need attention.`
              : 'Every tracked wallet is up to date.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onReview} style={{ height: 32, padding: '0 13px', borderRadius: 999, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 12 }}>
            Review wallets
          </button>
          <button onClick={onUpload} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--laccent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Upload statement
          </button>
        </div>
      </div>
      {attention.length > 0 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
          {attention.slice(0, 5).map(wallet => (
            <span key={wallet.id} className="chip" style={{ fontSize: 10.5 }}>
              {wallet.icon || '•'} {wallet.name} · {wallet.freshness?.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
