import { Injectable, NotFoundException } from '@nestjs/common';
import { jsPDF } from 'jspdf';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicingService {
  constructor(private readonly prisma: PrismaService) {}

  private transporter() {
    const url = process.env.SMTP_URL;
    if (!url) return null;
    return nodemailer.createTransport(url);
  }

  async buildInvoicePdf(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
      include: { client: true, vendor: true, currency: true },
    });
    if (!order) throw new NotFoundException();

    const doc = new jsPDF();
    const sym = order.currency.symbol;
    let y = 20;
    doc.setFontSize(16);
    doc.text('LeadGenor Invoice', 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`Client site: ${order.client.siteUrl}`, 20, y);
    y += 6;
    doc.text(`Vendor site: ${order.vendor.siteUrl}`, 20, y);
    y += 6;
    doc.text(`Link type: ${order.linkType}`, 20, y);
    y += 6;
    doc.text(`Price: ${sym}${order.resellerPrice.toString()}`, 20, y);
    y += 6;
    if (order.articleWriting && order.articleWritingFeeUsd) {
      doc.text(`Article writing (USD): $${order.articleWritingFeeUsd.toString()}`, 20, y);
      y += 6;
    }
    doc.text(`Total: ${sym}${order.totalPayment.toString()}`, 20, y);
    y += 6;
    doc.text(`Payment note: ${order.paymentMethodNote ?? '—'}`, 20, y);
    y += 6;
    doc.text(`Delivery: ${order.deliveryDays} day(s)`, 20, y);
    y += 6;
    doc.text(`Order date: ${order.orderDate.toISOString().slice(0, 10)}`, 20, y);

    return doc.output('arraybuffer');
  }

  async sendInvoiceEmail(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
      include: { client: true, vendor: true, currency: true },
    });
    if (!order) throw new NotFoundException();

    const transport = this.transporter();
    const pdf = await this.buildInvoicePdf(orderId, userId);

    const body = [
      `Client site: ${order.client.siteUrl}`,
      `Vendor site: ${order.vendor.siteUrl}`,
      `Link type: ${order.linkType}`,
      `Price: ${order.currency.symbol}${order.resellerPrice.toString()}`,
      order.articleWriting ? `Article writing (USD): $${order.articleWritingFeeUsd?.toString() ?? '0'}` : '',
      `Total: ${order.currency.symbol}${order.totalPayment.toString()}`,
      `Payment: ${order.paymentMethodNote ?? '—'}`,
      `Delivery: ${order.deliveryDays} day(s)`,
      `Order date: ${order.orderDate.toISOString().slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (!transport) {
      return { ok: false, message: 'SMTP not configured', preview: body };
    }

    await transport.sendMail({
      from: process.env.SMTP_FROM || 'noreply@localhost',
      to: order.clientEmail,
      subject: `Invoice — ${order.vendor.siteUrl}`,
      text: body,
      attachments: [{ filename: 'invoice.pdf', content: Buffer.from(pdf) }],
    });

    return { ok: true };
  }
}
