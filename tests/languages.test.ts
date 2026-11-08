import { describe, expect, it } from 'vitest';
import { parseChat, type Chat } from '../src/core';
import { fixture } from './helpers';

const events = (chat: Chat) => chat.messages.filter(m => m.kind === 'event').map(m => m.event!);

const CASES = [
  { id: 'es', file: 'Chat de WhatsApp con Club de montaña.txt', title: 'Club de montaña', renamed: 'Club de montaña' },
  { id: 'pt', file: 'Conversa do WhatsApp com Clube da trilha.txt', title: 'Clube da trilha', renamed: 'Clube da trilha' },
  { id: 'de', file: 'WhatsApp Chat mit Wanderclub.txt', title: 'Wanderclub', renamed: 'Wanderclub' },
  { id: 'fr', file: 'Discussion WhatsApp avec Club rando.txt', title: 'Club rando', renamed: 'Club rando' },
  { id: 'it', file: 'Chat WhatsApp con Club escursioni.txt', title: 'Club escursioni', renamed: 'Club escursioni' },
];

describe.each(CASES)('Android, $id phone', ({ id, file, title, renamed }) => {
  const chat = parseChat(fixture(`android-${id}.txt`), { fileName: file });

  it('recognises the language and the chat', () => {
    expect(chat.locale).toBe(id);
    expect(chat.title).toBe(title);
    expect(chat.self).toBe('Ada Yılmaz');
    expect(chat.warnings).toEqual([]);
  });

  it('reads every kind of message', () => {
    const img = chat.messages.find(m => m.kind === 'file')!;
    expect(img).toMatchObject({ file: 'IMG-20251001-WA0001.jpg', media: 'image' });
    expect(img.text).toBeTruthy();
    expect(chat.messages.filter(m => m.kind === 'deleted')).toHaveLength(2);
    expect(chat.messages.find(m => m.edited)?.kind).toBe('text');
    expect(chat.messages.find(m => m.edited)?.text).not.toMatch(/[<>]/);
    expect(chat.messages.find(m => m.kind === 'poll')?.poll?.options.map(o => o.votes)).toEqual([2, 1]);
    expect(chat.messages.find(m => m.kind === 'location')?.text).toBe('https://maps.google.com/?q=40.1,29.0');
    expect(chat.messages.filter(m => m.kind === 'omitted')).toHaveLength(1);
  });

  it('understands group events', () => {
    const ev = events(chat);
    expect(ev.filter(e => e.type === 'unknown').map(e => e.raw)).toEqual([]);
    expect(ev[0]).toMatchObject({ type: 'created', actor: { name: 'Deniz Kaya' } });
    expect(ev.find(e => e.type === 'added' && e.targets?.length === 1)?.targets).toEqual([{ self: true }]);
    expect(ev.find(e => e.type === 'added' && (e.targets?.length ?? 0) > 1)?.targets).toEqual([{ name: 'Mert Aydın' }, { name: 'Elif Şahin' }]);
    expect(ev.find(e => e.type === 'renamed')?.value).toBe(renamed);
    expect(ev.find(e => e.type === 'left')?.actor).toEqual({ name: 'Mert Aydın' });
    expect(ev.find(e => e.type === 'removed')?.targets).toEqual([{ name: 'Elif Şahin' }]);
  });
});

describe('German group picture events', () => {
  it('are not taken for removing a person', () => {
    const chat = parseChat(fixture('android-de.txt'));
    expect(events(chat).find(e => e.raw.includes('Gruppenbild'))?.type).toBe('iconDeleted');
  });
});

describe('iOS, Spanish phone', () => {
  it('reads attachments and omissions', () => {
    const chat = parseChat(fixture('ios-es.txt'));
    expect(chat.platform).toBe('ios');
    expect(chat.locale).toBe('es');
    expect(chat.self).toBe('Ada Yılmaz');
    expect(chat.messages.map(m => m.kind)).toEqual(['event', 'text', 'file', 'deleted', 'omitted']);
    expect(chat.messages.at(-1)?.media).toBe('image');
  });
});
