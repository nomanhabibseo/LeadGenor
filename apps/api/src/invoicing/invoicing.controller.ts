import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { InvoicingService } from './invoicing.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicingController {
  constructor(private readonly invoicing: InvoicingService) {}

  @Get(':orderId/pdf')
  async pdf(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const buf = await this.invoicing.buildInvoicePdf(orderId, user.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
    res.send(Buffer.from(buf));
  }

  @Post(':orderId/send')
  send(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string) {
    return this.invoicing.sendInvoiceEmail(orderId, user.userId);
  }
}
