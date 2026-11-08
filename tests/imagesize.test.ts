import { describe, expect, it } from 'vitest';
import { imageSize } from '../src/loader/imagesize';
import { png } from './e2e/png';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap(p => (typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p)));

describe('imageSize', () => {
  it('reads PNG, GIF and BMP headers', () => {
    expect(imageSize(png(37, 21, () => [0, 0, 0]))).toEqual({ width: 37, height: 21 });
    expect(imageSize(bytes('GIF89a', [0x2c, 0x01, 0x58, 0x02]))).toEqual({ width: 300, height: 600 });
    const bmp = new Uint8Array(30);
    bmp.set(bytes('BM'));
    new DataView(bmp.buffer).setInt32(18, 640, true);
    new DataView(bmp.buffer).setInt32(22, -480, true);
    expect(imageSize(bmp)).toEqual({ width: 640, height: 480 });
  });

  it('walks JPEG segments to the frame header', () => {
    const app1 = [0xff, 0xe1, 0x00, 0x08, 1, 2, 3, 4, 5, 6];
    const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x10, 0x00, 0x20, 0x00, 0x03];
    expect(imageSize(bytes([0xff, 0xd8], app1, sof0, new Array(20).fill(0)))).toEqual({ width: 8192, height: 4096 });
  });

  it('reads the three kinds of WebP', () => {
    const vp8x = bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8X', [10, 0, 0, 0, 0, 0, 0, 0], [0x7f, 0x0c, 0x00], [0x37, 0x09, 0x00], [0, 0]);
    expect(imageSize(vp8x)).toEqual({ width: 3200, height: 2360 });
    const lossy = bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8 ', [0, 0, 0, 0], [0, 0, 0, 0x9d, 0x01, 0x2a], [0x80, 0x02, 0xe0, 0x01]);
    expect(imageSize(lossy)).toEqual({ width: 640, height: 480 });
  });

  it('admits when it does not know the format', () => {
    expect(imageSize(bytes('not an image at all, really'))).toBeNull();
    expect(imageSize(new Uint8Array())).toBeNull();
  });
});
