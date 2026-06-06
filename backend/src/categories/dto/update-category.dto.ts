export class UpdateCategoryDto {
    name?: string;
    type?: 'income' | 'expense' | 'both';
    icon?: string;
    color?: string;
}
