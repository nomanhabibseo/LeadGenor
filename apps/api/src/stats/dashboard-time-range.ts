export type TimeRangeKey = 'h24' | 'd7' | 'd30' | 'm6' | 'y1' | 'life';

export const TIME_RANGE_DEFAULT: TimeRangeKey = 'd30';

export function parseTimeRange(s: string | undefined | null): TimeRangeKey {
  const allowed: TimeRangeKey[] = ['h24', 'd7', 'd30', 'm6', 'y1', 'life'];
  if (s && (allowed as string[]).includes(s)) return s as TimeRangeKey;
  return TIME_RANGE_DEFAULT;
}

export function getTimeWindow(
  key: TimeRangeKey,
  lifeFrom?: Date | null,
): { from: Date; to: Date; bucket: 'hour' | 'day' } {
  const to = new Date();
  const from = new Date();
  if (key === 'h24') {
    from.setTime(to.getTime() - 24 * 3600 * 1000);
    return { from, to, bucket: 'hour' };
  }
  if (key === 'd7') {
    from.setDate(from.getDate() - 7);
    return { from, to, bucket: 'day' };
  }
  if (key === 'd30') {
    from.setDate(from.getDate() - 30);
    return { from, to, bucket: 'day' };
  }
  if (key === 'm6') {
    from.setMonth(from.getMonth() - 6);
    return { from, to, bucket: 'day' };
  }
  if (key === 'y1') {
    from.setFullYear(from.getFullYear() - 1);
    return { from, to, bucket: 'day' };
  }
  if (key === 'life' && lifeFrom) {
    return { from: new Date(lifeFrom.getTime()), to, bucket: 'day' };
  }
  from.setFullYear(from.getFullYear() - 2);
  return { from, to, bucket: 'day' };
}

export function everyDayInRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from.getTime());
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to.getTime());
  end.setUTCHours(0, 0, 0, 0);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function everyHourInRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from.getTime());
  d.setUTCMinutes(0, 0, 0);
  const end = new Date(to.getTime());
  while (d <= end) {
    out.push(d.toISOString().slice(0, 13) + ':00:00.000Z');
    d.setUTCHours(d.getUTCHours() + 1);
  }
  return out;
}

export function downsample<T extends { t: string; v: number }>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const r: T[] = [];
  for (let i = 0; i < points.length; i += step) {
    r.push(points[i]!);
  }
  if (r[r.length - 1] !== points[points.length - 1]) {
    r.push(points[points.length - 1]!);
  }
  return r;
}
