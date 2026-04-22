import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { EmailListAutoUpdate } from '@prisma/client';
import { Response } from 'express';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
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

  @Post(':id/import/csv')
  async importCsv(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: ImportCsvDto) {
    return this.lists.importCsv(user.userId, id, body.csv);
  }

  @Post(':id/import/sheet')
  async importSheet(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: ImportSheetDto) {
    return this.lists.importSheetUrl(user.userId, id, body.url);
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
