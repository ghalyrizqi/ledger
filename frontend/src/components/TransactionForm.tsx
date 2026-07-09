
import { useState, useEffect } from 'react';
import { Transaction, Category } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCategories } from '@/lib/api';

interface TransactionFormProps {
  userId: number;
  transaction?: Transaction;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  onCategoriesChange?: () => void;
}

type Tab = 'income' | 'expense' | 'transfer' | 'investment';

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      gridColumn: full ? '1 / -1' : 'auto',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 500, letterSpacing: '.10em',
        textTransform: 'uppercase', color: 'var(--fg-faint)',
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export default function TransactionForm({
  userId,
  transaction,
  isOpen,
  onClose,
  onSubmit,
  onCategoriesChange,
}: TransactionFormProps) {
  const [tab, setTab] = useState<Tab>('expense');
  const [subDir, setSubDir] = useState<'expense' | 'income'>('expense');
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    is_transfer: 0 as 0 | 1,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsCategory = tab === 'income' || tab === 'expense';
  const activeType = (tab === 'income' || tab === 'expense') ? tab : subDir;

  useEffect(() => {
    if (isOpen && userId && needsCategory) loadCategories();
  }, [isOpen, userId, activeType, needsCategory]);

  const loadCategories = async () => {
    try {
      setCategories(await getCategories(userId, activeType));
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!transaction) {
      setTab('expense');
      setSubDir('expense');
      setFormData({ type: 'expense', amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0], is_transfer: 0 });
      return;
    }
    const isTransfer = transaction.is_transfer === 1;
    const isInvest = isTransfer && transaction.category === 'Investment';
    const isInternal = isTransfer && !isInvest;
    const resolvedTab: Tab = isInvest ? 'investment' : isInternal ? 'transfer' : transaction.type;
    setTab(resolvedTab);
    setSubDir(transaction.type);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category,
      description: transaction.description || '',
      date: transaction.date,
      is_transfer: isTransfer ? 1 : 0,
    });
  }, [transaction, isOpen]);

  useEffect(() => {
    if (tab === 'income' || tab === 'expense') {
      setFormData(f => ({ ...f, type: tab, is_transfer: 0, category: '' }));
    } else if (tab === 'transfer') {
      setFormData(f => ({ ...f, type: subDir, is_transfer: 1, category: 'Internal Transfer' }));
    } else {
      setFormData(f => ({ ...f, type: subDir, is_transfer: 1, category: 'Investment' }));
    }
  }, [tab, subDir]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        user_id: userId,
        type: formData.type,
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description,
        date: formData.date,
        is_transfer: formData.is_transfer,
      });
      onClose();
    } catch {
      alert('Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 44, padding: '0 14px', borderRadius: 12,
    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
    color: 'var(--fg)', fontSize: 14, outline: 'none', width: '100%',
    fontFamily: 'inherit',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, height: 32, borderRadius: 999,
    background: active ? 'var(--card)' : 'transparent',
    color: active ? 'var(--fg)' : 'var(--fg-muted)',
    boxShadow: active ? 'var(--card-shadow), 0 0 0 1px var(--card-border)' : 'none',
    border: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    transition: 'all 0.15s',
  });

  const miniTabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, height: 28, borderRadius: 999,
    background: active ? 'var(--laccent)' : 'transparent',
    color: active ? '#fff' : 'var(--fg-muted)',
    border: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="modal-panel-glass sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <div style={{ padding: '24px 24px 0' }}>
          <DialogHeader>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <span className="eyebrow">{transaction ? 'Edit transaction' : 'New transaction'}</span>
                <DialogTitle style={{ fontSize: 18, fontWeight: 400, color: 'var(--fg)', marginTop: 4, letterSpacing: '-.01em' }}>
                  {transaction ? 'Update the details' : 'Create a new transaction'}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="sr-only">
              {transaction ? 'Edit an existing transaction' : 'Create a new transaction'}
            </DialogDescription>
          </DialogHeader>

          {/* 4-tab segmented */}
          <div className="seg" style={{ marginTop: 16, width: '100%', borderRadius: 12 }}>
            <button style={tabStyle(tab === 'income')}     onClick={() => setTab('income')}>Income</button>
            <button style={tabStyle(tab === 'expense')}    onClick={() => setTab('expense')}>Expense</button>
            <button style={tabStyle(tab === 'transfer')}   onClick={() => setTab('transfer')}>Transfer</button>
            <button style={tabStyle(tab === 'investment')} onClick={() => setTab('investment')}>Investment</button>
          </div>

          {/* Direction sub-toggle for Transfer & Investment */}
          {(tab === 'transfer' || tab === 'investment') && (
            <div className="seg" style={{ marginTop: 8, width: '100%', borderRadius: 10, background: 'var(--surface-subtle)', padding: 3 }}>
              {tab === 'transfer' ? (
                <>
                  <button style={miniTabStyle(subDir === 'expense')} onClick={() => setSubDir('expense')}>→ Kirim</button>
                  <button style={miniTabStyle(subDir === 'income')}  onClick={() => setSubDir('income')}>← Terima</button>
                </>
              ) : (
                <>
                  <button style={miniTabStyle(subDir === 'expense')} onClick={() => setSubDir('expense')}>Beli / Top-up</button>
                  <button style={miniTabStyle(subDir === 'income')}  onClick={() => setSubDir('income')}>Jual / Cairkan</button>
                </>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 24px' }}>
            {/* Amount */}
            <Field label="Amount (IDR)">
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--fg-faint)', fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 14,
                }}>Rp</span>
                <input
                  type="number"
                  step="1"
                  required
                  value={formData.amount}
                  onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  style={{ ...inputStyle, paddingLeft: 40, fontFamily: 'var(--font-geist-mono, monospace)', fontWeight: 600, fontSize: 16 }}
                />
              </div>
            </Field>

            {/* Date */}
            <Field label="Date">
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
                style={{ ...inputStyle, fontFamily: 'var(--font-geist-mono, monospace)' }}
              />
            </Field>

            {/* Category — only for Income / Expense */}
            {needsCategory && (
              <Field label="Category" full>
                <Select
                  value={formData.category}
                  onValueChange={v => setFormData(f => ({ ...f, category: v }))}
                >
                  <SelectTrigger style={{ ...inputStyle, display: 'flex', alignItems: 'center' }}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: cat.color || 'var(--accent-soft)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                          }}>
                            {cat.icon || '💰'}
                          </span>
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {/* Description */}
            <Field label="Description (optional)" full>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Add a note…"
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            padding: '12px 24px 24px',
            borderTop: '1px solid var(--card-border)',
            marginTop: 4,
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                height: 38, padding: '0 18px', borderRadius: 999,
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                color: 'var(--fg)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                height: 38, padding: '0 22px', borderRadius: 999,
                background: 'var(--laccent)', color: '#fff', border: 0,
                fontSize: 13, fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.18) inset, 0 6px 18px -4px var(--accent-glow)',
              }}
            >
              {isSubmitting ? 'Saving…' : transaction ? 'Update' : 'Save transaction'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
