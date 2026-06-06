
import { User } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface UserSelectorProps {
    users: User[];
    selectedUserId: number | null;
    onUserChange: (userId: number) => void;
}

export default function UserSelector({ users, selectedUserId, onUserChange }: UserSelectorProps) {
    return (
        <div className="flex items-center gap-3">
            <label htmlFor="user-select" className="text-sm font-medium">
                Select User:
            </label>
            <Select
                value={selectedUserId?.toString() || ''}
                onValueChange={(value) => onUserChange(parseInt(value, 10))}
            >
                <SelectTrigger id="user-select" className="w-[200px]">
                    <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                    {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
