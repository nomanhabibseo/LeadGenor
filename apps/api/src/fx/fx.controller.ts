import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FxService } from './fx.service';

@Controller('fx')
@UseGuards(JwtAuthGuard)
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Post('refresh')
  refresh() {
    return this.fx.refreshFromFrankfurter();
  }
}
