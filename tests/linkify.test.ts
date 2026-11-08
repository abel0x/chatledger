import { describe, expect, it } from 'vitest';
import { linkify } from '../src/ui/linkify';

describe('linkify', () => {
  it('leaves plain text alone', () => {
    expect(linkify('no links here')).toEqual([{ text: 'no links here' }]);
  });

  it('finds links and leaves punctuation outside them', () => {
    expect(linkify('see https://example.com/a?b=1, then www.example.org.')).toEqual([
      { text: 'see ' },
      { text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { text: ', then ' },
      { text: 'www.example.org', href: 'https://www.example.org' },
      { text: '.' },
    ]);
  });

  it('only links the web', () => {
    expect(linkify('javascript:alert(1) file:///etc/passwd').every(p => !p.href)).toBe(true);
  });
});
