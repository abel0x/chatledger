export interface Size {
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) => u16le(b, i) | ((b[i + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, i: number) => ((u16be(b, i) << 16) >>> 0) + u16be(b, i + 2);
const i32le = (b: Uint8Array, i: number) => u16le(b, i) | (u16le(b, i + 2) << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/**
 * Reads a picture's size from its first bytes, without decoding it, so that
 * a file claiming billions of pixels is never handed to the decoder.
 * Returns null for formats it does not know.
 */
export function imageSize(b: Uint8Array): Size | null {
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return { width: u32be(b, 16), height: u32be(b, 20) };
  if (b.length >= 10 && ascii(b, 0, 3) === 'GIF') return { width: u16le(b, 6), height: u16le(b, 8) };
  if (b.length >= 26 && ascii(b, 0, 2) === 'BM') return { width: Math.abs(i32le(b, 18)), height: Math.abs(i32le(b, 22)) };
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const kind = ascii(b, 12, 4);
    if (kind === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    if (kind === 'VP8L') {
      const bits = ((b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24)) >>> 0;
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    // Walk the JPEG segments to the frame header that holds the size.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1] ?? 0;
      if (marker === 0xff) {
        i++;
        continue;
      }
      const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (sof) return { width: u16be(b, i + 7), height: u16be(b, i + 5) };
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      i += 2 + u16be(b, i + 2);
    }
    return null;
  }
  return null;
}

/** How many leading bytes to read; large EXIF blocks can push a JPEG's size far in. */
export const HEADER_BYTES = 512 * 1024;
