import { useState, useEffect, useMemo } from 'react';
import { User, Transaction, FinancialSummary, Category, Wallet } from '@/types';
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
  getWallets,
  getMe,
  logout,
} from '@/lib/api';
import Login from '@/components/Login';
import Landing from '@/components/Landing';
import FinancialSummaryComponent from '@/components/FinancialSummary';
import TransactionList from '@/components/TransactionList';
import SalaryCard from '@/components/SalaryCard';
import InvestmentCard from '@/components/InvestmentCard';
import CategoryBreakdown from '@/components/CategoryBreakdown';
import TransactionForm from '@/components/TransactionForm';
import CategoryManager from '@/components/CategoryManager';
import Dashboard from '@/components/Dashboard';
import WalletManager from '@/components/WalletManager';
import UserManager from '@/components/UserManager';
import BalanceCrosscheckComponent from '@/components/BalanceCrosscheckComponent';
import WalletFreshnessSummary from '@/components/WalletFreshnessSummary';
import ImportTransactions from '@/components/ImportTransactions';
import GlobalImportModal from '@/components/GlobalImportModal';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Calendar, ChevronDown, LogOut, Menu } from 'lucide-react';

type View = 'overview' | 'wallets' | 'transactions';

// True on phone-sized viewports; drives the off-canvas sidebar + tighter layout.
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export default function App() {
  // null = still checking the session; false = show landing/login; true = app
  const [authed, setAuthed] = useState<boolean | null>(null);
  // landing → login; jump straight to login if returning from a Google callback
  const [showLogin, setShowLogin] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('login'));
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGlobalImportOpen, setIsGlobalImportOpen] = useState(false);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const [activeView, setActiveView] = useState<View>('overview');
  // Dark mode defaults to true (dark-first experience)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('theme-transitioning');
    html.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
    const t = setTimeout(() => html.classList.remove('theme-transitioning'), 280);
    return () => clearTimeout(t);
  }, [darkMode]);

  // Check the session on load; flip to the login page on any later 401.
  useEffect(() => {
    getMe().then(() => setAuthed(true)).catch(() => setAuthed(false));
    const onUnauth = () => setAuthed(false);
    window.addEventListener('ledger:unauth', onUnauth);
    return () => window.removeEventListener('ledger:unauth', onUnauth);
  }, []);

  useEffect(() => { if (authed) loadUsers(); }, [authed]);
  useEffect(() => {
    if (selectedUserId) { loadData(); loadCategories(); }
  }, [selectedUserId]);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    setAuthed(false);
    setShowLogin(false);
    setSidebarOpen(false);
    setSelectedUserId(null);
    setUsers([]);
  };

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
      const [transactionsData, summaryData, walletsData] = await Promise.all([
        getTransactions(selectedUserId),
        getFinancialSummary(selectedUserId),
        getWallets(selectedUserId),
      ]);
      setTransactions(transactionsData);
      setSummary(summaryData);
      setWallets(walletsData);
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

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(t.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const monthlySummary = useMemo(() => {
    if (selectedMonth === 'all') return summary;
    const mt = transactions.filter(t => t.date.startsWith(selectedMonth));
    const nonTransfer = mt.filter(t => !t.is_transfer);
    const totalIncome = nonTransfer.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = nonTransfer.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, [transactions, selectedMonth, summary]);

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

  if (authed === false) {
    return showLogin
      ? <Login onSuccess={() => setAuthed(true)} onBack={() => setShowLogin(false)} />
      : <Landing onStart={() => setShowLogin(true)} />;
  }

  if (authed === null || isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--background)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '2.5px solid var(--card-border)',
            borderTopColor: 'var(--laccent)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p style={{ color: 'var(--fg-faint)', fontSize: 13 }}>Loading your data…</p>
        </div>
      </div>
    );
  }

  const activeSummary = selectedMonth !== 'all' ? monthlySummary : summary;
  const displayMonth = selectedMonth === 'all'
    ? 'All time'
    : new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      {/* Sidebar */}
      <Sidebar
        users={users}
        selectedUserId={selectedUserId}
        onUserChange={setSelectedUserId}
        activeView={activeView}
        onViewChange={setActiveView}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
        onAdd={() => { setEditingTransaction(undefined); setIsFormOpen(true); }}
        onOpenUpload={() => setIsGlobalImportOpen(true)}
        onOpenCategories={() => setIsCategoryManagerOpen(true)}
        onOpenUsers={() => setIsUserManagerOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onRefresh={() => { loadData(); setWalletRefreshKey(k => k + 1); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile drawer backdrop */}
      <div
        className={cn('sidebar-backdrop', isMobile && sidebarOpen && 'show')}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div style={{ marginLeft: isMobile ? 0 : 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 15,
          height: 54,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '0 14px' : '0 28px',
          background: 'var(--background)',
          borderBottom: '1px solid var(--card-border)',
        }}>
          {/* Hamburger (mobile only) */}
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1"
              onClick={() => setSidebarOpen(true)} title="Menu" aria-label="Open menu">
              <Menu style={{ width: 18, height: 18 }} />
            </Button>
          )}

          {/* View title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16, fontWeight: 600,
              letterSpacing: '-0.020em', color: 'var(--fg)',
            }}>
              {activeView === 'overview' && 'Overview'}
              {activeView === 'wallets' && 'Wallets'}
              {activeView === 'transactions' && 'Transactions'}
            </span>
          </div>

          {/* Month picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 font-medium tabular-nums text-xs">
                <Calendar className="w-3.5 h-3.5" />
                {displayMonth}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-2">
              <DropdownMenuItem
                onClick={() => setSelectedMonth('all')}
                className={cn('mb-1', selectedMonth === 'all' && 'bg-accent font-medium')}
              >
                All time
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mb-2" />
              <div className="grid grid-cols-2 gap-0.5">
                {availableMonths.map(m => {
                  const label = new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  return (
                    <DropdownMenuItem
                      key={m}
                      onClick={() => setSelectedMonth(m)}
                      className={cn('text-xs', m === selectedMonth && 'bg-accent font-medium')}
                    >
                      {label}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Logout */}
          <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={handleLogout} title="Keluar">
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </Button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: isMobile ? '16px 14px 40px' : '28px 28px 52px' }}>
          {!selectedUserId ? (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--fg-faint)', fontSize: 14 }}>
              No users found. Add a user to get started.
            </div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {activeView === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <span className="eyebrow">Summary</span>
                    <h1 className="display-heading" style={{ fontSize: 24, marginTop: 4 }}>
                      {selectedMonth === 'all'
                        ? 'All time'
                        : new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h1>
                  </div>
                  <FinancialSummaryComponent summary={activeSummary} />
                  <BalanceCrosscheckComponent
                    userId={selectedUserId}
                    year={selectedMonth !== 'all' ? parseInt(selectedMonth.split('-')[0]) : undefined}
                    month={selectedMonth !== 'all' ? parseInt(selectedMonth.split('-')[1]) : undefined}
                  />
                  <WalletFreshnessSummary
                    userId={selectedUserId}
                    refreshTrigger={walletRefreshKey}
                    onReview={() => setActiveView('wallets')}
                    onUpload={() => setIsGlobalImportOpen(true)}
                  />
                  <Dashboard userId={selectedUserId} />
                  <CategoryBreakdown userId={selectedUserId} transactions={transactions} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                    <SalaryCard transactions={transactions} />
                    <InvestmentCard transactions={transactions} wallets={wallets} />
                  </div>
                </div>
              )}

              {/* ── WALLETS ── */}
              {activeView === 'wallets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <span className="eyebrow">Your accounts</span>
                    <h1 className="display-heading" style={{ fontSize: 24, marginTop: 4 }}>Wallets</h1>
                  </div>
                  <WalletManager
                    userId={selectedUserId}
                    refreshTrigger={walletRefreshKey}
                    onUpload={() => setIsGlobalImportOpen(true)}
                  />
                </div>
              )}

              {/* ── TRANSACTIONS ── */}
              {activeView === 'transactions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <span className="eyebrow">All activity</span>
                    <h1 className="display-heading" style={{ fontSize: 24, marginTop: 4 }}>Transactions</h1>
                  </div>
                  <div className="glass glass-card" style={{ padding: '8px 8px 16px' }}>
                    <TransactionList
                      transactions={transactions}
                      onEdit={handleEdit}
                      onDelete={handleDeleteTransaction}
                    />
                  </div>
                </div>
              )}

            </>
          )}
        </main>

        <footer style={{ textAlign: 'center', color: 'var(--fg-faint)', fontSize: 11, padding: '12px 0 20px' }}>
          Ledger · personal finance tracker
        </footer>
      </div>

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
          background: 'oklch(0 0 0 / 0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setIsUserManagerOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <UserManager users={users} onRefresh={loadUsers} />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setIsUserManagerOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
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

      {selectedUserId && isGlobalImportOpen && (
        <GlobalImportModal
          userId={selectedUserId}
          onClose={() => setIsGlobalImportOpen(false)}
          onDone={() => { loadData(); setWalletRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
