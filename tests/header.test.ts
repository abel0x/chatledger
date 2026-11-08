import { describe, expect, it } from 'vitest';
import { detectDateOrder, detectPlatform, matchHeader, toSeconds, type RawHeader } from '../src/core/header';

const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s) / 1000;

function headers(lines: string[], platform: 'android' | 'ios'): RawHeader[] {
  return lines.map(l => {
    const h = matchHeader(l, platform);
    if (!h) throw new Error(`no header: ${l}`);
    return h;
  });
}

describe('matchHeader', () => {
  it('reads Android 24-hour headers', () => {
    const h = matchHeader('01/10/2025, 20:30 - Ada: hi', 'android');
    expect(h).toMatchObject({ a: 1, b: 10, c: 2025, hour: 20, minute: 30, body: 'Ada: hi' });
  });

  it('reads Android 12-hour headers with a narrow no-break space', () => {
    const h = matchHeader('10/1/25, 8:30 PM - Ada: hi', 'android');
    expect(h).toMatchObject({ a: 10, b: 1, c: 25, hour: 8, meridiem: 'p', body: 'Ada: hi' });
  });

  it('reads dotted dates without a comma', () => {
    expect(matchHeader('01.10.2025 20:30 - Ada: selam', 'android')).toMatchObject({ a: 1, b: 10, c: 2025 });
  });

  it('reads iOS headers with seconds and a leading mark', () => {
    const h = matchHeader('\u200E[01.10.2025 20:30:15] Ada: selam', 'ios');
    expect(h).toMatchObject({ a: 1, b: 10, c: 2025, hour: 20, minute: 30, second: 15, body: 'Ada: selam' });
  });

  it('does not take plain text for a header', () => {
    expect(matchHeader('see you at 20:30 - ok', 'android')).toBeNull();
    expect(matchHeader('[note] hello', 'ios')).toBeNull();
  });
});

describe('detectPlatform', () => {
  it('tells Android from iOS', () => {
    expect(detectPlatform(['01/10/2025, 20:30 - Ada: hi'])).toBe('android');
    expect(detectPlatform(['[01/10/2025, 20:30:01] Ada: hi'])).toBe('ios');
    expect(detectPlatform(['just some text'])).toBeNull();
  });
});

describe('detectDateOrder', () => {
  it('settles on day-first when a day is above 12', () => {
    const hs = headers(['01/10/2025, 20:30 - a', '13/10/2025, 20:30 - b'], 'android');
    expect(detectDateOrder(hs)).toBe('dmy');
  });

  it('settles on month-first when a month slot is above 12', () => {
    const hs = headers(['10/1/25, 8:30 PM - a', '10/13/25, 8:30 PM - b'], 'android');
    expect(detectDateOrder(hs)).toBe('mdy');
  });

  it('falls back to the order that keeps time moving forward', () => {
    const hs = headers(['05/01/2025, 10:00 - a', '06/01/2025, 10:00 - b', '07/01/2025, 10:00 - c'], 'android');
    expect(detectDateOrder(hs)).toBe('dmy');
    const us = headers(['01/05/2025, 10:00 - a', '01/06/2025, 10:00 - b', '02/01/2025, 10:00 - c'], 'android');
    expect(detectDateOrder(us)).toBe('mdy');
  });

  it('reads year-first dates', () => {
    const hs = headers(['2025-10-01, 20:30 - a'], 'android');
    expect(detectDateOrder(hs)).toBe('ymd');
    expect(toSeconds(hs[0]!, 'ymd')).toBe(at(2025, 10, 1, 20, 30));
  });
});

describe('toSeconds', () => {
  it('handles midnight and noon in 12-hour time', () => {
    const [midnight, noon] = headers(['10/14/25, 12:05 AM - a', '10/14/25, 12:30 PM - b'], 'android');
    expect(toSeconds(midnight!, 'mdy')).toBe(at(2025, 10, 14, 0, 5));
    expect(toSeconds(noon!, 'mdy')).toBe(at(2025, 10, 14, 12, 30));
  });
});
