import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}

