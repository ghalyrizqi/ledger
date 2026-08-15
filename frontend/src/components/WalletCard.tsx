import { useState } from 'react';
import { Wallet } from '@/types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getWalletImportHistory } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WalletCardProps {
  wallet: Wallet;
  onEdit: (wallet: Wallet) => void;
  onDelete: (id: number) => void;
  onConfirmFreshness: (id: number) => void;
  onUpload: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank', ewallet: 'E-Wallet', cash: 'Cash', other: 'Other',
};
const BANK_LABELS: Record<string, string> = {
  bca: 'BCA', permata: 'Permata', jago: 'Jago', stockbit: 'Stockbit',
  dana: 'Dana', shopee: 'ShopeePay', ovo: 'OVO', bibit: 'Bibit', gopay: 'GoPay',
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
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2a1.4 1.4 0 0 1 2 2L5 12l-3 1 1-3z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
    </svg>
  );
}

const FRESHNESS_COLORS: Record<string, string> = {
  up_to_date: 'var(--pos)', due_soon: '#d99a36', needs_update: 'var(--neg)',
  never_uploaded: 'var(--fg-muted)', review_needed: 'var(--neg)', manual: '#d99a36', ignored: 'var(--fg-faint)',
};

export default function WalletCard({ wallet, onEdit, onDelete, onConfirmFreshness, onUpload }: WalletCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const openDetails = async () => {
    setShowDetails(true);
    try { setHistory(await getWalletImportHistory(wallet.id)); } catch { setHistory([]); }
  };

  const formatCurrency = (n: number) => {
    const sign = n < 0 ? '-' : '';
    return `${sign}Rp ${Math.abs(n).toLocaleString('id-ID')}`;
  };

  const formatDate = (value?: string | null, withTime = false) => {
    if (!value) return 'No data yet';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isNeg = wallet.balance < 0;
  const color = wallet.color || 'var(--laccent)';
  const colorRgb = wallet.color ? hexToRgb(wallet.color) : null;
  const glowColor = colorRgb
    ? `rgba(${colorRgb}, 0.20)`
    : 'var(--accent-soft)';

  return (
    <>
      <div
        className="glass glass-card"
        role="button"
        tabIndex={0}
        onClick={openDetails}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openDetails(); }}
        style={{
          display: 'flex', flexDirection: 'column',
          minHeight: 150, position: 'relative', overflow: 'hidden', cursor: 'pointer',
          border: isNeg
            ? '1px solid color-mix(in oklch, var(--neg) 40%, transparent)'
            : `1px solid color-mix(in oklch, ${color} 40%, transparent)`,
        }}
      >
        {/* Decorative radial background glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 160, height: 160, borderRadius: '50%',
          background: isNeg
            ? 'radial-gradient(circle, var(--neg-soft), transparent 75%)'
            : `radial-gradient(circle, ${colorRgb ? `rgba(${colorRgb}, 0.36)` : 'oklch(0.68 0.18 188 / 0.36)'}, transparent 65%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
              {/* Icon circle */}
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: 'var(--card-border)',
                border: '1px solid var(--card-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: wallet.color || 'var(--laccent)',
              }}>
                {wallet.icon
                  ? <span style={{ fontSize: 17 }}>{wallet.icon}</span>
                  : <WalletIcon type={wallet.type} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, color: 'var(--fg)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {wallet.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 2 }}>
                  {TYPE_LABELS[wallet.type] || wallet.type}
                </div>
              </div>
            </div>

            {/* Bank / type chip */}
            {(wallet.bank_type || wallet.type) && (
              <span className="chip chip-accent" style={{ fontSize: 10, flexShrink: 0 }}>
                {wallet.bank_type ? BANK_LABELS[wallet.bank_type] ?? wallet.bank_type : TYPE_LABELS[wallet.type] ?? wallet.type}
              </span>
            )}
          </div>

          {/* Balance */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'relative' }}>
            <div
              className="num"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(16px, 3.5cqi + 6px, 21px)',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: isNeg ? 'var(--neg)' : 'var(--fg)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {formatCurrency(wallet.balance)}
            </div>

            {wallet.gain_pct != null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 700,
                  color: wallet.gain_pct >= 0 ? 'var(--pos)' : 'var(--neg)',
                }}>
                  {wallet.gain_pct >= 0 ? '+' : ''}{wallet.gain_pct.toFixed(2)}%
                </span>
                {wallet.gain_amt != null && (
                  <span className="num" style={{
                    fontSize: 10.5,
                    color: wallet.gain_pct >= 0 ? 'var(--pos)' : 'var(--neg)',
                    opacity: 0.80,
                  }}>
                    {wallet.gain_amt >= 0 ? '+' : ''}{formatCurrency(wallet.gain_amt)}
                  </span>
                )}
              </div>
            )}
          </div>

          {wallet.freshness && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginTop: 'auto', fontSize: 10.5, color: 'var(--fg-faint)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: FRESHNESS_COLORS[wallet.freshness.status] }} />
              <span>Last refreshed</span>
              <span className="num" style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>
                {wallet.freshness.latestTransactionDate ? formatDate(wallet.freshness.latestTransactionDate) : 'Never'}
              </span>
            </div>
          )}
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
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{wallet.icon || '•'} {wallet.name}</DialogTitle></DialogHeader>
          <div style={{ padding: '2px 0 8px', borderBottom: '1px solid var(--card-border)' }}>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: isNeg ? 'var(--neg)' : 'var(--fg)' }}>{formatCurrency(wallet.balance)}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: wallet.freshness ? FRESHNESS_COLORS[wallet.freshness.status] : 'var(--fg)' }}>
              {wallet.freshness?.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3 }}>{wallet.freshness?.reason}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', marginTop: 12, fontSize: 11.5 }}>
              <span style={{ color: 'var(--fg-faint)' }}>Data through</span>
              <span className="num" style={{ textAlign: 'right' }}>{formatDate(wallet.freshness?.coveredThrough)}</span>
              <span style={{ color: 'var(--fg-faint)' }}>Last refreshed</span>
              <span className="num" style={{ textAlign: 'right' }}>{wallet.freshness?.latestTransactionDate ? formatDate(wallet.freshness.latestTransactionDate) : 'Never'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {wallet.freshness?.status !== 'ignored' && (
                <button onClick={() => { setShowDetails(false); wallet.freshness_mode === 'manual' ? onConfirmFreshness(wallet.id) : onUpload(); }} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--laccent)', color: '#fff', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>
                  {wallet.freshness_mode === 'manual' ? 'Count / confirm balance' : 'Upload statement'}
                </button>
              )}
              <button onClick={() => { setShowDetails(false); onEdit(wallet); }} style={{ height: 32, padding: '0 13px', borderRadius: 999, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 11.5 }}><EditIcon /> Edit wallet</button>
              <button onClick={() => { setShowDetails(false); setShowDeleteConfirm(true); }} style={{ height: 32, padding: '0 13px', borderRadius: 999, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--neg)', cursor: 'pointer', fontSize: 11.5 }}><TrashIcon /> Delete</button>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Recent updates</div>
            {history.length === 0 ? (
              <div style={{ padding: '18px 0', fontSize: 12, color: 'var(--fg-faint)' }}>No statement or confirmation history yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 320, overflowY: 'auto' }}>
                {history.map(item => (
                  <div key={item.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--surface-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: item.status === 'success' ? 'var(--pos)' : 'var(--neg)' }}>{item.source} · {item.status}</span>
                      <span className="num" style={{ fontSize: 10.5, color: 'var(--fg-faint)' }}>{new Date(item.uploaded_at).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                      {item.covered_through ? `Covered through ${item.covered_through}` : 'Coverage unavailable'} · {item.imported_count} imported · {item.duplicate_count} duplicates
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
