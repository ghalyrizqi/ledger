
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

const ICON_OPTIONS = ['🏦', '💳', '💵', '💰', '💸', '🪙', '💴', '💶', '💷', '💲', '📱', '🏪', '🏧'];
const COLOR_OPTIONS = ['#3b82f6', '#10b981', '#059669', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#6366f1'];

export default function WalletForm({ wallet, isOpen, onClose, onSubmit, userId }: WalletFormProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'bank' | 'ewallet' | 'cash' | 'other'>('bank');
    const [balance, setBalance] = useState('');
    const [icon, setIcon] = useState('');
    const [color, setColor] = useState('');
    const [bankType, setBankType] = useState<'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee' | ''>('');
    const [accountNumber, setAccountNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (wallet) {
            setName(wallet.name);
            setType(wallet.type);
            setBalance(wallet.balance.toString());
            setIcon(wallet.icon || '');
            setColor(wallet.color || '');
            setBankType((wallet.bank_type as any) || '');
            setAccountNumber(wallet.account_number || '');
        } else {
            // Set defaults for new wallet
            const defaultType = WALLET_TYPES[0];
            setName('');
            setType('bank');
            setBalance('0');
            setIcon(defaultType.icon);
            setColor(defaultType.color);
            setBankType('');
            setAccountNumber('');
        }
    }, [wallet, isOpen]);

    const handleTypeChange = (newType: string) => {
        setType(newType as 'bank' | 'ewallet' | 'cash' | 'other');
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
                account_number: accountNumber.trim() || null,
            } as any);
            handleClose();
        } catch (error) {
            console.error('Error submitting wallet:', error);
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
        setAccountNumber('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{wallet ? 'Edit Wallet' : 'Add New Wallet'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <label className="text-sm font-medium">Icon (optional)</label>
                        <div className="flex flex-wrap gap-2">
                            {ICON_OPTIONS.map((i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setIcon(i)}
                                    className={`w-10 h-10 rounded-lg border-2 text-xl transition-all ${icon === i
                                            ? 'border-primary bg-primary/10 scale-110'
                                            : 'border-gray-200 hover:border-primary/50'
                                        }`}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Color (optional)</label>
                        <div className="flex flex-wrap gap-2">
                            {COLOR_OPTIONS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-10 h-10 rounded-lg border-2 transition-all ${color === c
                                            ? 'border-gray-900 dark:border-white scale-110'
                                            : 'border-gray-200'
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Bank Type (for statement import) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Bank (for statement import)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(['', 'bca', 'permata', 'jago', 'stockbit', 'dana', 'shopee'] as const).map(bt => {
                                const labels: Record<string, string> = {
                                    '': 'None', bca: 'BCA', permata: 'Permata', jago: 'Jago',
                                    stockbit: 'Stockbit', dana: 'Dana', shopee: 'Shopee',
                                };
                                const active = bankType === bt;
                                return (
                                    <button
                                        key={bt}
                                        type="button"
                                        onClick={() => setBankType(bt as any)}
                                        style={{
                                            height: 30, padding: '0 12px', borderRadius: 999,
                                            background: active ? 'var(--laccent)' : 'rgba(255,255,255,0.6)',
                                            color: active ? '#fff' : 'var(--fg-muted)',
                                            border: `1px solid ${active ? 'var(--laccent)' : 'var(--glass-border)'}`,
                                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {labels[bt]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Account Number */}
                    {bankType && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Account Number{' '}
                                <span style={{ fontWeight: 400, color: 'var(--fg-faint)' }}>(optional)</span>
                            </label>
                            <Input
                                value={accountNumber}
                                onChange={e => setAccountNumber(e.target.value)}
                                placeholder="e.g. 4290910523"
                                className="glass-input"
                            />
                            <p style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 2 }}>
                                Transfers are auto-detected using your name. Add an account number only if your statement uses it instead.
                            </p>
                        </div>
                    )}

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
