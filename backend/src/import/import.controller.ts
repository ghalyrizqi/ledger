import {
  Controller, Post, Body, UploadedFiles, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportService, BankType, PreviewRow, PreviewMeta } from './import.service';

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  async preview(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('walletId') walletId: string,
    @Body('bankType') bankType: string,
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    if (!walletId) throw new BadRequestException('walletId is required');
    if (!bankType) throw new BadRequestException('bankType is required');

    const allowed: BankType[] = ['bca', 'permata', 'jago', 'stockbit', 'dana', 'shopee'];
    if (!allowed.includes(bankType as BankType)) {
      throw new BadRequestException(`bankType must be one of: ${allowed.join(', ')}`);
    }

    return this.importService.preview(
      parseInt(walletId),
      bankType as BankType,
      files.map(f => ({ buffer: f.buffer, mimeType: f.mimetype })),
    );
  }

  @Post('confirm')
  async confirm(
    @Body('userId') userId: string,
    @Body('rows') rows: PreviewRow[],
    @Body('meta') meta?: PreviewMeta,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.importService.confirm(parseInt(userId), rows, meta);
  }
}
