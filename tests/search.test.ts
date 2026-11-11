import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/core';
import { buildRows } from '../src/ui/rows';
import { fold, highlight, parseQuery, SearchIndex, snippet } from '../src/core/search';
import { fixture } from './helpers';

describe('fold', () => {
  it('drops case and accents, Turkish letters included', () => {
    expect(fold('Öğretmen IŞIK İzmir ılık Çağrı')).toBe('ogretmen isik izmir ilik cagri');
    expect(fold('Straße Ærø')).toBe('strasse aero');
  });
});

describe('parseQuery', () => {
  it('splits words and keeps quoted phrases together', () => {
    expect(parseQuery('  Hiking "see you" ÇAY ')).toEqual(['hiking', 'see you', 'cay']);
    expect(parseQuery('"unfinished phrase')).toEqual(['unfinished phrase']);
    expect(parseQuery('""')).toEqual([]);
  });
});

describe('SearchIndex', () => {
  const chat = parseChat(fixture('android-en.txt'));
  const index = new SearchIndex(chat);
  const all = { sender: null, kind: 'all' as const };
  const textOf = (i: number) => chat.messages[i]?.text;

  it('needs every word to be present', () => {
    expect(index.search('look view', all).hits.map(textOf)).toEqual(['Look at this view']);
    expect(index.search('look mountain', all).hits).toEqual([]);
  });

  it('finds phrases, file names, polls and events', () => {
    expect(index.search('"see you there"', all).total).toBe(1);
    expect(index.search('WA0002', all).total).toBe(1);
    expect(index.search('lake', all).total).toBe(1);
    expect(index.search('weekend plans', all).total).toBe(2);
  });

  it('filters by sender and kind', () => {
    const elif = chat.people.indexOf('Elif Şahin');
    expect(index.search('', { sender: elif, kind: 'all' }).total).toBe(3);
    expect(index.search('', { sender: null, kind: 'media' }).total).toBe(3);
    expect(index.search('', { sender: null, kind: 'links' }).total).toBe(1);
    expect(index.search('', all).total).toBe(0);
  });

  it('keeps to a date range', () => {
    const day = (d: number, mo: number) => Date.UTC(2025, mo - 1, d) / 86400000;
    expect(index.search('', { sender: null, kind: 'all', from: day(13, 10) }).total).toBe(11);
    expect(index.search('', { sender: null, kind: 'all', to: day(1, 10) }).total).toBe(10);
    expect(index.search('', { sender: null, kind: 'all', from: day(2, 10), to: day(2, 10) }).total).toBe(3);
  });

  it('stops collecting at the limit but still counts', () => {
    const r = index.search('', { sender: null, kind: 'media', limit: 1 });
    expect(r.hits).toHaveLength(1);
    expect(r.total).toBe(3);
    expect(chat.messages[r.hits[0]!]?.kind).toBe('omitted');
  });
});

describe('highlight', () => {
  it('marks matches in the original spelling', () => {
    expect(highlight('Öğretmen geldi, öğretmen!', ['ogretmen'])).toEqual([
      { text: 'Öğretmen', hit: true },
      { text: ' geldi, ', hit: false },
      { text: 'öğretmen', hit: true },
      { text: '!', hit: false },
    ]);
  });
});

describe('snippet', () => {
  it('shows the text around the first match', () => {
    const long = `${'a '.repeat(100)}needle ${'b '.repeat(100)}`;
    const s = snippet(long, ['needle'], 20);
    expect(s).toContain('needle');
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
    expect(snippet('short text', ['text'])).toBe('short text');
  });
});

describe('buildRows', () => {
  it('starts each day with a heading and groups runs by sender', () => {
    const chat = parseChat(fixture('android-en.txt'));
    const { rows, rowOf } = buildRows(chat.messages);
    expect(rows.filter(r => r.kind === 'day')).toHaveLength(3);
    expect(rows).toHaveLength(chat.messages.length + 3);
    chat.messages.forEach((m, i) => expect(rows[rowOf[i] as number]!.key).toBe(m.id));
    const firsts = rows.filter(r => r.kind === 'message').map(r => (r.kind === 'message' ? r.first : null));
    expect(firsts.slice(0, 6)).toEqual([true, true, true, true, true, false]);
  });
});
