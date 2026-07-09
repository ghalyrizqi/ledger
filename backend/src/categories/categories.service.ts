import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
    constructor(private readonly databaseService: DatabaseService) { }

    async findAll(userId?: number): Promise<Category[]> {
        if (userId) {
            return this.databaseService.all(
                'SELECT * FROM categories WHERE user_id = ? ORDER BY type, name',
                [userId]
            );
        }
        return this.databaseService.all('SELECT * FROM categories ORDER BY type, name');
    }

    async findOne(id: number): Promise<Category> {
        return this.databaseService.get('SELECT * FROM categories WHERE id = ?', [id]);
    }

    async findByType(userId: number, type: 'income' | 'expense'): Promise<Category[]> {
        return this.databaseService.all(
            'SELECT * FROM categories WHERE user_id = ? AND (type = ? OR type = ?) ORDER BY name',
            [userId, type, 'both']
        );
    }

    async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
        const { user_id, name, type, icon, color } = createCategoryDto;
        return this.databaseService.get(
            `INSERT INTO categories (user_id, name, type, icon, color)
             VALUES (?, ?, ?, ?, ?) RETURNING *`,
            [user_id, name, type, icon || null, color || null]
        );
    }

    async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
        const category = await this.findOne(id);
        if (!category) throw new Error('Category not found');

        const updates: string[] = [];
        const params: any[] = [];

        if (updateCategoryDto.name  !== undefined) { updates.push('name = ?');  params.push(updateCategoryDto.name); }
        if (updateCategoryDto.type  !== undefined) { updates.push('type = ?');  params.push(updateCategoryDto.type); }
        if (updateCategoryDto.icon  !== undefined) { updates.push('icon = ?');  params.push(updateCategoryDto.icon); }
        if (updateCategoryDto.color !== undefined) { updates.push('color = ?'); params.push(updateCategoryDto.color); }

        if (updates.length > 0) {
            params.push(id);
            await this.databaseService.run(
                `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        return this.findOne(id);
    }

    async remove(id: number): Promise<void> {
        const transactions = await this.databaseService.all(
            'SELECT id FROM transactions WHERE category = (SELECT name FROM categories WHERE id = ?)',
            [id]
        );
        if (transactions.length > 0) {
            throw new Error('Cannot delete category that is being used in transactions');
        }
        await this.databaseService.run('DELETE FROM categories WHERE id = ?', [id]);
    }
}
