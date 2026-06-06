import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    async findAll(): Promise<User[]> {
        return this.usersService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<User> {
        return this.usersService.findOne(parseInt(id));
    }

    @Post()
    async create(@Body() user: { name: string }): Promise<User> {
        return this.usersService.create(user.name);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() user: { name: string }): Promise<User> {
        return this.usersService.update(parseInt(id), user.name);
    }

    @Delete(':id')
    async delete(@Param('id') id: string): Promise<void> {
        return this.usersService.delete(parseInt(id));
    }
}
