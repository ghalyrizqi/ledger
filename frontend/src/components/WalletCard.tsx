
import { useState } from 'react';
import { Wallet } from '@/types';
import ConfirmDialog from '@/components/ConfirmDialog';

interface WalletCardProps {
  wallet: Wallet;
  onEdit: (wallet: Wallet) => void;
  onDelete: (id: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank',
  ewallet: 'E-Wallet',
  cash: 'Cash',
  other: 'Other',
};

function WalletIcon({ type }: { type: string }) {
  const s = { width: 16, height: 16 };
  if (type === 'ewallet') {
    return (
      <svg {...s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="12" height="9" rx="1.5" />
        <path d="M2 7h12" />
      </svg>
    );
  }
  if (type === 'cash') {
    return (
      <svg {...s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 11l4-4 3 3 5-6" />
        <path d="M11 4h3v3" />
      </svg>
    );
  }
  return (
    <svg {...s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="12" height="9" rx="1.5" />
      <path d="M11 8.5h2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2a1.4 1.4 0 0 1 2 2L5 12l-3 1 1-3z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
    </svg>
  );
}

const BANK_LABELS: Record<string, string> = { bca: 'BCA', permata: 'Permata', jago: 'Jago', stockbit: 'Stockbit', dana: 'Dana', shopee: 'ShopeePay' };

export default function WalletCard({ wallet, onEdit, onDelete }: WalletCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatCurrency = (n: number) => {
    const sign = n < 0 ? '-' : '';
    return `${sign}Rp ${Math.abs(n).toLocaleString('id-ID')}`;
  };

  const isNeg = wallet.balance < 0;
  const color = wallet.color || '#04395e';

  return (
    <>
      <div
        className="glass glass-card"
        style={{
          padding: '18px 20px',
          display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: 148, position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Decorative radial glow */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: isNeg
            ? 'radial-gradient(circle, var(--neg-soft), transparent 70%)'
            : `radial-gradient(circle, rgba(${hexToRgb(color)},0.12), transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Header: icon + name + type chip */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 10, position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(3,29,68,0.04)', border: '1px solid var(--glass-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: color,
            }}>
              {wallet.icon
                ? <span style={{ fontSize: 18 }}>{wallet.icon}</span>
                : <WalletIcon type={wallet.type} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 13.5, fontWeight: 500, color: 'var(--fg)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {wallet.name}
              </div>
              <div style={{
                fontSize: 11.5, color: 'var(--fg-faint)', marginTop: 3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {TYPE_LABELS[wallet.type] || wallet.type}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
            <span className="chip">{TYPE_LABELS[wallet.type] || wallet.type}</span>
            {wallet.bank_type && (
              <span className="chip" style={{ fontSize: 10, background: 'rgba(4,57,94,0.08)', color: 'var(--laccent)', borderColor: 'rgba(4,57,94,0.18)' }}>
                {BANK_LABELS[wallet.bank_type]}
              </span>
            )}
          </div>
        </div>

        {/* Balance */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8, position: 'relative',
        }}>
          <div
            className="num"
            style={{
              fontSize: 'clamp(17px, 4cqi + 6px, 22px)',
              fontWeight: 600,
              letterSpacing: '-.02em',
              color: isNeg ? 'var(--neg)' : 'var(--fg)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {formatCurrency(wallet.balance)}
          </div>
          {wallet.gain_pct != null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: wallet.gain_pct >= 0 ? 'var(--pos)' : 'var(--neg)',
              }}>
                {wallet.gain_pct >= 0 ? '+' : ''}{wallet.gain_pct.toFixed(2)}%
              </span>
              {wallet.gain_amt != null && (
                <span style={{ fontSize: 10.5, opacity: 0.8, color: wallet.gain_pct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {wallet.gain_amt >= 0 ? '+' : ''}{formatCurrency(wallet.gain_amt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, position: 'relative', marginTop: 'auto', flexWrap: 'wrap' }}>
          <button
            onClick={() => onEdit(wallet)}
            style={{
              flex: 1, height: 32, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)',
              color: 'var(--fg-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--glass-border-hi)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
          >
            <EditIcon /> Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              flex: 1, height: 32, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)',
              color: 'var(--neg)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--neg-soft)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.6)')}
          >
            <TrashIcon /> Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={() => onDelete(wallet.id)}
        title="Delete Wallet"
        description={`Are you sure you want to delete "${wallet.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  if (isNaN(n)) return '4,57,94';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
