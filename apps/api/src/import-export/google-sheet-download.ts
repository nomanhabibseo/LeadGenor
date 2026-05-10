import { BadRequestException } from '@nestjs/common';

const FETCH_MS = 120_000;

function looksLikeHtml(text: string): boolean {
  const t = text.trimStart().slice(0, 200).toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<html');
}

/**
 * Download a published Google Sheet as CSV (same URL as “File → Download → CSV”).
 * Handles large sheets, slow Google responses, and HTML error/login pages.
 */
export async function fetchGoogleSheetAsCsv(url: string): Promise<string> {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new BadRequestException('Paste a Google Sheets link (docs.google.com/spreadsheets/d/...).');
  }
  const id = idMatch[1];
  const gidMatch = trimmed.match(/[#&?]gid=(\d+)/);
  let exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  if (gidMatch) exportUrl += `&gid=${gidMatch[1]}`;

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), FETCH_MS);
  let res: Response;
  try {
    res = await fetch(exportUrl, {
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        Accept: 'text/csv,text/plain,*/*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') {
      throw new BadRequestException(
        'Downloading the sheet timed out. Try again, use a smaller sheet, or export as CSV and upload the file instead.',
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new BadRequestException(`Could not reach Google: ${msg}`);
  } finally {
    clearTimeout(to);
  }

  if (!res.ok) {
    throw new BadRequestException(
      `Could not download the sheet (HTTP ${res.status}). Use File → Share → "Anyone with the link" (viewer).`,
    );
  }

  const text = await res.text();
  if (looksLikeHtml(text)) {
    throw new BadRequestException(
      'Google returned a web page instead of CSV. Set sharing to "Anyone with the link" (viewer) and use the full spreadsheet link.',
    );
  }
  return text;
}
