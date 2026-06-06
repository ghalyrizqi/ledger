
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
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && userId) loadCategories();
  }, [isOpen, userId, formData.type]);

  const loadCategories = async () => {
    try {
      setCategories(await getCategories(userId, formData.type));
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        amount: transaction.amount.toString(),
        category: transaction.category,
        description: transaction.description || '',
        date: transaction.date,
      });
    } else {
      setFormData({ type: 'expense', amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0] });
    }
  }, [transaction, isOpen]);

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
    background: 'rgba(255,255,255,0.7)', border: '1px solid var(--glass-border)',
    color: 'var(--fg)', fontSize: 14, outline: 'none', width: '100%',
    fontFamily: 'inherit',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, height: 32, borderRadius: 999,
    background: active ? '#ffffff' : 'transparent',
    color: active ? 'var(--fg)' : 'var(--fg-muted)',
    boxShadow: active ? '0 1px 2px rgba(3,29,68,0.10), 0 0 0 1px var(--glass-border)' : 'none',
    border: 0, fontSize: 13, fontWeight: 500, cursor: 'pointer',
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
                  {transaction ? 'Update the details' : 'Add an expense or income'}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="sr-only">
              {transaction ? 'Edit an existing transaction' : 'Create a new transaction'}
            </DialogDescription>
          </DialogHeader>

          {/* Type segmented */}
          <div className="seg" style={{ marginTop: 16, width: '100%', borderRadius: 12 }}>
            <button style={tabStyle(formData.type === 'expense')} onClick={() => setFormData(f => ({ ...f, type: 'expense' }))}>
              Expense
            </button>
            <button style={tabStyle(formData.type === 'income')} onClick={() => setFormData(f => ({ ...f, type: 'income' }))}>
              Income
            </button>
          </div>
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

            {/* Category */}
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
            borderTop: '1px solid var(--glass-border)',
            marginTop: 4,
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                height: 38, padding: '0 18px', borderRadius: 999,
                background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)',
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
