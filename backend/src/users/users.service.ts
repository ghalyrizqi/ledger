import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
    constructor(private readonly databaseService: DatabaseService) { }

    async findAll(): Promise<User[]> {
        return this.databaseService.all('SELECT * FROM users ORDER BY name');
    }

    async findOne(id: number): Promise<User> {
        return this.databaseService.get('SELECT * FROM users WHERE id = ?', [id]);
    }

    async create(name: string): Promise<User> {
        this.databaseService.run('INSERT INTO users (name) VALUES (?)', [name]);
        const lastId = this.databaseService.get('SELECT last_insert_rowid() as id');
        return this.findOne(lastId.id);
    }

    async update(id: number, name: string): Promise<User> {
        this.databaseService.run('UPDATE users SET name = ? WHERE id = ?', [name, id]);
        return this.findOne(id);
    }

    async delete(id: number): Promise<void> {
        this.databaseService.run('DELETE FROM users WHERE id = ?', [id]);
    }
}
