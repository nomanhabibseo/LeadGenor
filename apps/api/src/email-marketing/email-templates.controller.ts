import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { EmailTemplatesService } from './email-templates.service';

class FolderBody {
  @IsString()
  name!: string;
}

class TemplateBody {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsBoolean()
  includeUnsubscribeBlock?: boolean;
}

@Controller('email-marketing/templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly templates: EmailTemplatesService) {}

  @Get('all')
  async allItems(@CurrentUser() user: JwtUser) {
    return this.templates.listAllTemplates(user.userId);
  }

  @Get('folders')
  async folders(@CurrentUser() user: JwtUser, @Query('search') search?: string) {
    return this.templates.listFolders(user.userId, search);
  }

  @Post('folders')
  async createFolder(@CurrentUser() user: JwtUser, @Body() body: FolderBody) {
    return this.templates.createFolder(user.userId, body.name);
  }

  @Get('folders/trash')
  async foldersTrash(@CurrentUser() user: JwtUser) {
    return this.templates.listDeletedFolders(user.userId);
  }

  @Post('folders/:id/restore')
  async restoreFolder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.restoreFolder(user.userId, id);
  }

  @Get('folders/:id')
  async getFolder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.getFolder(user.userId, id);
  }

  @Patch('folders/:id')
  async updateFolder(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: FolderBody) {
    return this.templates.updateFolder(user.userId, id, body.name);
  }

  @Delete('folders/:id')
  async deleteFolder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.deleteFolder(user.userId, id);
  }

  @Get('folders/:folderId/items')
  async listItems(
    @CurrentUser() user: JwtUser,
    @Param('folderId') folderId: string,
    @Query('search') search?: string,
  ) {
    return this.templates.listTemplates(user.userId, folderId, search);
  }

  @Post('folders/:folderId/items')
  async createItem(
    @CurrentUser() user: JwtUser,
    @Param('folderId') folderId: string,
    @Body() body: TemplateBody,
  ) {
    return this.templates.createTemplate(user.userId, folderId, body);
  }

  @Get('items/:id')
  async getItem(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.getTemplate(user.userId, id);
  }

  @Patch('items/:id')
  async updateItem(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Partial<TemplateBody>) {
    return this.templates.updateTemplate(user.userId, id, body);
  }

  @Delete('items/:id')
  async deleteItem(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.deleteTemplate(user.userId, id);
  }
}
