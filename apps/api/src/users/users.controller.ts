import { BadRequestException, Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class TrashRetentionDto {
  @IsInt()
  @Min(7)
  @Max(28)
  trashRetentionDays!: number;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Required when setting newPassword */
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { id: true, email: true, name: true, trashRetentionDays: true },
    });
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: JwtUser, @Body() body: UpdateProfileDto) {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    const data: { name?: string; passwordHash?: string } = {};

    if (body.name !== undefined) {
      data.name = body.name.trim();
    }

    if (body.newPassword !== undefined && body.newPassword !== '') {
      if (!body.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password.');
      }
      if (!existing.passwordHash) {
        throw new BadRequestException('Password change is not available for this account.');
      }
      const ok = await bcrypt.compare(body.currentPassword, existing.passwordHash);
      if (!ok) throw new BadRequestException('Current password is incorrect.');
      data.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return this.prisma.user.findUniqueOrThrow({
        where: { id: user.userId },
        select: { id: true, email: true, name: true, trashRetentionDays: true },
      });
    }

    return this.prisma.user.update({
      where: { id: user.userId },
      data,
      select: { id: true, email: true, name: true, trashRetentionDays: true },
    });
  }

  @Patch('me/trash-retention')
  async trashRetention(@CurrentUser() user: JwtUser, @Body() body: TrashRetentionDto) {
    return this.prisma.user.update({
      where: { id: user.userId },
      data: { trashRetentionDays: body.trashRetentionDays },
      select: { id: true, trashRetentionDays: true },
    });
  }
}
