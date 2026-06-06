
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

interface InitialBalanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (balance: number) => void;
    currentBalance: number;
    year: number;
    month: number;
    isManual?: boolean;
    onReset?: () => void;
}

export default function InitialBalanceDialog({
    isOpen,
    onClose,
    onSave,
    currentBalance,
    year,
    month,
    isManual = false,
    onReset,
}: InitialBalanceDialogProps) {
    const [balance, setBalance] = useState(currentBalance.toString());

    const handleSave = () => {
        const numBalance = parseFloat(balance);
        if (!isNaN(numBalance)) {
            onSave(numBalance);
            onClose();
        }
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Initial Balance - {monthNames[month - 1]} {year}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Initial Balance</label>
                        <Input
                            type="number"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            placeholder="Enter initial balance"
                            step="0.01"
                        />
                    </div>

                    {isManual ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                ⚠️ This balance was manually overridden. It will not automatically update if previous months change.
                            </p>
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (onReset) onReset();
                                        onClose();
                                    }}
                                    className="w-full sm:w-auto mt-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                >
                                    ♻️ Reset to Auto-Calculate
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                ℹ️ This will set the starting balance for this month as a manual override.
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
