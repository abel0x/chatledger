import { describe, expect, it } from 'vitest';
import { peaksOf } from '../src/ui/waveform';

describe('peaksOf', () => {
  it('keeps the loudest sample of each slice, scaled to the loudest overall', () => {
    const samples = Float32Array.from([0.1, -0.5, 0.2, 0.25, 0, -0.05, 1, 0.3]);
    // Float32 samples: 0.05 is stored as 0.0500000007.
    peaksOf(samples, 4).forEach((p, i) => expect(p).toBeCloseTo([0.5, 0.25, 0.05, 1][i] ?? 0, 6));
  });

  it('copes with silence and with fewer samples than bars', () => {
    expect(peaksOf(new Float32Array(10), 5)).toEqual([0, 0, 0, 0, 0]);
    expect(peaksOf(Float32Array.from([0.5]), 3)).toEqual([1, 0, 0]);
  });
});
