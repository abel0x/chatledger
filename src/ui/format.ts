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
