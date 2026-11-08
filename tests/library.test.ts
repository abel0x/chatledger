import { describe, expect, it } from 'vitest';
import { exportId, storedNames } from '../src/loader/library';

const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

describe('exportId', () => {
  it('ignores order and folders but not content size', () => {
    const a = exportId([file('chat.txt', 10), file('IMG-1.jpg', 5)]);
    expect(exportId([file('IMG-1.jpg', 5), file('chat.txt', 10)])).toBe(a);
    expect(exportId([file('chat.txt', 11), file('IMG-1.jpg', 5)])).not.toBe(a);
  });

  it('treats decomposed names as the same file', () => {
    expect(exportId([file('Özge.txt'.normalize('NFD'), 3)])).toBe(exportId([file('Özge.txt', 3)]));
  });
});

describe('storedNames', () => {
  it('keeps names unique and safe', () => {
    expect(storedNames([file('a.jpg', 1), file('A.jpg', 1), file('a.jpg', 1), file('x:y?.txt', 1), file('', 1)])).toEqual([
      'a.jpg',
      'A (2).jpg',
      'a (3).jpg',
      'x_y_.txt',
      'file',
    ]);
  });
});
