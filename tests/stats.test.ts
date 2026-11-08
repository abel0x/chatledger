import { describe, expect, it } from 'vitest';
import { chatStats, parseChat } from '../src/core';

const chat = parseChat(
  [
    '06/10/2025, 01:30 - Ada: night owl 😀',
    '06/10/2025, 09:00 - Can: morning 👍🏽 👍🏽',
    '06/10/2025, 09:05 - Ada: ❤️ and ❤ www.example.com',
    '07/10/2025, 10:00 - Can: IMG-20251007-WA0001.jpg (file attached)',
    '07/10/2025, 10:01 - Ada added Deniz',
    '08/10/2025, 12:00 - Can: This message was deleted',
    '20/12/2025, 18:00 - Ada: back 🇹🇷 <This message was edited>',
  ].join('\n'),
);
const stats = chatStats(chat);

describe('chatStats', () => {
  it('counts what people sent, not system lines', () => {
    expect(stats.messages).toBe(6);
    expect(stats.media).toBe(1);
    expect(stats.deleted).toBe(1);
    expect(stats.edited).toBe(1);
    expect(stats.links).toBe(1);
  });

  it('ranks people and counts their night messages and words', () => {
    const [first, second] = stats.people;
    expect(chat.people[first!.person]).toBe('Ada');
    expect(first).toMatchObject({ messages: 3, night: 1, words: 9 });
    expect(chat.people[second!.person]).toBe('Can');
    expect(second).toMatchObject({ messages: 3, media: 1 });
  });

  it('places messages on the weekday and hour grid', () => {
    // 6 October 2025 was a Monday.
    expect(stats.heat[0 * 24 + 1]).toBe(1);
    expect(stats.heat[0 * 24 + 9]).toBe(2);
    expect(stats.heat[1 * 24 + 10]).toBe(1);
    expect(stats.heat.reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('fills every month, empty ones too', () => {
    expect(stats.months.map(m => m.count)).toEqual([5, 0, 1]);
  });

  it('finds the busiest day, the longest streak and the longest silence', () => {
    expect(stats.busiestDay?.count).toBe(3);
    expect(stats.longestStreak?.days).toBe(3);
    expect(stats.activeDays).toBe(4);
    expect(stats.spanDays).toBe(76);
    expect(stats.longestSilence).toEqual({ from: chat.messages[5]!.time, to: chat.messages[6]!.time });
  });

  it('counts whole emoji, skin tones and flags included, with and without variation selectors', () => {
    expect(stats.emojis).toEqual([
      { emoji: '👍🏽', count: 2 },
      { emoji: '❤️', count: 2 },
      { emoji: '😀', count: 1 },
      { emoji: '🇹🇷', count: 1 },
    ]);
  });
});
