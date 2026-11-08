import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/core';
import { chatKey, exportStars, importStars, Stars } from '../src/ui/stars.svelte';
import { fixture } from './helpers';

const chat = parseChat(fixture('android-en.txt'));

describe('stars', () => {
  it('keys a chat by its first message, so a longer re-export keeps its stars', () => {
    const longer = parseChat(`${fixture('android-en.txt')}\n14/10/2025, 08:00 - Elif Şahin: one more`);
    expect(chatKey(longer)).toBe(chatKey(chat));
  });

  it('toggles and counts new ones', () => {
    const stars = new Stars('test');
    const [a, b] = chat.messages;
    expect(stars.toggle(a!.id)).toBe(true);
    expect(stars.has(a!.id)).toBe(true);
    expect(stars.addAll([a!.id, b!.id])).toBe(1);
    expect(stars.toggle(a!.id)).toBe(false);
    expect([...stars.ids]).toEqual([b!.id]);
  });

  it('round-trips through a file and ignores what belongs to other chats', () => {
    const picked = new Set([chat.messages[4]!.id, chat.messages[6]!.id]);
    const file = exportStars(chat, picked);
    expect(JSON.parse(file).messages[0]).toMatchObject({ sender: 'Mert Aydın', text: 'Hey everyone' });
    expect(importStars(file, chat)).toEqual([...picked]);
    expect(importStars(file, parseChat('01/01/2020, 10:00 - X: y'))).toEqual([]);
    expect(importStars('{"format":"other"}', chat)).toBeNull();
    expect(importStars('not json', chat)).toBeNull();
  });
});
