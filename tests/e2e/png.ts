import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const body = Buffer.concat([head.subarray(4), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head.subarray(0, 4), body, crc]);
}

/** A tiny PNG encoder, enough for drawing test pictures without any image library. */
export function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), row + 1 + x * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** A made-up landscape: sky, sun and two mountain ridges, tinted by `hue`. */
export function landscape(seed: number, width = 480, height = 360): Buffer {
  const skyTop: [number, number, number] = [[90, 150, 220], [240, 140, 90], [120, 90, 180], [70, 170, 200]][seed % 4] as [number, number, number];
  const sunX = width * (0.25 + (seed % 5) * 0.12);
  const sunY = height * 0.3;
  const ridge = (x: number, f: number, base: number) => base + Math.sin(x / (40 + f * 9) + seed) * (18 + f * 4) + Math.cos(x / (23 + f * 5)) * 10;
  return png(width, height, (x, y) => {
    if (y > ridge(x, 3, height * 0.72)) return [mix(40, 20, y / height), mix(90, 60, y / height), mix(60, 40, y / height)];
    if (y > ridge(x, 1, height * 0.55)) return [mix(70, 45, y / height), mix(80, 60, y / height), mix(110, 90, y / height)];
    if ((x - sunX) ** 2 + (y - sunY) ** 2 < 900) return [255, 236, 170];
    const t = y / (height * 0.7);
    return [mix(skyTop[0], 250, t), mix(skyTop[1], 230, t), mix(skyTop[2], 210, t)];
  });
}
