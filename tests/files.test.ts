import { describe, expect, it } from 'vitest';
import { mediaHintFor } from '../src/core/files';

describe('mediaHintFor', () => {
  it.each([
    ['IMG-20251001-WA0001.jpg', 'image'],
    ['VID-20251001-WA0002.mp4', 'video'],
    ['PTT-20251001-WA0003.opus', 'voice'],
    ['AUD-20251001-WA0004.mp3', 'audio'],
    ['STK-20251001-WA0005.webp', 'sticker'],
    ['00000003-PHOTO-2025-10-01-20-17-30.jpg', 'image'],
    ['00000004-AUDIO-2025-10-01-20-18-00.opus', 'voice'],
    ['00000005-STICKER-2025-10-01-20-18-00.webp', 'sticker'],
    ['00000006-GIF-2025-10-01-20-18-00.mp4', 'gif'],
    ['Ada Yılmaz.vcf', 'contact'],
    ['Exam schedule.pdf', 'document'],
    ['holiday.png', 'image'],
    ['README', 'unknown'],
  ])('%s is %s', (name, hint) => {
    expect(mediaHintFor(name)).toBe(hint);
  });
});
