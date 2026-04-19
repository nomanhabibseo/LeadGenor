import { BadRequestException, Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ImportVendorsService } from './import-vendors.service';
import { ImportClientsService } from './import-clients.service';
import { OrdersService } from '../orders/orders.service';

async function fetchGoogleSheetAsCsv(url: string): Promise<string> {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new BadRequestException('Paste a Google Sheets link (docs.google.com/spreadsheets/d/...).');
  }
  const id = idMatch[1];
  const gidMatch = trimmed.match(/[#&?]gid=(\d+)/);
  let exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  if (gidMatch) exportUrl += `&gid=${gidMatch[1]}`;
  const res = await fetch(exportUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new BadRequestException(
      `Could not download the sheet (HTTP ${res.status}). Use File → Share → "Anyone with the link" (viewer).`,
    );
  }
  return res.text();
}

@Controller('import-export')
@UseGuards(JwtAuthGuard)
export class ImportExportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importVendors: ImportVendorsService,
    private readonly importClients: ImportClientsService,
    private readonly orders: OrdersService,
  ) {}

  @Post('vendors/csv')
  async importVendorsCsv(@CurrentUser() user: JwtUser, @Body() body: { csv: string }) {
    if (!body?.csv?.trim()) {
      throw new BadRequestException('CSV content is required.');
    }
    return this.importVendors.importFromCsvText(user.userId, body.csv);
  }

  @Post('vendors/from-sheet')
  async importVendorsFromSheet(@CurrentUser() user: JwtUser, @Body() body: { url: string }) {
    if (!body?.url?.trim()) {
      throw new BadRequestException('Sheet URL is required.');
    }
    const csv = await fetchGoogleSheetAsCsv(body.url);
    return this.importVendors.importFromCsvText(user.userId, csv);
  }

  @Post('clients/csv')
  async importClientsCsv(@CurrentUser() user: JwtUser, @Body() body: { csv: string }) {
    if (!body?.csv?.trim()) {
      throw new BadRequestException('CSV content is required.');
    }
    return this.importClients.importFromCsvText(user.userId, body.csv);
  }

  @Post('clients/from-sheet')
  async importClientsFromSheet(@CurrentUser() user: JwtUser, @Body() body: { url: string }) {
    if (!body?.url?.trim()) {
      throw new BadRequestException('Sheet URL is required.');
    }
    const csv = await fetchGoogleSheetAsCsv(body.url);
    return this.importClients.importFromCsvText(user.userId, csv);
  }

  @Post('clients/export')
  async exportClients(
    @CurrentUser() user: JwtUser,
    @Body() body: { format: 'csv' | 'xlsx'; ids?: string[]; limit?: number; offset?: number },
    @Res() res: Response,
  ) {
    const cap = Math.min(Math.max(body.limit ?? 5000, 1), 10000);
    const clients = await this.prisma.client.findMany({
      where: {
        userId: user.userId,
        deletedAt: null,
        ...(body.ids?.length ? { id: { in: body.ids } } : {}),
      },
      include: {
        language: true,
        niches: { include: { niche: true } },
        countries: { include: { country: true } },
      },
      orderBy: { updatedAt: 'desc' },
      ...(body.ids?.length ? {} : { take: cap, skip: body.offset ?? 0 }),
    });

    const rows = clients.map((c) => ({
      siteUrl: c.siteUrl,
      companyName: c.companyName,
      clientName: c.clientName,
      email: c.email,
      niche: c.niches.map((n) => n.niche.label).join(';'),
      dr: c.dr,
      traffic: c.traffic,
      country: c.countries.map((x) => x.country.name).join(';'),
      language: c.language.name,
    }));

    if (body.format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Clients');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=clients.xlsx');
      return res.send(buf);
    }

    const csv = Papa.unparse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
    return res.send(csv);
  }

  @Post('vendors/export')
  async exportVendors(
    @CurrentUser() user: JwtUser,
    @Body() body: { format: 'csv' | 'xlsx'; ids?: string[]; limit?: number; offset?: number },
    @Res() res: Response,
  ) {
    const cap = Math.min(Math.max(body.limit ?? 5000, 1), 10000);
    const vendors = await this.prisma.vendor.findMany({
      where: {
        userId: user.userId,
        deletedAt: null,
        ...(body.ids?.length ? { id: { in: body.ids } } : {}),
      },
      include: {
        currency: true,
        niches: { include: { niche: true } },
        countries: { include: { country: true } },
        language: true,
      },
      orderBy: { updatedAt: 'desc' },
      ...(body.ids?.length ? {} : { take: cap, skip: body.offset ?? 0 }),
    });

    const rows = vendors.map((v) => ({
      siteUrl: v.siteUrl,
      niche: v.niches.map((n) => n.niche.label).join(';'),
      dr: v.dr,
      traffic: v.traffic,
      country: v.countries.map((c) => c.country.name).join(';'),
      language: v.language.name,
      guestPostPrice: v.guestPostPrice.toString(),
      currency: v.currency.code,
    }));

    if (body.format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=vendors.xlsx');
      return res.send(buf);
    }

    const csv = Papa.unparse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vendors.csv');
    return res.send(csv);
  }

  @Post('orders/export')
  async exportOrders(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      format: 'csv' | 'xlsx';
      scope?: 'all' | 'completed' | 'pending' | 'trash';
      ids?: string[];
      dateFrom?: string;
      dateTo?: string;
      searchUrl?: string;
      limit?: number;
      offset?: number;
    },
    @Res() res: Response,
  ) {
    const cap = Math.min(Math.max(body.limit ?? 5000, 1), 10000);
    const rows = await this.orders.exportRows(
      user.userId,
      body.scope ?? 'all',
      {
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        searchUrl: body.searchUrl,
      },
      {
        ids: body.ids,
        limit: body.ids?.length ? body.ids.length : cap,
        offset: body.offset ?? 0,
      },
    );

    const flat = rows.map((o) => ({
      orderDate: o.orderDate.toISOString().slice(0, 10),
      status: o.status,
      clientSite: o.client.siteUrl,
      vendorSite: o.vendor.siteUrl,
      clientEmail: o.clientEmail,
      totalPayment: o.totalPayment.toString(),
      currency: o.currency.code,
      linkType: o.linkType,
    }));

    if (body.format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(flat);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
      return res.send(buf);
    }

    const csv = Papa.unparse(flat);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    return res.send(csv);
  }
}
