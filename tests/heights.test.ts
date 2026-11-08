import { describe, expect, it } from 'vitest';
import { HeightIndex } from '../src/ui/heights';

describe('HeightIndex', () => {
  it('sums offsets', () => {
    const h = new HeightIndex([10, 20, 30, 40]);
    expect(h.total).toBe(100);
    expect([0, 1, 2, 3, 4].map(i => h.offsetOf(i))).toEqual([0, 10, 30, 60, 100]);
  });

  it('finds the row at an offset', () => {
    const h = new HeightIndex([10, 20, 30, 40]);
    expect([-5, 0, 9.9, 10, 29, 30, 99, 100, 500].map(y => h.indexAt(y))).toEqual([0, 0, 0, 1, 1, 2, 3, 3, 3]);
  });

  it('stays right after heights change', () => {
    const h = new HeightIndex([10, 20, 30, 40]);
    expect(h.set(1, 50)).toBe(30);
    expect(h.total).toBe(130);
    expect(h.offsetOf(3)).toBe(90);
    expect(h.indexAt(59)).toBe(1);
    expect(h.indexAt(60)).toBe(2);
  });

  it('agrees with a plain sum on a large random list', () => {
    const n = 5003;
    const heights = Array.from({ length: n }, (_, i) => ((i * 7919) % 97) + 20);
    const h = new HeightIndex(heights);
    for (let k = 0; k < 400; k++) {
      const i = (k * 104729) % n;
      heights[i] = (k % 50) + 30;
      h.set(i, heights[i]);
    }
    let acc = 0;
    for (let i = 0; i < n; i++) {
      expect(h.offsetOf(i)).toBe(acc);
      expect(h.indexAt(acc)).toBe(i);
      acc += heights[i] as number;
    }
    expect(h.total).toBe(acc);
  });

  it('copes with an empty list', () => {
    const h = new HeightIndex([]);
    expect(h.total).toBe(0);
    expect(h.indexAt(10)).toBe(0);
  });
});
