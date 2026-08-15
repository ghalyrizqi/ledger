
import { useState, useEffect } from 'react';
import { Wallet } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface WalletFormProps {
    wallet?: Wallet;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (wallet: Omit<Wallet, 'id' | 'created_at'>) => Promise<void>;
    userId: number;
}

const WALLET_TYPES = [
    { value: 'bank', label: 'Bank Account', icon: '🏦', color: '#3b82f6' },
    { value: 'ewallet', label: 'E-Wallet', icon: '💳', color: '#10b981' },
    { value: 'cash', label: 'Cash', icon: '💵', color: '#059669' },
    { value: 'other', label: 'Other', icon: '💰', color: '#8b5cf6' },
] as const;

const ICON_OPTIONS = [
    // Money & banking
    '🏦', '💳', '💵', '💰', '💸', '🪙', '💴', '💶', '💷', '💲', '🏧', '🧾',
    // Life & spending
    '🏠', '🚗', '✈️', '🛒', '🍔', '☕', '🎁', '💊', '📚', '🎮',
    '🎵', '🏋️', '🎯', '💼', '📱', '🌿', '🐷', '💎', '🌟', '🔑',
    // Fun & extra
    '🦊', '🏆', '⚡', '🌈', '🎪', '🌙', '🏪', '🎨', '🚀', '🌺',
];

const COLOR_OPTIONS = [
    // Blues
    '#1d4ed8', '#3b82f6', '#06b6d4', '#0891b2',
    // Greens
    '#166534', '#059669', '#10b981', '#84cc16',
    // Purples & pinks
    '#7c3aed', '#8b5cf6', '#a855f7', '#ec4899',
    // Reds & oranges
    '#991b1b', '#ef4444', '#f97316', '#f59e0b',
    // Teals & slates
    '#14b8a6', '#6366f1', '#64748b', '#0f172a',
];

function hexToRgb(hex: string): string {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0');
    const n = parseInt(full.slice(0, 6), 16);
    if (isNaN(n)) return '4,57,94';
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function MiniCard({ icon, name, color }: { icon: string; name: string; color: string }) {
    const rgb = hexToRgb(color);
    return (
        <div style={{
            borderRadius: 12, padding: '12px 14px',
            background: 'var(--glass)',
            border: '1px solid var(--card-border)',
            backdropFilter: 'blur(12px)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', gap: 10,
        }}>
            <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 90, height: 90, borderRadius: '50%',
                background: `radial-gradient(circle, rgba(${rgb},0.28), transparent 75%)`,
                pointerEvents: 'none',
            }} />
            <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'rgba(3,29,68,0.04)', border: '1px solid var(--card-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, fontSize: 16,
            }}>
                {icon || '🏦'}
            </div>
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
                    {name || 'Wallet Name'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>Preview</div>
            </div>
            <div style={{
                marginLeft: 'auto', fontSize: 13, fontWeight: 600,
                color: 'var(--fg)', flexShrink: 0,
            }}>
                Rp 0
            </div>
        </div>
    );
}

export default function WalletForm({ wallet, isOpen, onClose, onSubmit, userId }: WalletFormProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'bank' | 'ewallet' | 'cash' | 'other'>('bank');
    const [balance, setBalance] = useState('');
    const [icon, setIcon] = useState('');
    const [color, setColor] = useState('');
    const [bankType, setBankType] = useState<'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee' | 'ovo' | 'bibit' | 'gopay' | ''>('');
    const [freshnessEnabled, setFreshnessEnabled] = useState(true);
    const [freshnessMode, setFreshnessMode] = useState<'statement' | 'manual'>('statement');
    const [updateFrequency, setUpdateFrequency] = useState<'weekly' | 'monthly' | 'manual'>('monthly');
    const [expectedDay, setExpectedDay] = useState(7);
    const [graceDays, setGraceDays] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (wallet) {
            setName(wallet.name);
            setType(wallet.type);
            setBalance(wallet.balance.toString());
            setIcon(wallet.icon || '');
            setColor(wallet.color || COLOR_OPTIONS[1]);
            setBankType((wallet.bank_type as any) || '');
            setFreshnessEnabled(wallet.freshness_enabled ?? true);
            setFreshnessMode(wallet.freshness_mode ?? 'statement');
            setUpdateFrequency(wallet.update_frequency ?? 'monthly');
            setExpectedDay(wallet.expected_day ?? 7);
            setGraceDays(wallet.grace_days ?? 0);
        } else {
            const defaultType = WALLET_TYPES[0];
            setName('');
            setType('bank');
            setBalance('0');
            setIcon(defaultType.icon);
            setColor(defaultType.color);
            setBankType('');
            setFreshnessEnabled(true);
            setFreshnessMode('statement');
            setUpdateFrequency('monthly');
            setExpectedDay(7);
            setGraceDays(0);
        }
    }, [wallet, isOpen]);

    const handleTypeChange = (newType: string) => {
        setType(newType as 'bank' | 'ewallet' | 'cash' | 'other');
        const manual = newType === 'cash' || newType === 'other';
        setFreshnessMode(manual ? 'manual' : 'statement');
        setUpdateFrequency(manual ? 'manual' : newType === 'ewallet' ? 'weekly' : 'monthly');
        const typeConfig = WALLET_TYPES.find(t => t.value === newType);
        if (typeConfig && !wallet) {
            setIcon(typeConfig.icon);
            setColor(typeConfig.color);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit({
                user_id: userId,
                name,
                type,
                balance: parseFloat(balance) || 0,
                icon: icon || undefined,
                color: color || undefined,
                bank_type: bankType || null,
                account_number: null,
                freshness_enabled: freshnessEnabled,
                freshness_mode: freshnessMode,
                update_frequency: updateFrequency,
                expected_day: expectedDay,
                grace_days: graceDays,
            } as any);
            handleClose();
        } catch {
            alert('Failed to save wallet');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setName('');
        setType('bank');
        setBalance('0');
        setIcon('');
        setColor('');
        setBankType('');
        onClose();
    };

    const activeColor = color || '#3b82f6';

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{wallet ? 'Edit Wallet' : 'Add New Wallet'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Live preview */}
                    <MiniCard icon={icon} name={name} color={activeColor} />

                    {/* Wallet Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Wallet Name *</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., BCA Savings, GoPay, Cash"
                            required
                        />
                    </div>

                    {/* Wallet Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Type *</label>
                        <Select value={type} onValueChange={handleTypeChange}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {WALLET_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.icon} {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Balance */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Current Balance *</label>
                        <Input
                            type="number"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            placeholder="0"
                            step="0.01"
                            required
                        />
                    </div>

                    {/* Icon Picker */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Icon</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {ICON_OPTIONS.map((i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setIcon(i)}
                                    style={{
                                        width: 38, height: 38, borderRadius: 9, fontSize: 20,
                                        border: `2px solid ${icon === i ? activeColor : 'var(--card-border)'}`,
                                        background: icon === i ? `rgba(${hexToRgb(activeColor)},0.12)` : 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer',
                                        transform: icon === i ? 'scale(1.15)' : 'scale(1)',
                                        transition: 'all 0.12s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Color</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
                            {COLOR_OPTIONS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={{
                                        aspectRatio: '1', borderRadius: 8,
                                        background: c,
                                        border: color === c ? `3px solid white` : '2px solid transparent',
                                        boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                                        cursor: 'pointer',
                                        transform: color === c ? 'scale(1.15)' : 'scale(1)',
                                        transition: 'all 0.12s',
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Bank Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Bank (for statement import)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(['', 'bca', 'permata', 'jago', 'stockbit', 'dana', 'shopee', 'ovo', 'bibit', 'gopay'] as const).map(bt => {
                                const labels: Record<string, string> = {
                                    '': 'None', bca: 'BCA', permata: 'Permata', jago: 'Jago',
                                    stockbit: 'Stockbit', dana: 'Dana', shopee: 'Shopee', ovo: 'OVO', bibit: 'Bibit', gopay: 'GoPay',
                                };
                                const active = bankType === bt;
                                return (
                                    <button
                                        key={bt}
                                        type="button"
                                        onClick={() => setBankType(bt as any)}
                                        style={{
                                            height: 30, padding: '0 12px', borderRadius: 999,
                                            background: active ? activeColor : 'rgba(255,255,255,0.6)',
                                            color: active ? '#fff' : 'var(--fg-muted)',
                                            border: `1px solid ${active ? activeColor : 'var(--card-border)'}`,
                                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                            whiteSpace: 'nowrap', transition: 'all 0.12s',
                                        }}
                                    >
                                        {labels[bt]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--surface-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div className="text-sm font-medium">Freshness tracking</div>
                                <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 2 }}>Show when this wallet needs an update.</div>
                            </div>
                            <input type="checkbox" checked={freshnessEnabled} onChange={e => setFreshnessEnabled(e.target.checked)} />
                        </div>
                        {freshnessEnabled && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Update schedule</label>
                                    <Select value={updateFrequency} onValueChange={value => {
                                        const frequency = value as 'weekly' | 'monthly' | 'manual';
                                        setUpdateFrequency(frequency);
                                        setFreshnessMode(frequency === 'manual' ? 'manual' : 'statement');
                                    }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="weekly">Weekly statement</SelectItem>
                                            <SelectItem value="monthly">Monthly statement</SelectItem>
                                            <SelectItem value="manual">Manual balance confirmation</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {updateFrequency === 'monthly' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Due day</label>
                                            <Input type="number" min={1} max={28} value={expectedDay} onChange={e => setExpectedDay(Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Grace days</label>
                                            <Input type="number" min={0} max={30} value={graceDays} onChange={e => setGraceDays(Number(e.target.value))} />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : wallet ? 'Update' : 'Add Wallet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
