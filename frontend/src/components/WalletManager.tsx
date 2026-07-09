
import { useState, useEffect } from 'react';
import { Wallet } from '@/types';
import { getWallets, createWallet, updateWallet, deleteWallet } from '@/lib/api';
import WalletCard from './WalletCard';
import WalletForm from './WalletForm';

interface WalletManagerProps {
  userId: number;
  refreshTrigger?: number;
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export default function WalletManager({ userId, refreshTrigger }: WalletManagerProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadWallets(); }, [userId, refreshTrigger]);

  const loadWallets = async () => {
    setIsLoading(true);
    try {
      setWallets(await getWallets(userId));
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (wallet: Omit<Wallet, 'id' | 'created_at'>) => {
    await createWallet(wallet); await loadWallets();
  };
  const handleUpdate = async (wallet: Omit<Wallet, 'id' | 'created_at'>) => {
    if (editingWallet) { await updateWallet(editingWallet.id, wallet); await loadWallets(); }
  };
  const handleDelete = async (id: number) => {
    await deleteWallet(id); await loadWallets();
  };
  const handleEdit = (wallet: Wallet) => { setEditingWallet(wallet); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setEditingWallet(undefined); };

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', marginBottom: 14,
      }}>
        <div>
          <span className="eyebrow">Wallets</span>
          <div style={{ fontSize: 18, fontWeight: 400, letterSpacing: '-.01em', color: 'var(--fg)', marginTop: 4 }}>
            Accounts &amp; cards
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setIsFormOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 14px', borderRadius: 999,
              background: 'var(--laccent)', color: '#fff', border: 0,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.18) inset, 0 4px 12px -2px var(--accent-glow)',
            }}
          >
            <PlusIcon /> New wallet
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="glass glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid transparent', borderTopColor: 'var(--laccent)',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 8px',
            }} />
            <p style={{ color: 'var(--fg-faint)', fontSize: 12 }}>Loading wallets…</p>
          </div>
        </div>
      ) : wallets.length === 0 ? (
        /* Empty state */
        <div className="glass glass-card" style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fg-faint)', marginBottom: 14,
          }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="12" height="9" rx="1.5" />
              <path d="M11 8.5h2" />
            </svg>
          </div>
          <p style={{ fontSize: 14, color: 'var(--fg-subtle)', marginBottom: 4 }}>No wallets yet</p>
          <p style={{ fontSize: 12, color: 'var(--fg-faint)', marginBottom: 16 }}>
            Add your first wallet to start tracking balances
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 16px', borderRadius: 999,
              background: 'var(--laccent)', color: '#fff', border: 0,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              boxShadow: '0 4px 12px -2px var(--accent-glow)',
            }}
          >
            <PlusIcon /> Add first wallet
          </button>
        </div>
      ) : (
        /* Wallets grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {wallets.map(w => (
            <WalletCard
              key={w.id}
              wallet={w}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <WalletForm
        wallet={editingWallet}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={editingWallet ? handleUpdate : handleCreate}
        userId={userId}
      />

    </div>
  );
}
