
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Wallet, List, BarChart2,
  Upload, Plus, Sun, Moon, ChevronDown,
  Users, FolderOpen, FileUp, RefreshCw,
} from 'lucide-react';

type View = 'overview' | 'wallets' | 'transactions' | 'analytics';

interface SidebarProps {
  users: User[];
  selectedUserId: number | null;
  onUserChange: (id: number) => void;
  activeView: View;
  onViewChange: (v: View) => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onAdd: () => void;
  onOpenUpload: () => void;
  onOpenCategories: () => void;
  onOpenUsers: () => void;
  onOpenImport: () => void;
  onRefresh: () => void;
}

function LogoMark() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
      background: 'var(--gradient-income)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 0 1px oklch(1 0 0 / 0.20) inset, 0 4px 14px var(--accent-glow)',
    }}>
      <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
        <path d="M3 11 L7 5 L9.5 8.5 L13 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="13" cy="3" r="1.5" fill="white" />
      </svg>
    </div>
  );
}

function UserAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--gradient-income)',
      color: 'white', fontSize: size * 0.36, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{initials}</div>
  );
}

const NAV_ITEMS: { id: View; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview',      label: 'Overview',      Icon: LayoutDashboard },
  { id: 'wallets',       label: 'Wallets',        Icon: Wallet },
  { id: 'transactions',  label: 'Transactions',   Icon: List },
  { id: 'analytics',     label: 'Analytics',      Icon: BarChart2 },
];

export default function Sidebar({
  users, selectedUserId, onUserChange,
  activeView, onViewChange,
  darkMode, onToggleDark,
  onAdd, onOpenUpload, onOpenCategories, onOpenUsers, onOpenImport, onRefresh,
}: SidebarProps) {
  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <aside className="sidebar-root">
      {/* Logo */}
      <div style={{
        padding: '18px 16px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--card-border)',
        flexShrink: 0,
      }}>
        <LogoMark />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15, fontWeight: 700,
            letterSpacing: '-0.025em', color: 'var(--fg)',
          }}>
            Ledger
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-faint)', letterSpacing: '0.10em', textTransform: 'uppercase', marginTop: 1 }}>
            Finance
          </div>
        </div>
      </div>

      {/* User selector */}
      <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', padding: '8px 10px', borderRadius: 10,
              background: 'var(--sidebar-item-hover)',
              border: '1px solid var(--card-border)',
              cursor: 'pointer', textAlign: 'left',
            }}>
              {selectedUser && <UserAvatar name={selectedUser.name} size={26} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedUser?.name ?? 'Select user'}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-faint)' }}>Personal account</div>
              </div>
              <ChevronDown style={{ width: 12, height: 12, color: 'var(--fg-faint)', flexShrink: 0 }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {users.map(u => (
              <DropdownMenuItem
                key={u.id}
                onClick={() => onUserChange(u.id)}
                className={cn('gap-2.5', u.id === selectedUserId && 'bg-accent')}
              >
                <UserAvatar name={u.name} size={20} />
                {u.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenUsers} className="gap-2.5 text-xs">
              <Users className="w-3.5 h-3.5" /> Manage users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenCategories} className="gap-2.5 text-xs">
              <FolderOpen className="w-3.5 h-3.5" /> Manage categories
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenImport} className="gap-2.5 text-xs">
              <FileUp className="w-3.5 h-3.5" /> Import via CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        <div style={{ padding: '4px 0 2px 20px', marginBottom: 4 }}>
          <span className="eyebrow">Menu</span>
        </div>
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={cn('sidebar-nav-item', activeView === id && 'active')}
            onClick={() => onViewChange(id)}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{
        padding: '10px 12px 14px',
        borderTop: '1px solid var(--card-border)',
        display: 'flex', flexDirection: 'column', gap: 6,
        flexShrink: 0,
      }}>
        {/* Import statement */}
        <button
          onClick={onOpenUpload}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 10px', borderRadius: 9,
            background: 'var(--accent-soft)',
            border: '1px solid oklch(from var(--laccent) l c h / 0.22)',
            cursor: 'pointer', color: 'var(--laccent)',
            fontSize: 13, fontWeight: 500,
          }}
        >
          <Upload style={{ width: 14, height: 14, flexShrink: 0 }} />
          Upload statement
        </button>

        {/* New transaction */}
        <button
          onClick={onAdd}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            width: '100%', height: 38, borderRadius: 9,
            background: 'var(--laccent)',
            border: 'none',
            cursor: 'pointer', color: 'white',
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 0 0 1px oklch(1 0 0 / 0.18) inset, 0 4px 14px var(--accent-glow)',
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          New transaction
        </button>

        {/* Dark mode + Refresh row */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 flex-1"
            title="Refresh"
            onClick={onRefresh}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 flex-1"
            title={darkMode ? 'Switch to light' : 'Switch to dark'}
            onClick={onToggleDark}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
