/**
 * Message times are wall-clock values stored as if they were UTC, so every
 * formatter here reads them in UTC and shows exactly what the phone showed.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    cache.set(key, f);
  }
  return f;
}

export function dayOf(time: number): number {
  return Math.floor(time / 86400);
}

export function formatDay(day: number, locale: string): string {
  return formatter(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(day * 86400000);
}

export function formatClock(time: number, locale: string): string {
  return formatter(locale, { hour: '2-digit', minute: '2-digit' }).format(time * 1000);
}

export function formatFull(time: number, locale: string): string {
  return formatter(locale, { dateStyle: 'full', timeStyle: 'medium' }).format(time * 1000);
}

export function formatBytes(bytes: number, locale: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0,
  }).format(value);
}

export function formatDayRange(first: number, last: number, locale: string): string {
  const f = formatter(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return f.formatRange(first * 1000, last * 1000);
}

export function formatMonth(month: number, locale: string): string {
  return formatter(locale, { month: 'long', year: 'numeric' }).format(Date.UTC(Math.floor(month / 12), month % 12, 1));
}

export function formatMonthShort(month: number, locale: string, withYear: boolean): string {
  const options: Intl.DateTimeFormatOptions = withYear ? { month: 'short', year: 'numeric' } : { month: 'short' };
  return formatter(locale, options).format(Date.UTC(Math.floor(month / 12), month % 12, 1));
}
