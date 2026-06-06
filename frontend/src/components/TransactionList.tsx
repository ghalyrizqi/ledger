
import { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Transaction } from '@/types';

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
  userId?: number;
}

type SortField = 'date' | 'amount' | 'category' | 'type';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'income' | 'expense' | 'transfer';

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4" /><path d="m13 13-3-3" />
    </svg>
  );
}
function IconFilter() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10V2M5 7l3 3 3-3M3 11v2h10v-2" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2a1.4 1.4 0 0 1 2 2L5 12l-3 1 1-3z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
    </svg>
  );
}
function SortArrow({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: SortOrder }) {
  if (sortField !== field) return <span style={{ color: 'var(--fg-faint)', opacity: 0.4 }}>↕</span>;
  return <span style={{ color: 'var(--laccent)' }}>{sortOrder === 'desc' ? '↓' : '↑'}</span>;
}

export default function TransactionList({ transactions, onEdit, onDelete, userId }: TransactionListProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFilter) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  const fmt = (n: number) => `Rp ${Math.abs(n).toLocaleString('id-ID')}`;

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });

  const categories = useMemo(() =>
    [...new Set(transactions.filter(t => !t.is_transfer).map(t => t.category))].sort(),
    [transactions],
  );

  const hasActiveFilter = !!(dateFrom || dateTo || filterCategory);

  const sorted = useMemo(() => {
    let rows = [...transactions];
    if (filterType === 'transfer') rows = rows.filter(t => t.is_transfer === 1);
    else if (filterType !== 'all') rows = rows.filter(t => t.type === filterType && !t.is_transfer);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(t =>
        t.category.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    if (dateFrom) rows = rows.filter(t => t.date >= dateFrom);
    if (dateTo) rows = rows.filter(t => t.date <= dateTo);
    if (filterCategory) rows = rows.filter(t => t.category === filterCategory);
    rows.sort((a, b) => {
      const v =
        sortField === 'amount' ? a.amount - b.amount
        : sortField === 'category' ? a.category.localeCompare(b.category)
        : sortField === 'type' ? a.type.localeCompare(b.type)
        : new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === 'asc' ? v : -v;
    });
    return rows;
  }, [transactions, filterType, searchTerm, dateFrom, dateTo, filterCategory, sortField, sortOrder]);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortOrder('desc'); }
  };

  const exportToExcel = () => {
    if (!sorted.length) return;
    const data = sorted.map(t => ({
      Date: fmtDate(t.date),
      Type: t.type === 'income' ? 'Income' : 'Expense',
      Category: t.category,
      Description: t.description || '',
      Amount: t.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, 'transactions.xlsx');
  };

  if (transactions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-faint)', fontSize: 13 }}>
        <p style={{ fontSize: 15, marginBottom: 6, color: 'var(--fg-subtle)' }}>No transactions yet</p>
        <p>Add your first transaction to get started</p>
      </div>
    );
  }

  const hcellStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'transparent', border: 0, padding: 0,
    fontSize: 11, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase',
    color: 'var(--fg-faint)', cursor: 'pointer',
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 8px 12px', flexWrap: 'wrap',
      }}>
        {/* Type segmented */}
        <div className="seg">
          {(['all', 'income', 'expense', 'transfer'] as const).map(k => (
            <button key={k} className={filterType === k ? 'on' : ''} onClick={() => setFilterType(k)}>
              {k === 'all' ? 'All' : k === 'income' ? 'Income' : k === 'expense' ? 'Expense' : '↔ Transfer'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }}>
            <IconSearch />
          </span>
          <input
            className="glass-input"
            style={{ paddingLeft: 32, width: 200 }}
            placeholder="Search…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Filter */}
        <div ref={filterRef} style={{ position: 'relative' }}>
          <button
            className="nav-btn"
            style={{
              height: 32, fontSize: 12, padding: '0 12px', gap: 6,
              borderColor: hasActiveFilter ? 'var(--laccent)' : undefined,
              color: hasActiveFilter ? 'var(--laccent)' : undefined,
            }}
            onClick={() => setShowFilter(v => !v)}
          >
            <IconFilter /> Filter{hasActiveFilter && ' ·'}
          </button>

          {showFilter && (
            <div style={{
              position: 'absolute', top: 38, right: 0, zIndex: 100,
              width: 260, padding: 16, borderRadius: 14,
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 8px 32px rgba(3,29,68,0.12)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-faint)' }}>
                Filter
              </div>

              {/* Date range */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500 }}>Date range</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="date"
                    className="glass-input"
                    style={{ flex: 1, fontSize: 11, height: 30, padding: '0 8px' }}
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    placeholder="From"
                  />
                  <span style={{ color: 'var(--fg-faint)', fontSize: 11 }}>–</span>
                  <input
                    type="date"
                    className="glass-input"
                    style={{ flex: 1, fontSize: 11, height: 30, padding: '0 8px' }}
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    placeholder="To"
                  />
                </div>
              </div>

              {/* Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500 }}>Category</div>
                <select
                  className="glass-input"
                  style={{ fontSize: 12, height: 30, padding: '0 8px' }}
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Clear */}
              {hasActiveFilter && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setFilterCategory(''); }}
                  style={{
                    height: 28, borderRadius: 999, border: '1px solid var(--glass-border)',
                    background: 'transparent', fontSize: 11, color: 'var(--neg)',
                    cursor: 'pointer',
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
        <button
          className="nav-btn"
          style={{ height: 32, fontSize: 12, padding: '0 12px', gap: 6 }}
          onClick={exportToExcel}
          disabled={!sorted.length}
        >
          <IconDownload /> Export
        </button>
        <span className="chip" style={{ flexShrink: 0 }}>
          {sorted.length} / {transactions.length}
        </span>
      </div>

      {/* Header row */}
      <div style={{ padding: '0 8px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '110px 1fr 140px 160px 60px',
          gap: 0, padding: '8px 12px',
        }}>
          <button style={hcellStyle} onClick={() => toggleSort('date')}>
            Date <SortArrow field="date" sortField={sortField} sortOrder={sortOrder} />
          </button>
          <button style={hcellStyle} onClick={() => toggleSort('category')}>
            Category <SortArrow field="category" sortField={sortField} sortOrder={sortOrder} />
          </button>
          <button style={hcellStyle} onClick={() => toggleSort('type')}>
            Type <SortArrow field="type" sortField={sortField} sortOrder={sortOrder} />
          </button>
          <button style={{ ...hcellStyle, justifyContent: 'flex-end' }} onClick={() => toggleSort('amount')}>
            Amount <SortArrow field="amount" sortField={sortField} sortOrder={sortOrder} />
          </button>
          <span />
        </div>
        <div className="hr-glass" />

        {sorted.length === 0 ? (
          <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--fg-faint)', fontSize: 13 }}>
            No transactions match your filters.
          </div>
        ) : (
          sorted.map(t => (
            <div
              key={t.id}
              className="tx-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 140px 160px 60px',
                alignItems: 'center',
                padding: '11px 12px',
                borderRadius: 10,
              }}
            >
              {/* Date */}
              <span className="num" style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>
                {fmtDate(t.date)}
              </span>

              {/* Category + description */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: t.is_transfer ? 'rgba(4,57,94,0.07)' : t.type === 'income' ? 'var(--pos-soft)' : 'var(--neg-soft)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: t.is_transfer ? 'var(--laccent)' : t.type === 'income' ? 'var(--pos)' : 'var(--neg)',
                  fontSize: t.is_transfer ? 14 : 13, fontWeight: 600,
                }}>
                  {t.is_transfer ? '↔' : t.category.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--fg)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {t.category}
                  </div>
                  {t.description && (
                    <div style={{
                      fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {t.description}
                    </div>
                  )}
                  {t.wallet_name && (
                    <div style={{ marginTop: 3 }}>
                      <span style={{
                        fontSize: 10, color: 'var(--fg-faint)',
                        background: 'rgba(3,29,68,0.05)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 4, padding: '1px 5px',
                        whiteSpace: 'nowrap',
                      }}>
                        {t.wallet_icon && <span style={{ marginRight: 3 }}>{t.wallet_icon}</span>}
                        {t.wallet_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Type chip */}
              <div>
                {t.is_transfer
                  ? <span className="chip" style={{ color: 'var(--laccent)', borderColor: 'rgba(4,57,94,0.2)', background: 'rgba(4,57,94,0.07)' }}>↔ Transfer</span>
                  : <span className={t.type === 'income' ? 'chip chip-pos' : 'chip chip-neg'}>{t.type === 'income' ? '↑ Income' : '↓ Expense'}</span>
                }
              </div>

              {/* Amount */}
              <span
                className="num"
                style={{
                  fontSize: 13.5, fontWeight: 600, textAlign: 'right',
                  color: t.is_transfer ? 'var(--fg-muted)' : t.type === 'income' ? 'var(--pos)' : 'var(--fg)',
                }}
              >
                {t.is_transfer ? '↔' : t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button
                  onClick={() => onEdit(t)}
                  title="Edit"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: '1px solid transparent',
                    color: 'var(--fg-muted)', cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(3,29,68,0.06)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <IconEdit />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this transaction?')) onDelete(t.id);
                  }}
                  title="Delete"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: '1px solid transparent',
                    color: 'var(--neg)', cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--neg-soft)'; e.currentTarget.style.borderColor = 'rgba(213,137,111,0.30)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
