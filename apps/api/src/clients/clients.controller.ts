import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { ClientBodyDto } from './dto/client-body.dto';
import { ClientsService } from './clients.service';

class ClientListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;

  @IsOptional()
  @IsString()
  searchUrl?: string;

  @IsOptional()
  @Type(() => Number)
  drMin?: number;

  @IsOptional()
  @Type(() => Number)
  drMax?: number;

  @IsOptional()
  @Type(() => Number)
  trafficMin?: number;

  @IsOptional()
  @Type(() => Number)
  trafficMax?: number;

  @IsOptional()
  @IsString()
  nicheIds?: string;

  @IsOptional()
  @IsIn(['include', 'exclude'])
  nicheMode?: 'include' | 'exclude';

  @IsOptional()
  @IsString()
  countryIds?: string;

  @IsOptional()
  @IsIn(['include', 'exclude'])
  countryMode?: 'include' | 'exclude';

  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @Type(() => Number)
  mozDaMin?: number;

  @IsOptional()
  @Type(() => Number)
  mozDaMax?: number;

  @IsOptional()
  @Type(() => Number)
  authorityScoreMin?: number;

  @IsOptional()
  @Type(() => Number)
  authorityScoreMax?: number;

  @IsOptional()
  @Type(() => Number)
  referringDomainsMin?: number;

  @IsOptional()
  @Type(() => Number)
  referringDomainsMax?: number;

  @IsOptional()
  @Type(() => Number)
  backlinksMin?: number;

  @IsOptional()
  @Type(() => Number)
  backlinksMax?: number;
}

class BulkSoftDeleteDto {
  @IsArray()
  @ArrayMaxSize(10000)
  @IsString({ each: true })
  ids!: string[];
}

class BulkPermanentDeleteDto {
  @IsArray()
  @ArrayMaxSize(10000)
  @IsString({ each: true })
  ids!: string[];
}

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtUser,
    @Query('scope') scope: 'active' | 'trash' = 'active',
    @Query() q: ClientListQuery,
  ) {
    const nicheIds = q.nicheIds?.split(',').filter(Boolean);
    const countryIds = q.countryIds?.split(',').filter(Boolean);
    return this.clients.list(user.userId, scope, {
      page: q.page,
      limit: q.limit,
      searchUrl: q.searchUrl,
      drMin: q.drMin,
      drMax: q.drMax,
      trafficMin: q.trafficMin,
      trafficMax: q.trafficMax,
      nicheIds,
      nicheMode: q.nicheMode,
      countryIds,
      countryMode: q.countryMode,
      languageId: q.languageId,
      mozDaMin: q.mozDaMin,
      mozDaMax: q.mozDaMax,
      authorityScoreMin: q.authorityScoreMin,
      authorityScoreMax: q.authorityScoreMax,
      referringDomainsMin: q.referringDomainsMin,
      referringDomainsMax: q.referringDomainsMax,
      backlinksMin: q.backlinksMin,
      backlinksMax: q.backlinksMax,
    });
  }

  @Get('ids')
  listIds(
    @CurrentUser() user: JwtUser,
    @Query('scope') scope: 'active' | 'trash' = 'active',
    @Query() q: ClientListQuery,
  ) {
    const nicheIds = q.nicheIds?.split(',').filter(Boolean);
    const countryIds = q.countryIds?.split(',').filter(Boolean);
    return this.clients.listIds(user.userId, scope, {
      searchUrl: q.searchUrl,
      drMin: q.drMin,
      drMax: q.drMax,
      trafficMin: q.trafficMin,
      trafficMax: q.trafficMax,
      nicheIds,
      nicheMode: q.nicheMode,
      countryIds,
      countryMode: q.countryMode,
      languageId: q.languageId,
      mozDaMin: q.mozDaMin,
      mozDaMax: q.mozDaMax,
      authorityScoreMin: q.authorityScoreMin,
      authorityScoreMax: q.authorityScoreMax,
      referringDomainsMin: q.referringDomainsMin,
      referringDomainsMax: q.referringDomainsMax,
      backlinksMin: q.backlinksMin,
      backlinksMax: q.backlinksMax,
    });
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: ClientBodyDto) {
    return this.clients.create(user.userId, body);
  }

  @Post('force')
  createForce(@CurrentUser() user: JwtUser, @Body() body: ClientBodyDto) {
    return this.clients.createAnyway(user.userId, body);
  }

  @Post('bulk-soft-delete')
  bulkSoftDelete(@CurrentUser() user: JwtUser, @Body() body: BulkSoftDeleteDto) {
    return this.clients.softDeleteMany(user.userId, body.ids);
  }

  @Post('bulk-permanent-delete')
  bulkPermanentDelete(@CurrentUser() user: JwtUser, @Body() body: BulkPermanentDeleteDto) {
    return this.clients.permanentDeleteMany(user.userId, body.ids);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clients.findOne(user.userId, id);
  }

  @Put(':id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: ClientBodyDto) {
    return this.clients.update(user.userId, id, body);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clients.softDelete(user.userId, id);
  }

  @Post(':id/restore-quick')
  restoreQuick(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clients.restoreQuick(user.userId, id);
  }

  @Post(':id/restore')
  restoreFromTrash(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clients.restoreFromTrash(user.userId, id);
  }

  @Delete(':id/permanent')
  permanentDelete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clients.permanentDelete(user.userId, id);
  }
}
