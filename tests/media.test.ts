import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/core';
import { attachments, links, monthOf, visuals } from '../src/ui/media';

const chat = parseChat(
  [
    '01/10/2025, 20:00 - Ada: IMG-20251001-WA0001.jpg (file attached)',
    '01/10/2025, 20:01 - Ada: STK-20251001-WA0002.webp (file attached)',
    '01/10/2025, 20:02 - Can: VID-20251001-WA0003.mp4 (file attached)',
    '01/10/2025, 20:03 - Can: PTT-20251001-WA0004.opus (file attached)',
    '01/10/2025, 20:04 - Can: Plan.pdf (file attached)',
    '01/10/2025, 20:05 - Ada: IMG-20251001-WA0005.jpg (file attached)',
    '02/11/2025, 09:00 - Ada: see https://example.com and www.example.org',
    '02/11/2025, 09:01 - Can: AUD-20251102-WA0006.mp3 (file attached)',
  ].join('\n'),
);
const has = (file: string) => file !== 'IMG-20251001-WA0005.jpg';

describe('gallery lists', () => {
  it('collects photos and videos the export has, without stickers', () => {
    expect(visuals(chat, has)).toEqual([
      { index: 0, file: 'IMG-20251001-WA0001.jpg', kind: 'image' },
      { index: 2, file: 'VID-20251001-WA0003.mp4', kind: 'video' },
    ]);
  });

  it('collects documents and audio files, not voice notes', () => {
    expect(attachments(chat, has).map(a => a.file)).toEqual(['Plan.pdf', 'AUD-20251102-WA0006.mp3']);
  });

  it('collects every link', () => {
    expect(links(chat)).toEqual([
      { index: 6, href: 'https://example.com', text: 'https://example.com' },
      { index: 6, href: 'https://www.example.org', text: 'www.example.org' },
    ]);
  });

  it('groups by calendar month', () => {
    expect(monthOf(chat.messages[0]!.time)).toBe(2025 * 12 + 9);
    expect(monthOf(chat.messages[6]!.time)).toBe(2025 * 12 + 10);
  });
});
