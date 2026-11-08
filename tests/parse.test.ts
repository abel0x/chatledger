import { describe, expect, it } from 'vitest';
import { NotAChatError, parseChat, type Chat, type Message } from '../src/core';
import { fixture } from './helpers';

const senderOf = (chat: Chat, m: Message) => (m.sender == null ? null : chat.people[m.sender]);
const events = (chat: Chat) => chat.messages.filter(m => m.kind === 'event').map(m => m.event!);

describe('Android, English phone', () => {
  const chat = parseChat(fixture('android-en.txt'), { fileName: 'WhatsApp Chat with Hiking Club.txt' });

  it('reads the basics', () => {
    expect(chat.platform).toBe('android');
    expect(chat.locale).toBe('en');
    expect(chat.title).toBe('Hiking Club');
    expect(chat.self).toBe('Ada Yılmaz');
    expect(chat.people).toEqual(['Mert Aydın', 'Elif Şahin', 'Can Öztürk', 'Ada Yılmaz', 'Deniz Kaya']);
  });

  it('keeps every line', () => {
    expect(chat.messages).toHaveLength(24);
    expect(chat.warnings).toEqual([expect.objectContaining({ reason: 'unknownEvent' })]);
  });

  it('reads attachments with captions', () => {
    const img = chat.messages.find(m => m.kind === 'file' && m.media === 'image')!;
    expect(img).toMatchObject({ file: 'IMG-20251001-WA0001.jpg', text: 'Look at this view' });
    expect(chat.messages.find(m => m.media === 'voice')).toMatchObject({ file: 'PTT-20251001-WA0002.opus' });
  });

  it('keeps multi-line text intact', () => {
    const m = chat.messages.find(m => m.text?.startsWith('First line'))!;
    expect(m.text).toBe('First line\nsecond line\n\nfourth line');
  });

  it('splits the sender at the first colon only', () => {
    const m = chat.messages.find(m => m.text?.startsWith('Time:'))!;
    expect(senderOf(chat, m)).toBe('Elif Şahin');
    expect(m.text).toBe('Time: 10:30 - see you there');
  });

  it('reads edits, deletions, polls and the rest', () => {
    const kinds = chat.messages.map(m => m.kind);
    expect(kinds.filter(k => k === 'deleted')).toHaveLength(2);
    expect(chat.messages.find(m => m.edited)).toMatchObject({ text: 'We could go hiking' });
    expect(chat.messages.find(m => m.kind === 'poll')!.poll).toEqual({
      question: 'Where to?',
      options: [{ label: 'Mountain', votes: 2 }, { label: 'Lake', votes: 1 }],
    });
    expect(chat.messages.find(m => m.kind === 'location')!.text).toBe('https://maps.google.com/?q=40.1,29.0');
    expect(kinds).toContain('omitted');
    expect(kinds).toContain('viewOnce');
    expect(kinds).toContain('pending');
  });

  it('turns system lines into structured events', () => {
    const ev = events(chat);
    expect(ev.map(e => e.type)).toEqual([
      'created', 'encrypted', 'added', 'added', 'renamed', 'onlyAdminsSend',
      'securityCode', 'left', 'removed', 'pinned', 'unknown',
    ]);
    expect(ev[0]).toMatchObject({ actor: { name: 'Deniz Kaya' }, value: 'Weekend Plans' });
    expect(ev[2]).toMatchObject({ actor: { name: 'Deniz Kaya' }, targets: [{ self: true }] });
    expect(ev[3]!.targets).toEqual([{ name: 'Mert Aydın' }, { name: 'Elif Şahin' }, { name: 'Can Öztürk' }]);
    expect(ev[4]).toMatchObject({ previous: 'Weekend Plans', value: 'Hiking Club' });
    expect(ev[6]!.targets).toEqual([{ name: 'Mert Aydın' }]);
    expect(ev[9]!.actor).toEqual({ self: true });
    expect(ev[10]!.raw).toBe('Something WhatsApp will add next year');
  });

  it('gives every message a stable, unique id', () => {
    const again = parseChat(fixture('android-en.txt'));
    expect(again.messages.map(m => m.id)).toEqual(chat.messages.map(m => m.id));
    expect(new Set(chat.messages.map(m => m.id)).size).toBe(chat.messages.length);
  });

  it('reads Windows line endings the same way', () => {
    const crlf = parseChat('\uFEFF' + fixture('android-en.txt').replace(/\n/g, '\r\n'));
    expect(crlf.messages.map(m => [m.id, m.kind, m.text])).toEqual(chat.messages.map(m => [m.id, m.kind, m.text]));
  });
});

describe('Android, US English phone', () => {
  it('reads month-first dates and 12-hour time', () => {
    const chat = parseChat(
      [
        '10/1/25, 8:15\u202fPM - Deniz Kaya created group "Weekend Plans"',
        '10/13/25, 10:40\u202fPM - Elif Şahin: Late night',
        '10/14/25, 12:05\u202fAM - Elif Şahin: After midnight',
      ].join('\n'),
    );
    expect(chat.messages.map(m => m.time)).toEqual([
      Date.UTC(2025, 9, 1, 20, 15) / 1000,
      Date.UTC(2025, 9, 13, 22, 40) / 1000,
      Date.UTC(2025, 9, 14, 0, 5) / 1000,
    ]);
  });
});

describe('iOS, English phone', () => {
  const chat = parseChat(fixture('ios-en.txt'), { fileName: 'C:\\Users\\ada\\Downloads\\WhatsApp Chat - Hiking Club.zip' });

  it('reads the basics', () => {
    expect(chat.platform).toBe('ios');
    expect(chat.locale).toBe('en');
    expect(chat.title).toBe('Hiking Club');
    expect(chat.self).toBe('Ada Yılmaz');
  });

  it('does not take the group for a person', () => {
    expect(chat.people).toEqual(['Mert Aydın', 'Elif Şahin', 'Can Öztürk', 'Ada Yılmaz', 'Deniz Kaya']);
  });

  it('reads attachments, omissions and edits', () => {
    expect(chat.messages.find(m => m.media === 'image' && m.kind === 'file')!.file).toBe('00000003-PHOTO-2025-10-01-20-17-30.jpg');
    expect(chat.messages.find(m => m.media === 'voice')!.kind).toBe('file');
    expect(chat.messages.filter(m => m.kind === 'omitted').map(m => m.media)).toEqual(['image', 'sticker']);
    expect(chat.messages.filter(m => m.kind === 'deleted')).toHaveLength(2);
    expect(chat.messages.find(m => m.edited)!.text).toBe('We could go hiking');
    expect(chat.messages.find(m => m.text === 'Two\nlines')).toBeDefined();
  });

  it('keeps seconds', () => {
    expect(chat.messages[0]!.time).toBe(Date.UTC(2025, 9, 1, 20, 15, 3) / 1000);
  });

  it('reads events', () => {
    expect(events(chat).map(e => e.type)).toEqual(['encrypted', 'created', 'added', 'renamed', 'unknown']);
    expect(events(chat)[3]).toMatchObject({ value: 'Hiking Club' });
    expect(events(chat)[3]!.previous).toBeUndefined();
  });
});

describe('Turkish phones', () => {
  it('reads an Android export', () => {
    const chat = parseChat(fixture('android-tr.txt'), { fileName: 'Hafta Sonu ile WhatsApp Sohbeti.txt' });
    expect(chat.locale).toBe('tr');
    expect(chat.title).toBe('Hafta Sonu');
    expect(chat.self).toBe('Ada Yılmaz');
    expect(chat.messages.find(m => m.kind === 'file')!.file).toBe('IMG-20251001-WA0001.jpg');
    expect(chat.messages.find(m => m.edited)!.text).toBe('Yürüyüşe gidelim');
    expect(chat.messages.filter(m => m.kind === 'omitted')).toHaveLength(1);
    const ev = events(chat);
    expect(ev.map(e => e.type)).toEqual(['created', 'encrypted', 'added', 'removed', 'left']);
    expect(ev[0]).toMatchObject({ actor: { name: 'Deniz Kaya' }, value: 'Hafta Sonu' });
    expect(ev[2]!.targets).toEqual([{ self: true }]);
    expect(ev[3]).toMatchObject({ actor: { name: 'Deniz Kaya' }, targets: [{ name: 'Mert Aydın' }] });
    expect(ev[4]!.actor).toEqual({ name: 'Elif Şahin' });
  });

  it('reads an iOS export', () => {
    const chat = parseChat(fixture('ios-tr.txt'));
    expect(chat.platform).toBe('ios');
    expect(chat.locale).toBe('tr');
    expect(chat.self).toBe('Ada Yılmaz');
    expect(chat.people).toEqual(['Mert Aydın', 'Elif Şahin', 'Ada Yılmaz']);
    expect(chat.messages.map(m => m.kind)).toEqual(['event', 'text', 'file', 'deleted', 'deleted', 'omitted']);
  });
});

describe('input that is not a chat', () => {
  it('is refused', () => {
    expect(() => parseChat('hello\nworld')).toThrow(NotAChatError);
    expect(() => parseChat('')).toThrow(NotAChatError);
  });

  it('accepts names written in decomposed Unicode', () => {
    const chat = parseChat('01/10/2025, 20:30 - O\u0308zge: hi'.normalize('NFD'));
    expect(chat.people).toEqual(['Özge']);
  });
});
