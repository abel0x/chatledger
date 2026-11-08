import { describe, expect, it } from 'vitest';
import { limit } from '../src/loader/limit';

describe('limit', () => {
  it('never runs more than n tasks at once and runs them all', async () => {
    const run = limit(2);
    let active = 0;
    let peak = 0;
    const order: number[] = [];
    const task = (i: number) => async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 5));
      order.push(i);
      active--;
      if (i === 3) throw new Error('boom');
      return i;
    };
    const results = await Promise.allSettled([0, 1, 2, 3, 4].map(i => run(task(i))));
    expect(peak).toBe(2);
    expect(order.sort()).toEqual([0, 1, 2, 3, 4]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'rejected', 'fulfilled']);
  });
});
