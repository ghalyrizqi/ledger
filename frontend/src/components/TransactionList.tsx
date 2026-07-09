
import { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Transaction } from '@/types';

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
}

type SortField = 'date' | 'amount' | 'category';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'income' | 'expense' | 'transfer' | 'investment';

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

export default function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterWallet, setFilterWallet] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
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

  const fmtMonth = (ym: string) => {
    const d = new Date(ym + '-01');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const categories = useMemo(() =>
    [...new Set(transactions.filter(t => !t.is_transfer).map(t => t.category))].sort(),
    [transactions],
  );

  const availableWallets = useMemo(() =>
    [...new Set(transactions.map(t => t.wallet_name).filter((n): n is string => !!n))].sort(),
    [transactions],
  );

  const availableMonths = useMemo(() =>
    [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort().reverse(),
    [transactions],
  );

  const hasActiveFilter = !!(dateFrom || dateTo || filterCategory || filterWallet || filterMonth);

  const sorted = useMemo(() => {
    let rows = [...transactions];
    if (filterType === 'transfer')    rows = rows.filter(t => t.is_transfer === 1 && t.category !== 'Investment');
    else if (filterType === 'investment') rows = rows.filter(t => t.is_transfer === 1 && t.category === 'Investment');
    else if (filterType !== 'all')    rows = rows.filter(t => t.type === filterType && !t.is_transfer);
    if (filterMonth) rows = rows.filter(t => t.date.startsWith(filterMonth));
    if (filterWallet) rows = rows.filter(t => t.wallet_name === filterWallet);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(t =>
        t.category.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.wallet_name && t.wallet_name.toLowerCase().includes(q))
      );
    }
    if (dateFrom) rows = rows.filter(t => t.date >= dateFrom);
    if (dateTo) rows = rows.filter(t => t.date <= dateTo);
    if (filterCategory) rows = rows.filter(t => t.category === filterCategory);
    rows.sort((a, b) => {
      const v =
        sortField === 'amount' ? a.amount - b.amount
        : sortField === 'category' ? a.category.localeCompare(b.category)
        : new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === 'asc' ? v : -v;
    });
    return rows;
  }, [transactions, filterType, filterMonth, filterWallet, searchTerm, dateFrom, dateTo, filterCategory, sortField, sortOrder]);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortOrder('desc'); }
  };

  const clearFilters = () => {
    setDateFrom(''); setDateTo('');
    setFilterCategory(''); setFilterWallet(''); setFilterMonth('');
  };

  const exportToExcel = () => {
    if (!sorted.length) return;
    const data = sorted.map(t => ({
      Date: fmtDate(t.date),
      Type: t.type === 'income' ? 'Income' : 'Expense',
      Category: t.category,
      Description: t.description || '',
      Source: t.wallet_name || '',
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
          {(['all', 'income', 'expense', 'transfer', 'investment'] as const).map(k => (
            <button key={k} className={filterType === k ? 'on' : ''} onClick={() => setFilterType(k)}>
              {k === 'all' ? 'All' : k === 'income' ? 'Income' : k === 'expense' ? 'Expense' : k === 'transfer' ? '↔ Transfer' : '📈 Investment'}
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

        {/* Active filter chips */}
        {filterMonth && (
          <button
            onClick={() => setFilterMonth('')}
            style={{
              height: 28, padding: '0 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--accent-soft)', border: '1px solid var(--card-border)',
              color: 'var(--laccent)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {fmtMonth(filterMonth)} ×
          </button>
        )}
        {filterWallet && (
          <button
            onClick={() => setFilterWallet('')}
            style={{
              height: 28, padding: '0 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--accent-soft)', border: '1px solid var(--card-border)',
              color: 'var(--laccent)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {filterWallet} ×
          </button>
        )}
        {filterCategory && (
          <button
            onClick={() => setFilterCategory('')}
            style={{
              height: 28, padding: '0 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--accent-soft)', border: '1px solid var(--card-border)',
              color: 'var(--laccent)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {filterCategory} ×
          </button>
        )}

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
            <IconFilter /> Filter{hasActiveFilter ? ' ·' : ''}
          </button>

          {showFilter && (
            <div style={{
              position: 'absolute', top: 38, right: 0, zIndex: 100,
              width: 280, padding: 16, borderRadius: 14,
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-faint)' }}>
                Filter
              </div>

              {/* Month */}
              {availableMonths.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500 }}>Month</div>
                  <select
                    className="glass-input"
                    style={{ fontSize: 12, height: 30, padding: '0 8px' }}
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                  >
                    <option value="">All time</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{fmtMonth(m)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Source / Wallet */}
              {availableWallets.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500 }}>Source</div>
                  <select
                    className="glass-input"
                    style={{ fontSize: 12, height: 30, padding: '0 8px' }}
                    value={filterWallet}
                    onChange={e => setFilterWallet(e.target.value)}
                  >
                    <option value="">All accounts</option>
                    {availableWallets.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              )}

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
                  />
                  <span style={{ color: 'var(--fg-faint)', fontSize: 11 }}>–</span>
                  <input
                    type="date"
                    className="glass-input"
                    style={{ flex: 1, fontSize: 11, height: 30, padding: '0 8px' }}
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Clear */}
              {hasActiveFilter && (
                <button
                  onClick={clearFilters}
                  style={{
                    height: 28, borderRadius: 999, border: '1px solid var(--card-border)',
                    background: 'transparent', fontSize: 11, color: 'var(--neg)',
                    cursor: 'pointer',
                  }}
                >
                  Clear all filters
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
          gridTemplateColumns: '100px 1fr minmax(0, 140px) 56px',
          gap: 0, padding: '8px 12px',
        }}>
          <button style={hcellStyle} onClick={() => toggleSort('date')}>
            Date <SortArrow field="date" sortField={sortField} sortOrder={sortOrder} />
          </button>
          <button style={hcellStyle} onClick={() => toggleSort('category')}>
            Category <SortArrow field="category" sortField={sortField} sortOrder={sortOrder} />
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
                gridTemplateColumns: '100px 1fr minmax(0, 140px) 56px',
                alignItems: 'center',
                padding: '11px 12px',
                borderRadius: 10,
              }}
            >
              {/* Date */}
              <span className="num" style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>
                {fmtDate(t.date)}
              </span>

              {/* Category + description + type chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: t.is_transfer ? 'rgba(4,57,94,0.07)' : t.type === 'income' ? 'var(--pos-soft)' : 'var(--neg-soft)',
                  border: '1px solid var(--card-border)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                    {t.wallet_name && (
                      <button
                        onClick={() => setFilterWallet(t.wallet_name === filterWallet ? '' : t.wallet_name!)}
                        style={{
                          fontSize: 10,
                          color: filterWallet === t.wallet_name ? 'var(--laccent)' : 'var(--fg-faint)',
                          background: filterWallet === t.wallet_name ? 'var(--accent-soft)' : 'transparent',
                          border: `1px solid ${filterWallet === t.wallet_name ? 'oklch(from var(--laccent) l c h / 0.30)' : 'var(--card-border)'}`,
                          borderRadius: 4, padding: '1px 5px',
                          whiteSpace: 'nowrap', cursor: 'pointer',
                        }}
                      >
                        {t.wallet_icon && <span style={{ marginRight: 3 }}>{t.wallet_icon}</span>}
                        {t.wallet_name}
                      </button>
                    )}
                    {t.is_transfer
                      ? t.category === 'Investment'
                        ? <span className="chip" style={{ fontSize: 10, padding: '1px 5px', color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.25)', background: 'rgba(14,165,233,0.08)' }}>📈 Investment</span>
                        : <span className="chip" style={{ fontSize: 10, padding: '1px 5px', color: 'var(--laccent)', borderColor: 'rgba(4,57,94,0.2)', background: 'rgba(4,57,94,0.07)' }}>↔ Transfer</span>
                      : <span className={t.type === 'income' ? 'chip chip-pos' : 'chip chip-neg'} style={{ fontSize: 10, padding: '1px 5px' }}>{t.type === 'income' ? '↑ Income' : '↓ Expense'}</span>
                    }
                  </div>
                </div>
              </div>

              {/* Amount */}
              <span
                className="num"
                style={{
                  fontSize: 13, fontWeight: 600, textAlign: 'right',
                  color: t.is_transfer ? 'var(--fg-muted)' : t.type === 'income' ? 'var(--pos)' : 'var(--fg)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(3,29,68,0.06)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
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
