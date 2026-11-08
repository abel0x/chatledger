import type { Platform } from './model';

const SP = '[ \\u00a0\\u202f]';
const DATE = '(\\d{1,4})([./-])(\\d{1,2})\\2(\\d{1,4})';
const TIME = `(\\d{1,2})[:.](\\d{2})(?:[:.](\\d{2}))?(?:${SP}?([AaPp])\\.?${SP}?[Mm]\\.?)?`;

/** Between date and time: a comma, a space, or a word such as the French "à". */
const JOIN = `,?(?:${SP}(?:à|a las|às|um|alle))?${SP}`;

const PATTERNS: Record<Platform, RegExp> = {
  android: new RegExp(`^${DATE}${JOIN}${TIME}${SP}[-\\u2013]${SP}([\\s\\S]*)$`),
  ios: new RegExp(`^\\[${DATE}${JOIN}${TIME}\\]${SP}([\\s\\S]*)$`),
};

/** Bidi marks WhatsApp sprinkles in front of lines and inside bodies. */
export const BIDI = /[\u200E\u200F\u202A-\u202E]/g;
const LEADING_BIDI = /^[\u200E\u200F\u202A-\u202E]+/;

export interface RawHeader {
  a: number;
  b: number;
  c: number;
  yearFirst: boolean;
  hour: number;
  minute: number;
  second: number;
  meridiem: 'a' | 'p' | null;
  body: string;
}

export function matchHeader(line: string, platform: Platform): RawHeader | null {
  const m = PATTERNS[platform].exec(line.replace(LEADING_BIDI, ''));
  if (!m) return null;
  const [, a, , b, c, h, mi, s, ap, body] = m;
  return {
    a: Number(a),
    b: Number(b),
    c: Number(c),
    yearFirst: (a ?? '').length === 4,
    hour: Number(h),
    minute: Number(mi),
    second: s ? Number(s) : 0,
    meridiem: ap ? (ap.toLowerCase() as 'a' | 'p') : null,
    body: body ?? '',
  };
}

export function detectPlatform(lines: string[]): Platform | null {
  let android = 0;
  let ios = 0;
  let seen = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (matchHeader(line, 'ios')) ios++;
    else if (matchHeader(line, 'android')) android++;
    if (++seen >= 200) break;
  }
  if (!android && !ios) return null;
  return ios > android ? 'ios' : 'android';
}

export type DateOrder = 'dmy' | 'mdy' | 'ymd';

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function hour24(h: RawHeader): number {
  if (!h.meridiem) return h.hour;
  return (h.hour % 12) + (h.meridiem === 'p' ? 12 : 0);
}

export function toSeconds(h: RawHeader, order: DateOrder): number {
  let y: number, mo: number, d: number;
  if (order === 'ymd') [y, mo, d] = [h.a, h.b, h.c];
  else if (order === 'dmy') [d, mo, y] = [h.a, h.b, h.c];
  else [mo, d, y] = [h.a, h.b, h.c];
  return Date.UTC(fullYear(y), mo - 1, d, hour24(h), h.minute, h.second) / 1000;
}

function backwardSteps(headers: RawHeader[], order: DateOrder): number {
  let steps = 0;
  let prev = -Infinity;
  for (const h of headers) {
    const t = toSeconds(h, order);
    if (t < prev - 86400) steps++;
    prev = t;
  }
  return steps;
}

/**
 * Day and month order is not written anywhere in an export, so it is read
 * off the data: an impossible month settles it, otherwise the order that
 * keeps the timeline moving forward wins.
 */
export function detectDateOrder(headers: RawHeader[]): DateOrder {
  if (headers.length && headers.every(h => h.yearFirst)) return 'ymd';
  let dayFirst = false;
  let monthFirst = false;
  for (const h of headers) {
    if (h.a > 12) dayFirst = true;
    if (h.b > 12) monthFirst = true;
  }
  if (dayFirst !== monthFirst) return dayFirst ? 'dmy' : 'mdy';
  const dmy = backwardSteps(headers, 'dmy');
  const mdy = backwardSteps(headers, 'mdy');
  if (dmy !== mdy) return dmy < mdy ? 'dmy' : 'mdy';
  return headers.some(h => h.meridiem) ? 'mdy' : 'dmy';
}
