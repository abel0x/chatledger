import { describe, expect, it } from 'vitest';
import { emojiOnly, parseStyles, richText } from '../src/ui/richtext';

describe('parseStyles', () => {
  it('reads the four inline styles', () => {
    expect(parseStyles('a *b* _c_ ~d~ `e`')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'style', s: 'b', c: [{ t: 'text', v: 'b' }] },
      { t: 'text', v: ' ' },
      { t: 'style', s: 'i', c: [{ t: 'text', v: 'c' }] },
      { t: 'text', v: ' ' },
      { t: 'style', s: 's', c: [{ t: 'text', v: 'd' }] },
      { t: 'text', v: ' ' },
      { t: 'style', s: 'code', c: [{ t: 'text', v: 'e' }] },
    ]);
  });

  it('nests styles', () => {
    expect(parseStyles('*_both_*')).toEqual([{ t: 'style', s: 'b', c: [{ t: 'style', s: 'i', c: [{ t: 'text', v: 'both' }] }] }]);
  });

  it('leaves markers alone where WhatsApp does', () => {
    for (const text of ['2*3*4', 'snake_case_name', '* not bold*', '*not bold *', 'a * b', '**', 'end*', '*line\nbreak*']) {
      expect(parseStyles(text), text).toEqual([{ t: 'text', v: text }]);
    }
  });

  it('keeps code literal', () => {
    expect(parseStyles('`*x*`')).toEqual([{ t: 'style', s: 'code', c: [{ t: 'text', v: '*x*' }] }]);
  });
});

describe('richText', () => {
  const people = ['Ada', 'Ada Yılmaz', 'Mert Aydın'];

  it('finds code blocks, links and styles together', () => {
    expect(richText('```a *b*```\nsee *https://example.com/x_y_z*')).toEqual([
      { t: 'block', v: 'a *b*' },
      { t: 'text', v: '\nsee *' },
      { t: 'link', v: 'https://example.com/x_y_z', href: 'https://example.com/x_y_z' },
      { t: 'text', v: '*' },
    ]);
  });

  it('turns mentions into people, the longest name first', () => {
    expect(richText('hi @Ada Yılmaz and @⁨Mert Aydın⁩, @+90 555 123 45 67', people)).toEqual([
      { t: 'text', v: 'hi ' },
      { t: 'mention', v: '@Ada Yılmaz', person: 1 },
      { t: 'text', v: ' and ' },
      { t: 'mention', v: '@Mert Aydın', person: 2 },
      { t: 'text', v: ', ' },
      { t: 'mention', v: '@+90 555 123 45 67', person: null },
    ]);
  });

  it('does not take an e-mail address for a mention', () => {
    expect(richText('mail ada@example.com', people)).toEqual([{ t: 'text', v: 'mail ada@example.com' }]);
  });
});

describe('emojiOnly', () => {
  it('counts messages made only of emoji', () => {
    expect(emojiOnly('😂')).toBe(1);
    expect(emojiOnly(' 👍🏽 🇹🇷 ❤️ ')).toBe(3);
    expect(emojiOnly('😂😂😂😂')).toBe(0);
    expect(emojiOnly('ok 😂')).toBe(0);
    expect(emojiOnly('123')).toBe(0);
  });
});
