import { describe, expect, it } from 'vitest';
import { createLock, decryptBlob, decryptText, encryptBlob, encryptText, unlockWith } from '../src/loader/vault';

// Fewer rounds keep the tests quick; the app uses 600,000.
const ROUNDS = 1000;

describe('vault', () => {
  it('opens with the right password only', async () => {
    const { record } = await createLock('correct horse', ROUNDS);
    expect(await unlockWith(record, 'correct horse')).not.toBeNull();
    expect(await unlockWith(record, 'wrong horse')).toBeNull();
    expect(JSON.stringify(record)).not.toContain('correct horse');
  });

  it('round-trips files larger than one chunk, without leaving them readable', async () => {
    const { key } = await createLock('pw', ROUNDS);
    const data = new Uint8Array(9 * 1024 * 1024 + 123).map((_, i) => (i * 31) % 251);
    const sealed = await encryptBlob(key, new Blob([data]));
    expect(sealed.size).toBeGreaterThan(data.length);
    const back = new Uint8Array(await (await decryptBlob(key, sealed)).arrayBuffer());
    expect(back.length).toBe(data.length);
    expect(back.every((b, i) => b === data[i])).toBe(true);
    const text = await encryptText(key, 'WhatsApp Chat with Hiking Club');
    expect(await text.text()).not.toContain('Hiking');
    expect(await decryptText(key, text)).toBe('WhatsApp Chat with Hiking Club');
  });

  it('handles empty files', async () => {
    const { key } = await createLock('pw', ROUNDS);
    expect((await decryptBlob(key, await encryptBlob(key, new Blob([])))).size).toBe(0);
  });

  it('notices tampering and swapped chunks', async () => {
    const { key } = await createLock('pw', ROUNDS);
    const sealed = new Uint8Array(await (await encryptBlob(key, new Blob([new Uint8Array(5 * 1024 * 1024)]))).arrayBuffer());
    const flipped = sealed.slice();
    flipped[40] = (flipped[40] ?? 0) ^ 1;
    await expect(decryptBlob(key, new Blob([flipped]))).rejects.toThrow();
    // Swap the two chunks: each is bound to its position, so this must fail too.
    const first = new DataView(sealed.buffer).getUint32(4 + 12, true) + 16;
    const a = sealed.slice(4, 4 + first);
    const b = sealed.slice(4 + first);
    await expect(decryptBlob(key, new Blob([sealed.slice(0, 4), b, a]))).rejects.toThrow();
    const { key: other } = await createLock('pw', ROUNDS);
    await expect(decryptBlob(other, new Blob([sealed]))).rejects.toThrow();
  });
});
