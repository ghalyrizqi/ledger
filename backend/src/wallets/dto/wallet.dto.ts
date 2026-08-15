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
    freshness_enabled?: boolean;
    freshness_mode?: 'statement' | 'manual';
    update_frequency?: 'weekly' | 'monthly' | 'manual';
    expected_day?: number;
    grace_days?: number;
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
    freshness_enabled?: boolean;
    freshness_mode?: 'statement' | 'manual';
    update_frequency?: 'weekly' | 'monthly' | 'manual';
    expected_day?: number;
    grace_days?: number;
}
