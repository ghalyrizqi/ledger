type BankType = 'bca' | 'permata' | 'jago' | 'stockbit' | 'dana' | 'shopee' | 'ovo' | 'bibit' | 'gopay' | null;

export class CreateWalletDto {
    user_id: number;
    name: string;
    type: 'bank' | 'ewallet' | 'cash' | 'other';
    balance: number;
    icon?: string;
    color?: string;
    bank_type?: BankType;
    account_number?: string | null;
}

export class UpdateWalletDto {
    name?: string;
    type?: 'bank' | 'ewallet' | 'cash' | 'other';
    balance?: number;
    icon?: string;
    color?: string;
    bank_type?: BankType;
    account_number?: string | null;
    gain_amt?: number | null;
    gain_pct?: number | null;
}
