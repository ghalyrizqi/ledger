
import { useState } from 'react';
import { User } from '@/types';
import { createUser, updateUser, deleteUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';

interface UserManagerProps {
    users: User[];
    onRefresh: () => void;
}

export default function UserManager({ users, onRefresh }: UserManagerProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userName, setUserName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; user: User | null }>({
        open: false,
        user: null,
    });

    const handleOpenForm = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setUserName(user.name);
        } else {
            setEditingUser(null);
            setUserName('');
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingUser(null);
        setUserName('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userName.trim()) return;

        setIsSubmitting(true);
        try {
            if (editingUser) {
                await updateUser(editingUser.id, userName);
            } else {
                await createUser(userName);
            }
            handleCloseForm();
            onRefresh();
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Failed to save user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm.user) return;

        try {
            await deleteUser(deleteConfirm.user.id);
            setDeleteConfirm({ open: false, user: null });
            onRefresh();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user');
        }
    };

    return (
        <>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">User Management</h2>
                            <p className="text-sm text-muted-foreground">
                                Manage users and their accounts
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => handleOpenForm()} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add User
                    </Button>
                </div>

                {/* Users List */}
                <div className="space-y-2">
                    {users.map((user) => (
                        <div
                            key={user.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-lg font-semibold text-primary">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold">{user.name}</p>
                                    <p className="text-sm text-muted-foreground">ID: {user.id}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenForm(user)}
                                >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeleteConfirm({ open: true, user })}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* User Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name *</label>
                            <Input
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="Enter user name"
                                required
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseForm}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : editingUser ? 'Update' : 'Add User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={deleteConfirm.open}
                onOpenChange={(open) => setDeleteConfirm({ open, user: null })}
                onConfirm={handleDelete}
                title="Delete User"
                description={`Are you sure you want to delete "${deleteConfirm.user?.name}"? This will also delete all their transactions, categories, and wallets. This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
            />
        </>
    );
}
