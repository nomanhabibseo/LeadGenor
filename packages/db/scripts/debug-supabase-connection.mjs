/**
 * Quick connectivity check: DNS → TCP → Prisma $connect.
 * Does not log passwords. Usage: npm run debug:db (from packages/db)
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function loadDatabaseUrlFromEnvFile() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const envPath = join(root, '.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^DATABASE_URL\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return process.env.DATABASE_URL;
}

function parsePgUrl(url) {
  const normalized = url.replace(/^postgresql:/i, 'http:');
  const u = new URL(normalized);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
  };
}

function tryTcp(host, port, family, ms) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family }, () => {
      resolve({ ok: true, code: null, message: null });
      socket.destroy();
    });
    socket.setTimeout(ms);
    socket.on('error', (err) => {
      resolve({ ok: false, code: err.code, message: err.message });
    });
    socket.on('timeout', () => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve({ ok: false, code: 'ETIMEDOUT', message: 'timeout' });
    });
  });
}

async function main() {
  const rawUrl = loadDatabaseUrlFromEnvFile();
  if (!rawUrl) {
    console.error('DATABASE_URL not found in packages/db/.env');
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parsePgUrl(rawUrl);
  } catch (e) {
    console.error('Invalid DATABASE_URL:', e.message);
    process.exit(1);
  }

  console.log('Host:', parsed.host, 'port:', parsed.port);

  try {
    const records = await dns.lookup(parsed.host, { all: true });
    console.log(
      'DNS OK, families:',
      records.map((r) => r.family).join(','),
    );
  } catch (e) {
    console.error('DNS failed:', e.message);
    process.exit(1);
  }

  const t4 = await tryTcp(parsed.host, parsed.port, 4, 12000);
  console.log('TCP IPv4:', t4.ok ? 'OK' : `${t4.code} ${t4.message}`);
  const t6 = await tryTcp(parsed.host, parsed.port, 6, 12000);
  console.log('TCP IPv6:', t6.ok ? 'OK' : `${t6.code} ${t6.message}`);

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: rawUrl } },
    });
    await prisma.$connect();
    await prisma.$disconnect();
    console.log('Prisma $connect: OK');
  } catch (e) {
    console.error('Prisma $connect failed:', e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
