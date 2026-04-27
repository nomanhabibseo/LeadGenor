import { Module } from '@nestjs/common';
import { EmailFinderController } from './email-finder.controller';
import { EmailFinderService } from './email-finder.service';

@Module({
  controllers: [EmailFinderController],
  providers: [EmailFinderService],
})
export class EmailFinderModule {}

