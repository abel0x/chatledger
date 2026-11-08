/** Peak levels of an audio file, 0 to 1, for drawing a voice note's waveform. */
export function peaksOf(samples: Float32Array, bars: number): number[] {
  const out: number[] = [];
  const size = Math.max(1, Math.floor(samples.length / bars));
  for (let b = 0; b < bars; b++) {
    let peak = 0;
    const end = Math.min(samples.length, (b + 1) * size);
    for (let i = b * size; i < end; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));
    out.push(peak);
  }
  const top = Math.max(...out, 1e-6);
  return out.map(p => p / top);
}

const MAX_BYTES = 16 * 1024 * 1024;
let decoder: OfflineAudioContext | null = null;

/** Decodes a voice note once and keeps only its outline; null when the browser cannot. */
export async function waveform(blob: Blob, bars = 48): Promise<number[] | null> {
  if (blob.size > MAX_BYTES || typeof OfflineAudioContext !== 'function') return null;
  try {
    decoder ??= new OfflineAudioContext(1, 1, 44_100);
    const audio = await decoder.decodeAudioData(await blob.arrayBuffer());
    return peaksOf(audio.getChannelData(0), bars);
  } catch {
    return null;
  }
}
