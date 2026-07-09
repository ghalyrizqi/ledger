import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Get()
    findAll(@Query('userId') userId?: string, @Query('type') type?: 'income' | 'expense') {
        if (userId && type) {
            return this.categoriesService.findByType(parseInt(userId), type);
        }
        return this.categoriesService.findAll(userId ? parseInt(userId) : undefined);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.categoriesService.findOne(parseInt(id));
    }

    @Post()
    create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoriesService.create(createCategoryDto);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
        return this.categoriesService.update(parseInt(id), updateCategoryDto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        await this.categoriesService.remove(parseInt(id));
    }
}
