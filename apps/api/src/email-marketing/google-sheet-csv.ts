import { BadRequestException } from '@nestjs/common';

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
  const res = await fetch(exportUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new BadRequestException(
      `Could not download the sheet (HTTP ${res.status}). Use File → Share → "Anyone with the link" (viewer).`,
    );
  }
  return res.text();
}
