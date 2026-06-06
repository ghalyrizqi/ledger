
import { useState, useEffect } from 'react';
import { Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface CategoryFormProps {
    userId: number;
    category?: Category;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (category: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
}

const PRESET_COLORS = [
    // Reds
    '#ef4444', '#dc2626', '#f87171', '#fca5a5',
    // Oranges
    '#f97316', '#ea580c', '#fb923c', '#fdba74',
    // Yellows
    '#eab308', '#ca8a04', '#facc15', '#fde047',
    // Greens
    '#10b981', '#059669', '#34d399', '#6ee7b7',
    // Teals
    '#14b8a6', '#0d9488', '#2dd4bf', '#5eead4',
    // Blues
    '#3b82f6', '#2563eb', '#60a5fa', '#93c5fd',
    // Indigos
    '#6366f1', '#4f46e5', '#818cf8', '#a5b4fc',
    // Purples
    '#8b5cf6', '#7c3aed', '#a78bfa', '#c4b5fd',
    // Pinks
    '#ec4899', '#db2777', '#f472b6', '#f9a8d4',
    // Grays
    '#64748b', '#475569', '#94a3b8', '#cbd5e1',
];

const PRESET_ICONS = [
    // Money & Finance
    '💰', '💵', '💴', '💶', '💷', '💳', '💸', '🪙',
    // Work & Business
    '💼', '👔', '🏢', '📊', '📈', '📉', '💹', '🏦',
    // Shopping & Retail
    '🛍️', '🛒', '🏪', '🏬', '🎁', '🎀', '📦', '🛍',
    // Food & Dining
    '🍔', '🍕', '🍜', '🍱', '🍰', '☕', '🍺', '🍷',
    // Transportation
    '🚗', '🚕', '🚙', '🚌', '🚎', '🚐', '✈️', '🚂',
    // Home & Living
    '🏠', '🏡', '🏘️', '🛋️', '🛏️', '🚪', '🔑', '🏗️',
    // Health & Medical
    '🏥', '💊', '💉', '🩺', '⚕️', '🧘', '💪', '🏃',
    // Education
    '📚', '📖', '✏️', '📝', '🎓', '🏫', '📄', '📋',
    // Entertainment
    '🎬', '🎮', '🎵', '🎸', '🎨', '🎭', '🎪', '🎯',
    // Technology
    '💻', '📱', '⌨️', '🖥️', '📷', '📹', '🎧', '🔌',
    // Sports & Fitness
    '⚽', '🏀', '🎾', '🏋️', '🚴', '🏊', '⛷️', '🏌️',
    // Travel & Vacation
    '🌍', '🗺️', '🧳', '🏖️', '🏝️', '🗼', '🎢', '🎡',
];

export default function CategoryForm({
    userId,
    category,
    isOpen,
    onClose,
    onSubmit,
}: CategoryFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        type: 'expense' as 'income' | 'expense' | 'both',
        icon: '💰',
        color: '#3b82f6',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name,
                type: category.type,
                icon: category.icon || '💰',
                color: category.color || '#3b82f6',
            });
        } else {
            setFormData({
                name: '',
                type: 'expense',
                icon: '💰',
                color: '#3b82f6',
            });
        }
    }, [category, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await onSubmit({
                user_id: userId,
                name: formData.name,
                type: formData.type,
                icon: formData.icon,
                color: formData.color,
            });
            onClose();
        } catch (error) {
            console.error('Error submitting category:', error);
            alert('Failed to save category');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{category ? 'Edit Category' : 'Add New Category'}</DialogTitle>
                    <DialogDescription>
                        {category ? 'Update the category details below.' : 'Create a new category for your transactions.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="name" className="text-sm font-medium">
                                Category Name
                            </label>
                            <Input
                                id="name"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Groceries, Rent, Bonus"
                            />
                        </div>

                        <div className="grid gap-2">
                            <label htmlFor="type" className="text-sm font-medium">
                                Type
                            </label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: 'income' | 'expense' | 'both') =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger id="type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                    <SelectItem value="both">Both</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Icon (96 choices)</label>
                            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 bg-gray-50 dark:bg-gray-900">
                                <div className="grid grid-cols-12 gap-1">
                                    {PRESET_ICONS.map((icon) => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon })}
                                            className={`p-2 text-xl rounded-md border-2 transition-all hover:scale-110 ${formData.icon === icon
                                                ? 'border-primary bg-primary/10'
                                                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                                }`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Color (40 choices)</label>
                                <div className="grid grid-cols-10 gap-2">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            className={`w-10 h-10 rounded-md border-2 transition-all hover:scale-110 shadow-sm ${formData.color === color
                                                ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-primary'
                                                : 'border-gray-200 dark:border-gray-700'
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                                <div
                                    className="w-12 h-12 rounded-md flex items-center justify-center text-2xl"
                                    style={{ backgroundColor: formData.color }}
                                >
                                    {formData.icon}
                                </div>
                                <div>
                                    <p className="font-medium">{formData.name || 'Category Name'}</p>
                                    <p className="text-sm text-muted-foreground capitalize">{formData.type}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : category ? 'Update' : 'Create Category'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
