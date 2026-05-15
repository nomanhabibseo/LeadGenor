import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

class CreateNotificationDto {
  @IsOptional()
  @IsIn(['info', 'warning', 'error'])
  kind?: 'info' | 'warning' | 'error';

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  href?: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: JwtUser, @Query('take') take?: string) {
    const n = Number(take ?? 50);
    return this.notifications.list(user.userId, Number.isFinite(n) ? n : 50);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: JwtUser) {
    return this.notifications.unreadCount(user.userId);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: CreateNotificationDto) {
    return this.notifications.create(user.userId, body);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notifications.markRead(user.userId, id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: JwtUser) {
    return this.notifications.markAllRead(user.userId);
  }
}

