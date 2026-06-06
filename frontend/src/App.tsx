import { useState, useEffect, useMemo } from 'react';
import { User, Transaction, FinancialSummary, Category, InitialBalance } from '@/types';
import {
  getUsers,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFinancialSummary,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getOrCreateInitialBalance,
  setInitialBalance,
  deleteInitialBalance,
} from '@/lib/api';
import FinancialSummaryComponent from '@/components/FinancialSummary';
import TransactionList from '@/components/TransactionList';
import TransactionForm from '@/components/TransactionForm';
import CategoryManager from '@/components/CategoryManager';
import Dashboard from '@/components/Dashboard';
import WalletManager from '@/components/WalletManager';
import UserManager from '@/components/UserManager';
import BalanceCrosscheckComponent from '@/components/BalanceCrosscheckComponent';
import InitialBalanceDialog from '@/components/InitialBalanceDialog';
import ImportTransactions from '@/components/ImportTransactions';

/* ── SVG Icons ──────────────────────────────────────────────────────────── */
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v1.7M8 12.8v1.7M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M1.5 8h1.7M12.8 8h1.7M3.4 12.6l1.2-1.2M11.4 4.6l1.2-1.2" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10V2M5 5l3-3 3 3M3 11v2h10v-2" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
      <path d="M11 3.5a2.5 2.5 0 0 1 0 5M14.5 13.5c0-2-1.5-3.5-3.5-3.8" />
    </svg>
  );
}
function IconFolders() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5h5l1.5 1.5H14v6H2z" />
      <path d="M2 3.5h4l1 1" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 4.5 2.3" />
      <path d="M13.5 2.5v3h-3" />
    </svg>
  );
}

function LogoMark() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 9,
      background: 'linear-gradient(135deg, #04395e, #2268a0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.4) inset, 0 4px 14px rgba(4,57,94,0.28)',
      flexShrink: 0,
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 11 L7 5 L9.5 8.5 L13 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="13" cy="3" r="1.4" fill="white" />
      </svg>
    </div>
  );
}

function UserAvatar({ name, size = 26 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #04395e, #1a4a70)',
      color: 'white', fontSize: size * 0.38, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.4) inset',
      flexShrink: 0,
    }}>{initials}</div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
void MONTHS;

/* ── Navbar ─────────────────────────────────────────────────────────────── */
interface NavbarProps {
  users: User[];
  selectedUserId: number | null;
  onUserChange: (id: number) => void;
  selectedMonth: string;
  onMonthChange: (m: string) => void;
  availableMonths: string[];
  onAdd: () => void;
  onOpenCategories: () => void;
  onOpenUsers: () => void;
  onOpenImport: () => void;
  onRefresh: () => void;
}

function Navbar({
  users, selectedUserId, onUserChange,
  selectedMonth, onMonthChange, availableMonths,
  onAdd, onOpenCategories, onOpenUsers, onOpenImport, onRefresh,
}: NavbarProps) {
  const [userOpen, setUserOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedUser = users.find(u => u.id === selectedUserId);

  const displayMonth = useMemo(() => {
    if (selectedMonth === 'all') return 'All time';
    const d = new Date(selectedMonth + '-01');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [selectedMonth]);

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      padding: '12px 28px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(255,255,255,0.68)',
      borderBottom: '1px solid var(--glass-border)',
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <LogoMark />
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--fg)' }}>Ledger</div>
          <div style={{ fontSize: 9.5, color: 'var(--fg-faint)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 2 }}>Personal finance</div>
        </div>
      </div>

      {/* Nav tabs */}
      <nav style={{ display: 'flex', gap: 2 }}>
        {['Overview', 'Transactions', 'Wallets', 'Reports'].map((n, i) => (
          <span key={n} style={{
            padding: '7px 13px', borderRadius: 999,
            color: i === 0 ? 'var(--fg)' : 'var(--fg-subtle)',
            background: i === 0 ? 'rgba(3,29,68,0.06)' : 'transparent',
            border: i === 0 ? '1px solid var(--glass-border)' : '1px solid transparent',
            fontSize: 13, fontWeight: 500, cursor: 'default',
            display: 'inline-block',
          }}>{n}</span>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* User selector */}
      <div style={{ position: 'relative' }}>
        <button
          className="nav-btn"
          onClick={() => { setUserOpen(o => !o); setMonthOpen(false); setSettingsOpen(false); }}
          style={{ paddingLeft: 8, gap: 8 }}
        >
          {selectedUser ? <UserAvatar name={selectedUser.name} /> : null}
          <span>{selectedUser?.name || 'Select user'}</span>
          <IconChevron />
        </button>
        {userOpen && (
          <div className="glass" style={{
            position: 'absolute', top: 46, right: 0,
            width: 220, padding: 6, zIndex: 50,
          }}>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => { onUserChange(u.id); setUserOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 8px', borderRadius: 10,
                  background: u.id === selectedUserId ? 'rgba(3,29,68,0.06)' : 'transparent',
                  border: 0, color: 'var(--fg)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <UserAvatar name={u.name} />
                {u.name}
              </button>
            ))}
            <div className="hr-glass" style={{ margin: '6px 4px' }} />
            <button
              onClick={() => { setUserOpen(false); onOpenUsers(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px', borderRadius: 10,
                border: 0, background: 'transparent', color: 'var(--fg-muted)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <IconUsers /> Manage users
            </button>
          </div>
        )}
      </div>

      {/* Month picker */}
      <div style={{ position: 'relative' }}>
        <button
          className="nav-btn"
          onClick={() => { setMonthOpen(o => !o); setUserOpen(false); setSettingsOpen(false); }}
        >
          <IconCalendar />
          <span className="num">{displayMonth}</span>
          <IconChevron />
        </button>
        {monthOpen && (
          <div className="glass" style={{
            position: 'absolute', top: 46, right: 0,
            width: 240, padding: 10, zIndex: 50,
          }}>
            <button
              onClick={() => { onMonthChange('all'); setMonthOpen(false); }}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                background: selectedMonth === 'all' ? 'var(--accent-soft)' : 'rgba(255,255,255,0.6)',
                border: '1px solid var(--glass-border)',
                color: selectedMonth === 'all' ? 'var(--laccent)' : 'var(--fg-muted)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', marginBottom: 6, textAlign: 'left',
              }}
            >
              All time
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {availableMonths.map(m => {
                const d = new Date(m + '-01');
                const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return (
                  <button
                    key={m}
                    onClick={() => { onMonthChange(m); setMonthOpen(false); }}
                    style={{
                      padding: '7px 8px', borderRadius: 8,
                      background: m === selectedMonth ? 'var(--accent-soft)' : 'rgba(255,255,255,0.6)',
                      border: '1px solid var(--glass-border)',
                      color: m === selectedMonth ? 'var(--laccent)' : 'var(--fg-muted)',
                      fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Refresh */}
      <button className="nav-btn nav-btn-icon" title="Refresh data" onClick={onRefresh}>
        <IconRefresh />
      </button>

      {/* Settings */}
      <div style={{ position: 'relative' }}>
        <button
          className="nav-btn nav-btn-icon"
          title="Settings"
          onClick={() => { setSettingsOpen(o => !o); setUserOpen(false); setMonthOpen(false); }}
        >
          <IconSettings />
        </button>
        {settingsOpen && (
          <div className="glass" style={{
            position: 'absolute', top: 46, right: 0,
            width: 200, padding: 6, zIndex: 50,
          }}>
            {[
              { label: 'Manage categories', icon: <IconFolders />, onClick: onOpenCategories },
              { label: 'Import transactions', icon: <IconUpload />, onClick: onOpenImport },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => { item.onClick(); setSettingsOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 10px', borderRadius: 10,
                  border: 0, background: 'transparent', color: 'var(--fg-muted)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New transaction */}
      <button className="nav-btn nav-btn-primary" onClick={onAdd}>
        <IconPlus /> New transaction
      </button>
    </header>
  );
}

/* ── App ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [initialBalance, setInitialBalanceState] = useState<InitialBalance | null>(null);
  const [monthlyInitialBalance, setMonthlyInitialBalance] = useState<InitialBalance | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isInitialBalanceDialogOpen, setIsInitialBalanceDialogOpen] = useState(false);
  const [isMonthlyBalanceDialogOpen, setIsMonthlyBalanceDialogOpen] = useState(false);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    if (selectedUserId) { loadData(); loadCategories(); }
  }, [selectedUserId]);
  useEffect(() => {
    if (selectedUserId && selectedMonth !== 'all') loadMonthlyInitialBalance();
  }, [selectedUserId, selectedMonth]);

  const loadUsers = async () => {
    try {
      const usersData = await getUsers();
      setUsers(usersData);
      if (usersData.length > 0) setSelectedUserId(usersData[0].id);
    } catch {
      alert('Failed to load users. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    if (!selectedUserId) return;
    try {
      const now = new Date();
      const [transactionsData, summaryData, initialBalanceData] = await Promise.all([
        getTransactions(selectedUserId),
        getFinancialSummary(selectedUserId),
        getOrCreateInitialBalance(selectedUserId, now.getFullYear(), 1),
      ]);
      setTransactions(transactionsData);
      setSummary(summaryData);
      setInitialBalanceState(initialBalanceData);
    } catch {
      alert('Failed to load data. Make sure the backend is running.');
    }
  };

  const loadCategories = async () => {
    if (!selectedUserId) return;
    try {
      setCategories(await getCategories(selectedUserId));
    } catch { /* silent */ }
  };

  const loadMonthlyInitialBalance = async () => {
    if (!selectedUserId || selectedMonth === 'all') return;
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      setMonthlyInitialBalance(await getOrCreateInitialBalance(selectedUserId, year, month));
    } catch { /* silent */ }
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(t.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const monthlySummary = useMemo(() => {
    if (selectedMonth === 'all') return summary;
    const mt = transactions.filter(t => t.date.startsWith(selectedMonth));
    const totalIncome = mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, [transactions, selectedMonth, summary]);

  const filteredTransactions = useMemo(() =>
    selectedMonth === 'all' ? transactions : transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const handleAddTransaction = async (t: Omit<Transaction, 'id' | 'created_at'>) => {
    await createTransaction(t); await loadData();
  };
  const handleUpdateTransaction = async (t: Omit<Transaction, 'id' | 'created_at'>) => {
    if (editingTransaction) { await updateTransaction(editingTransaction.id, t); await loadData(); }
  };
  const handleDeleteTransaction = async (id: number) => {
    await deleteTransaction(id); await loadData();
  };
  const handleEdit = (t: Transaction) => { setEditingTransaction(t); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setEditingTransaction(undefined); };
  const handleCreateCategory = async (c: Omit<Category, 'id' | 'created_at'>) => { await createCategory(c); };
  const handleUpdateCategory = async (id: number, c: Partial<Category>) => { await updateCategory(id, c); };
  const handleDeleteCategory = async (id: number) => { await deleteCategory(id); };

  const handleSaveInitialBalance = async (balance: number) => {
    if (!selectedUserId || !initialBalance) return;
    try {
      await setInitialBalance(selectedUserId, initialBalance.year, initialBalance.month, balance, true);
      await loadData();
    } catch { alert('Failed to save initial balance'); }
  };
  const handleResetInitialBalance = async () => {
    if (!selectedUserId || !initialBalance) return;
    try {
      await deleteInitialBalance(selectedUserId, initialBalance.year, initialBalance.month);
      await loadData();
    } catch { alert('Failed to reset initial balance'); }
  };
  const handleSaveMonthlyInitialBalance = async (balance: number) => {
    if (!selectedUserId || !monthlyInitialBalance) return;
    try {
      await setInitialBalance(selectedUserId, monthlyInitialBalance.year, monthlyInitialBalance.month, balance, true);
      await loadData(); await loadMonthlyInitialBalance();
    } catch { alert('Failed to save monthly initial balance'); }
  };
  const handleResetMonthlyInitialBalance = async () => {
    if (!selectedUserId || !monthlyInitialBalance) return;
    try {
      await deleteInitialBalance(selectedUserId, monthlyInitialBalance.year, monthlyInitialBalance.month);
      await loadData(); await loadMonthlyInitialBalance();
    } catch { alert('Failed to reset monthly initial balance'); }
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'var(--laccent)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p style={{ color: 'var(--fg-faint)', fontSize: 13 }}>Loading your data…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const activeSummary = selectedMonth !== 'all' ? monthlySummary : summary;
  const activeInitialBalance = selectedMonth !== 'all' ? monthlyInitialBalance : initialBalance;
  const activeMonthLabel = selectedMonth !== 'all'
    ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : `${new Date().getFullYear()} year`;

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      {/* Navbar */}
      <Navbar
        users={users}
        selectedUserId={selectedUserId}
        onUserChange={setSelectedUserId}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        availableMonths={availableMonths}
        onAdd={() => { setEditingTransaction(undefined); setIsFormOpen(true); }}
        onOpenCategories={() => setIsCategoryManagerOpen(true)}
        onOpenUsers={() => setIsUserManagerOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onRefresh={loadData}
      />

      {/* Main content */}
      <main style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '28px 28px 52px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
      }}>
        {selectedUserId ? (
          <>
            {/* Financial Summary */}
            <section>
              <div style={{ marginBottom: 14 }}>
                <span className="eyebrow">Summary</span>
                <div style={{ fontSize: 18, fontWeight: 400, letterSpacing: '-.01em', color: 'var(--fg)', marginTop: 4 }}>
                  {activeMonthLabel}
                </div>
              </div>
              <FinancialSummaryComponent
                summary={activeSummary}
                initialBalance={activeInitialBalance?.balance || 0}
                onEditInitialBalance={() =>
                  selectedMonth !== 'all'
                    ? setIsMonthlyBalanceDialogOpen(true)
                    : setIsInitialBalanceDialogOpen(true)
                }
              />
            </section>

            {/* Balance Crosscheck (compact) */}
            <BalanceCrosscheckComponent userId={selectedUserId} />

            {/* Analytics */}
            <Dashboard userId={selectedUserId} />

            {/* Wallet Manager */}
            <WalletManager userId={selectedUserId} />

            {/* Transaction List */}
            <div className="glass glass-card" style={{ padding: '8px 8px 16px' }}>
              <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span className="eyebrow">Transactions</span>
                  <div style={{ fontSize: 18, fontWeight: 400, letterSpacing: '-.01em', color: 'var(--fg)', marginTop: 4 }}>
                    {selectedMonth !== 'all'
                      ? `${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} activity`
                      : 'All activity'}
                  </div>
                </div>
                {selectedMonth !== 'all' && (
                  <span className="chip">{filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <TransactionList
                transactions={filteredTransactions}
                onEdit={handleEdit}
                onDelete={handleDeleteTransaction}
                userId={selectedUserId}
              />
            </div>

            <footer style={{
              textAlign: 'center',
              color: 'var(--fg-faint)',
              fontSize: 11.5,
              padding: '4px 0',
            }}>
              Ledger · personal finance tracker
            </footer>
          </>
        ) : (
          <div style={{
            textAlign: 'center', padding: '80px 24px',
            color: 'var(--fg-faint)', fontSize: 14,
          }}>
            No users found. Add a user to get started.
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedUserId && (
        <TransactionForm
          userId={selectedUserId}
          transaction={editingTransaction}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={editingTransaction ? handleUpdateTransaction : handleAddTransaction}
          onCategoriesChange={loadCategories}
        />
      )}

      {selectedUserId && (
        <CategoryManager
          userId={selectedUserId}
          categories={categories}
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          onRefresh={loadCategories}
          onCreate={handleCreateCategory}
          onUpdate={handleUpdateCategory}
          onDelete={handleDeleteCategory}
        />
      )}

      {isUserManagerOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(3,29,68,0.32)',
          backdropFilter: 'blur(10px) saturate(120%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setIsUserManagerOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <UserManager users={users} onRefresh={loadUsers} />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsUserManagerOpen(false)}
                className="nav-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {initialBalance && (
        <InitialBalanceDialog
          isOpen={isInitialBalanceDialogOpen}
          onClose={() => setIsInitialBalanceDialogOpen(false)}
          onSave={handleSaveInitialBalance}
          onReset={handleResetInitialBalance}
          currentBalance={initialBalance.balance}
          year={initialBalance.year}
          month={initialBalance.month}
          isManual={initialBalance.is_manual}
        />
      )}

      {monthlyInitialBalance && (
        <InitialBalanceDialog
          isOpen={isMonthlyBalanceDialogOpen}
          onClose={() => setIsMonthlyBalanceDialogOpen(false)}
          onSave={handleSaveMonthlyInitialBalance}
          onReset={handleResetMonthlyInitialBalance}
          currentBalance={monthlyInitialBalance.balance}
          year={monthlyInitialBalance.year}
          month={monthlyInitialBalance.month}
          isManual={monthlyInitialBalance.is_manual}
        />
      )}

      {selectedUserId && (
        <ImportTransactions
          userId={selectedUserId}
          categories={categories}
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
