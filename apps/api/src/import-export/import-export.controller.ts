import { BadRequestException, Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ImportVendorsService } from './import-vendors.service';
import { ImportClientsService } from './import-clients.service';
import { OrdersService } from '../orders/orders.service';
import { normHeader } from '../email-marketing/email-list-import';
import { fetchGoogleSheetAsCsv } from './google-sheet-download';
import { requestImportCancelCheck } from './import-stream-hooks';

/** Normalized header tokens that list/vendors/clients CSV parsers recognize (subset). */
const KNOWN_IMPORT_HEADERS = new Set([
  'site_url',
  'url',
  'website',
  'site',
  'company_name',
  'company',
  'email',
  'emails',
  'contact_email',
  'niche',
  'category',
  'country',
  'traffic',
  'monthly_traffic',
  'dr',
  'domain_rating',
  'da',
  'moz_da',
  'authority_score',
  'as',
  'backlinks',
  'referring_domains',
  'referring_domain',
  'ref_domains',
  'ref_domain',
  'def_domains',
  'ref_domains_ips',
  'def_domains_ips',
  'contact_kind',
  'type',
  'client_name',
  'vendor_name',
  'contact_name',
  'name',
  'client',
  'vendor',
  'language',
  'lang',
]);

@Controller('import-export')
@UseGuards(JwtAuthGuard)
export class ImportExportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importVendors: ImportVendorsService,
    private readonly importClients: ImportClientsService,
    private readonly orders: OrdersService,
  ) {}

  /** Fetch header row + row count from a published Google Sheet (same export URL as imports). */
  @Post('sheet-preview')
  async sheetPreview(@Body() body: { url: string }) {
    if (!body?.url?.trim()) {
      throw new BadRequestException('Sheet URL is required.');
    }
    let csv: string;
    try {
      csv = await fetchGoogleSheetAsCsv(body.url);
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Could not preview sheet: ${msg}`);
    }
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) {
      throw new BadRequestException('Sheet appears empty.');
    }
    const headerParse = Papa.parse<string[]>(lines[0], { header: false });
    const row0 = (headerParse.data[0] as string[]) ?? [];
    const columns = row0.map((c) => String(c).trim().replace(/^\uFEFF/, '')).filter(Boolean);
    const normalizedColumns = columns.map((c) => normHeader(c));
    const matchedHints = normalizedColumns.filter((n) => n && KNOWN_IMPORT_HEADERS.has(n));
    const approxDataRows = Math.max(0, lines.length - 1);
    return { columns, normalizedColumns, matchedHints, approxDataRows };
  }

  @Post('vendors/csv')
  async importVendorsCsv(@CurrentUser() user: JwtUser, @Body() body: { csv: string }) {
    if (!body?.csv?.trim()) {
      throw new BadRequestException('CSV content is required.');
    }
    return this.importVendors.importFromCsvText(user.userId, body.csv);
  }

  @Post('vendors/csv/stream')
  async importVendorsCsvStream(
    @CurrentUser() user: JwtUser,
    @Body() body: { csv: string },
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!body?.csv?.trim()) throw new BadRequestException('CSV content is required.');
    const abort = requestImportCancelCheck(req);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();
    try {
      const result = await this.importVendors.importFromCsvText(user.userId, body.csv, {
        isCancelled: () => abort.isCancelled(),
        onProgress: (p) => {
          if (abort.isCancelled()) return;
          res.write(`${JSON.stringify({ type: 'progress', imported: p.imported, total: p.totalRows })}\n`);
        },
      });
      res.write(`${JSON.stringify({ type: 'done', ...result })}\n`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`${JSON.stringify({ type: 'error', message: msg })}\n`);
    }
    res.end();
  }

  @Post('vendors/from-sheet')
  async importVendorsFromSheet(@CurrentUser() user: JwtUser, @Body() body: { url: string }) {
    if (!body?.url?.trim()) {
      throw new BadRequestException('Sheet URL is required.');
    }
    try {
      const csv = await fetchGoogleSheetAsCsv(body.url);
      return this.importVendors.importFromCsvText(user.userId, csv);
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        `Could not load the sheet. Check sharing (Anyone with the link) and try CSV upload if this persists: ${msg}`,
      );
    }
  }

  @Post('vendors/from-sheet/stream')
  async importVendorsFromSheetStream(
    @CurrentUser() user: JwtUser,
    @Body() body: { url: string },
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!body?.url?.trim()) throw new BadRequestException('Sheet URL is required.');
    let csv: string;
    try {
      csv = await fetchGoogleSheetAsCsv(body.url);
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        `Could not load the sheet. Check sharing (Anyone with the link) and try CSV upload if this persists: ${msg}`,
      );
    }
    const abort = requestImportCancelCheck(req);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();
    try {
      const result = await this.importVendors.importFromCsvText(user.userId, csv, {
        isCancelled: () => abort.isCancelled(),
        onProgress: (p) => {
          if (abort.isCancelled()) return;
          res.write(`${JSON.stringify({ type: 'progress', imported: p.imported, total: p.totalRows })}\n`);
        },
      });
      res.write(`${JSON.stringify({ type: 'done', ...result })}\n`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`${JSON.stringify({ type: 'error', message: msg })}\n`);
    }
    res.end();
  }

  @Post('clients/csv')
  async importClientsCsv(@CurrentUser() user: JwtUser, @Body() body: { csv: string }) {
    if (!body?.csv?.trim()) {
      throw new BadRequestException('CSV content is required.');
    }
    return this.importClients.importFromCsvText(user.userId, body.csv);
  }

  @Post('clients/csv/stream')
  async importClientsCsvStream(
    @CurrentUser() user: JwtUser,
    @Body() body: { csv: string },
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!body?.csv?.trim()) throw new BadRequestException('CSV content is required.');
    const abort = requestImportCancelCheck(req);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();
    try {
      const result = await this.importClients.importFromCsvText(user.userId, body.csv, {
        isCancelled: () => abort.isCancelled(),
        onProgress: (p) => {
          if (abort.isCancelled()) return;
          res.write(`${JSON.stringify({ type: 'progress', imported: p.imported, total: p.totalRows })}\n`);
        },
      });
      res.write(`${JSON.stringify({ type: 'done', ...result })}\n`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`${JSON.stringify({ type: 'error', message: msg })}\n`);
    }
    res.end();
  }

  @Post('clients/from-sheet')
  async importClientsFromSheet(@CurrentUser() user: JwtUser, @Body() body: { url: string }) {
    if (!body?.url?.trim()) {
      throw new BadRequestException('Sheet URL is required.');
    }
    try {
      const csv = await fetchGoogleSheetAsCsv(body.url);
      return this.importClients.importFromCsvText(user.userId, csv);
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        `Could not load the sheet. Check sharing (Anyone with the link) and try CSV upload if this persists: ${msg}`,
      );
    }
  }

  @Post('clients/from-sheet/stream')
  async importClientsFromSheetStream(
    @CurrentUser() user: JwtUser,
    @Body() body: { url: string },
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!body?.url?.trim()) throw new BadRequestException('Sheet URL is required.');
    let csv: string;
    try {
      csv = await fetchGoogleSheetAsCsv(body.url);
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        `Could not load the sheet. Check sharing (Anyone with the link) and try CSV upload if this persists: ${msg}`,
      );
    }
    const abort = requestImportCancelCheck(req);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();
    try {
      const result = await this.importClients.importFromCsvText(user.userId, csv, {
        isCancelled: () => abort.isCancelled(),
        onProgress: (p) => {
          if (abort.isCancelled()) return;
          res.write(`${JSON.stringify({ type: 'progress', imported: p.imported, total: p.totalRows })}\n`);
        },
      });
      res.write(`${JSON.stringify({ type: 'done', ...result })}\n`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`${JSON.stringify({ type: 'error', message: msg })}\n`);
    }
    res.end();
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
