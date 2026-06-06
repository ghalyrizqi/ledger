export class CreateInitialBalanceDto {
    user_id: number;
    year: number;
    month: number;
    balance: number;
    is_manual?: boolean;
}

export class UpdateInitialBalanceDto {
    balance?: number;
    is_manual?: boolean;
}
