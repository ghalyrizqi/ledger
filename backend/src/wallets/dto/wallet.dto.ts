export class CreateWalletDto {
    user_id: number;
    name: string;
    type: 'bank' | 'ewallet' | 'cash' | 'other';
    balance: number;
    icon?: string;
    color?: string;
    bank_type?: 'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee' | null;
    account_number?: string | null;
}

export class UpdateWalletDto {
    name?: string;
    type?: 'bank' | 'ewallet' | 'cash' | 'other';
    balance?: number;
    icon?: string;
    color?: string;
    bank_type?: 'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee' | null;
    account_number?: string | null;
}
