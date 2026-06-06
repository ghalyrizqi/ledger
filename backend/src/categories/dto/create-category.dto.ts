export class CreateCategoryDto {
    user_id: number;
    name: string;
    type: 'income' | 'expense' | 'both';
    icon?: string;
    color?: string;
}
