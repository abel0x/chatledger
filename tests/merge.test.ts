import { describe, expect, it } from 'vitest';
import { DifferentChatsError, mergeChats, parseChat } from '../src/core';

const older = parseChat(
  [
    '01/10/2025, 20:00 - Ada: First',
    '01/10/2025, 20:01 - Can: <Media omitted>',
    '01/10/2025, 20:02 - Ada: Plans for Saturday',
    '01/10/2025, 20:02 - Ada: Bring water',
    '01/10/2025, 20:03 - Can: Lunch at noon',
  ].join('\n'),
  { fileName: 'WhatsApp Chat with Hikers.txt' },
);

const newer = parseChat(
  [
    '01/10/2025, 20:01 - Can: IMG-20251001-WA0001.jpg (file attached)',
    '01/10/2025, 20:02 - Ada: Plans for Saturday',
    '01/10/2025, 20:02 - Ada: Bring water',
    '01/10/2025, 20:03 - Can: This message was deleted',
    '02/10/2025, 09:00 - Elif: Good morning',
  ].join('\n'),
  { fileName: 'WhatsApp Chat with Hikers (1).txt' },
);

describe('mergeChats', () => {
  const merged = mergeChats([newer, older]);
  const lines = merged.messages.map(m => `${merged.people[m.sender ?? -1] ?? ''}: ${m.kind} ${m.text ?? m.file ?? ''}`.trim());

  it('keeps every message once, in order', () => {
    expect(lines).toEqual([
      'Ada: text First',
      'Can: file IMG-20251001-WA0001.jpg',
      'Ada: text Plans for Saturday',
      'Ada: text Bring water',
      'Can: text Lunch at noon',
      'Elif: text Good morning',
    ]);
  });

  it('keeps the fuller version: the photo over the omission, the text over its deletion', () => {
    expect(merged.messages[1]?.media).toBe('image');
    expect(merged.messages[4]?.kind).toBe('text');
  });

  it('gives every message its own id and every person one index', () => {
    expect(new Set(merged.messages.map(m => m.id)).size).toBe(merged.messages.length);
    expect(merged.people).toEqual(['Ada', 'Can', 'Elif']);
    expect(merged.title).toBe('Hikers');
  });

  it('refuses to mix up different chats', () => {
    const other = parseChat('05/05/2024, 10:00 - Zoe: Hello', { fileName: 'WhatsApp Chat with Book club.txt' });
    expect(() => mergeChats([older, other])).toThrow(DifferentChatsError);
  });

  it('prefers the later wording of an edited message', () => {
    const a = parseChat('01/10/2025, 20:00 - Ada: Meet at 8', { fileName: 'WhatsApp Chat with X.txt' });
    const b = parseChat('01/10/2025, 20:00 - Ada: Meet at 9 <This message was edited>\n02/10/2025, 10:00 - Ada: later', {
      fileName: 'WhatsApp Chat with X.txt',
    });
    expect(mergeChats([a, b]).messages[0]).toMatchObject({ text: 'Meet at 9', edited: true });
  });
});
