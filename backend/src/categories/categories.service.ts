import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
    constructor(private readonly databaseService: DatabaseService) { }

    findAll(userId?: number): Category[] {
        if (userId) {
            return this.databaseService.all(
                'SELECT * FROM categories WHERE user_id = ? ORDER BY type, name',
                [userId]
            );
        }
        return this.databaseService.all('SELECT * FROM categories ORDER BY type, name');
    }

    findOne(id: number): Category {
        return this.databaseService.get('SELECT * FROM categories WHERE id = ?', [id]);
    }

    findByType(userId: number, type: 'income' | 'expense'): Category[] {
        return this.databaseService.all(
            'SELECT * FROM categories WHERE user_id = ? AND (type = ? OR type = ?) ORDER BY name',
            [userId, type, 'both']
        );
    }

    create(createCategoryDto: CreateCategoryDto): Category {
        const { user_id, name, type, icon, color } = createCategoryDto;

        this.databaseService.run(
            'INSERT INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
            [user_id, name, type, icon || null, color || null]
        );

        // Get the last inserted category
        return this.databaseService.get(
            'SELECT * FROM categories WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [user_id]
        );
    }

    update(id: number, updateCategoryDto: UpdateCategoryDto): Category {
        const category = this.findOne(id);
        if (!category) {
            throw new Error('Category not found');
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (updateCategoryDto.name !== undefined) {
            updates.push('name = ?');
            params.push(updateCategoryDto.name);
        }
        if (updateCategoryDto.type !== undefined) {
            updates.push('type = ?');
            params.push(updateCategoryDto.type);
        }
        if (updateCategoryDto.icon !== undefined) {
            updates.push('icon = ?');
            params.push(updateCategoryDto.icon);
        }
        if (updateCategoryDto.color !== undefined) {
            updates.push('color = ?');
            params.push(updateCategoryDto.color);
        }

        if (updates.length > 0) {
            params.push(id);
            this.databaseService.run(
                `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        return this.findOne(id);
    }

    remove(id: number): void {
        // Check if category is being used in transactions
        const transactions = this.databaseService.all(
            'SELECT id FROM transactions WHERE category = (SELECT name FROM categories WHERE id = ?)',
            [id]
        );

        if (transactions.length > 0) {
            throw new Error('Cannot delete category that is being used in transactions');
        }

        this.databaseService.run('DELETE FROM categories WHERE id = ?', [id]);
    }
}
