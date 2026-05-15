import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { EmailListAutoUpdate } from '@prisma/client';
import { Request, Response } from 'express';
import { Type } from 'class-transformer';
import { IsArray, ArrayMaxSize, IsEnum, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { requestImportCancelCheck } from '../import-export/import-stream-hooks';
import { EmailListsService } from './email-lists.service';

class CreateListDto {
  @IsString()
  name!: string;
}

class UpdateListDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(EmailListAutoUpdate)
  autoUpdate?: EmailListAutoUpdate;
}

class ImportCsvDto {
  @IsString()
  csv!: string;
}

class ImportSheetDto {
  @IsString()
  url!: string;
}

class ImportIdsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

class RemoveItemsDto {
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];
}

class SetItemEmailsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  emails!: string[];
}

class ExportBodyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}

class ListItemsQuery {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit = 50;
}

@Controller('email-marketing/lists')
@UseGuards(JwtAuthGuard)
export class EmailListsController {
  constructor(private readonly lists: EmailListsService) {}

  @Get()
  async all(@CurrentUser() user: JwtUser) {
    return this.lists.list(user.userId);
  }

  @Get('trash')
  async trash(@CurrentUser() user: JwtUser) {
    return this.lists.listDeleted(user.userId);
  }

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() body: CreateListDto) {
    return this.lists.create(user.userId, body.name);
  }

  @Get(':id')
  async one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lists.get(user.userId, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: UpdateListDto) {
    return this.lists.update(user.userId, id, body);
  }

  @Delete(':id/permanent')
  async permanent(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lists.permanentDeleteFromTrash(user.userId, id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lists.softDelete(user.userId, id);
  }

  @Post(':id/restore')
  async restore(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lists.restore(user.userId, id);
  }

  @Get(':id/items')
  async items(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() q: ListItemsQuery,
  ) {
    return this.lists.listItems(user.userId, id, q.page, q.limit);
  }

  @Post(':id/items/remove')
  async removeItems(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: RemoveItemsDto) {
    return this.lists.removeItems(user.userId, id, body.itemIds);
  }

  @Patch(':id/items/:itemId/emails')
  async setItemEmails(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: SetItemEmailsDto,
  ) {
    return this.lists.setItemEmails(user.userId, id, itemId, body.emails);
  }

  @Post(':id/import/csv')
  async importCsv(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: ImportCsvDto) {
    return this.lists.importCsv(user.userId, id, body.csv);
  }

  @Post(':id/import/csv/stream')
  async importCsvStream(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: ImportCsvDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const abort = requestImportCancelCheck(req);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();
    try {
      const result = await this.lists.importCsv(user.userId, id, body.csv, {
        isCancelled: () => abort.isCancelled(),
        onProgress: (p) => {
          if (abort.isCancelled()) return;
          res.write(`${JSON.stringify({ type: 'progress', imported: p.imported, total: p.totalRows })}\n`);
        },
      });
      res.write(`${JSON.stringify({ type: 'done', ...result })}\n`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`${JSON.stringify({ type: 'error', message: msg })}\n`);
    }
    res.end();
  }

  @Post(':id/import/sheet')
  async importSheet(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: ImportSheetDto) {
    return this.lists.importSheetUrl(user.userId, id, body.url);
  }

  @Post(':id/import/sheet/stream')
  async importSheetStream(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: ImportSheetDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const abort = requestImportCancelCheck(req);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();
    try {
      const result = await this.lists.importSheetUrl(user.userId, id, body.url, {
        isCancelled: () => abort.isCancelled(),
        onProgress: (p) => {
          if (abort.isCancelled()) return;
          res.write(`${JSON.stringify({ type: 'progress', imported: p.imported, total: p.totalRows })}\n`);
        },
      });
      res.write(`${JSON.stringify({ type: 'done', ...result })}\n`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`${JSON.stringify({ type: 'error', message: msg })}\n`);
    }
    res.end();
  }

  @Post(':id/import/vendors')
  async importVendors(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: ImportIdsDto) {
    return this.lists.importFromVendors(user.userId, id, body.ids);
  }

  @Post(':id/import/clients')
  async importClients(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: ImportIdsDto) {
    return this.lists.importFromClients(user.userId, id, body.ids);
  }

  @Post(':id/export/csv')
  async exportCsv(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: ExportBodyDto,
    @Res() res: Response,
  ) {
    const csv = await this.lists.exportCsv(user.userId, id, body.itemIds);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=list-export.csv');
    return res.send(csv);
  }

  @Post(':id/export/pdf')
  async exportPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: ExportBodyDto,
    @Res() res: Response,
  ) {
    const buf = await this.lists.exportPdf(user.userId, id, body.itemIds);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=list-export.pdf');
    return res.send(Buffer.from(buf));
  }

  @Post(':id/sync')
  async sync(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lists.syncListFromDatabanks(user.userId, id);
  }
}
