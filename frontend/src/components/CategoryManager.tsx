
import { useState } from 'react';
import { Category } from '@/types';
import { Button } from '@/components/ui/button';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import CategoryForm from './CategoryForm';

interface CategoryManagerProps {
    userId: number;
    categories: Category[];
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    onCreate: (category: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
    onUpdate: (id: number, category: Partial<Category>) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}

export default function CategoryManager({
    userId,
    categories,
    isOpen,
    onClose,
    onRefresh,
    onCreate,
    onUpdate,
    onDelete,
}: CategoryManagerProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | undefined>();

    const incomeCategories = categories.filter(c => c.type === 'income' || c.type === 'both');
    const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both');

    const handleCreate = async (category: Omit<Category, 'id' | 'created_at'>) => {
        await onCreate(category);
        await onRefresh();
        setIsFormOpen(false);
    };

    const handleUpdate = async (category: Omit<Category, 'id' | 'created_at'>) => {
        if (editingCategory) {
            await onUpdate(editingCategory.id, category);
            await onRefresh();
            setEditingCategory(undefined);
            setIsFormOpen(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
            try {
                await onDelete(id);
                await onRefresh();
            } catch (error: any) {
                alert(error.response?.data?.message || 'Failed to delete category. It may be in use.');
            }
        }
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCategory(undefined);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Manage Categories</h2>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Add Category Button */}
                    <Button
                        onClick={() => {
                            setEditingCategory(undefined);
                            setIsFormOpen(true);
                        }}
                        className="w-full mb-6"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Category
                    </Button>

                    {/* Income Categories */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3 text-emerald-600 dark:text-emerald-400">
                            Income Categories
                        </h3>
                        <div className="space-y-2">
                            {incomeCategories.map((category) => (
                                <div
                                    key={category.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-md flex items-center justify-center text-xl"
                                            style={{ backgroundColor: category.color || '#3b82f6' }}
                                        >
                                            {category.icon || '💰'}
                                        </div>
                                        <span className="font-medium">{category.name}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(category)}
                                            className="h-8 w-8"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(category.id, category.name)}
                                            className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Expense Categories */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-rose-600 dark:text-rose-400">
                            Expense Categories
                        </h3>
                        <div className="space-y-2">
                            {expenseCategories.map((category) => (
                                <div
                                    key={category.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-md flex items-center justify-center text-xl"
                                            style={{ backgroundColor: category.color || '#3b82f6' }}
                                        >
                                            {category.icon || '💳'}
                                        </div>
                                        <span className="font-medium">{category.name}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(category)}
                                            className="h-8 w-8"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(category.id, category.name)}
                                            className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Form Dialog */}
            <CategoryForm
                userId={userId}
                category={editingCategory}
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                onSubmit={editingCategory ? handleUpdate : handleCreate}
            />
        </>
    );
}
