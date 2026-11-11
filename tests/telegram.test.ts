import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { describe, expect, it } from 'vitest';
import {
  DifferentChatsError,
  mergeChats,
  NotAChatError,
  parseChat,
  parseTelegramHtml,
  parseTelegramJson,
  telegramExports,
  WholeAccountError,
  type Chat,
  type Message,
} from '../src/core';
import { decodeEntities, parseHtml, textOf } from '../src/core/telegram/dom';
import { describeEvent } from '../src/i18n/translate';
import { LoadError, openExport } from '../src/loader/open';
import { fixture } from './helpers';

const json = () => parseTelegramJson(fixture('telegram/result.json'));
const html = () => parseTelegramHtml([fixture('telegram/messages.html'), fixture('telegram/messages2.html')]);
const byId = (chat: Chat, id: string) => chat.messages.find(m => m.id === id) as Message;
const at = (iso: string) => Date.parse(`${iso}Z`) / 1000;

async function zip(name: string, entries: Record<string, string>): Promise<File> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false });
  for (const [path, data] of Object.entries(entries)) await writer.add(path, new TextReader(data));
  return new File([await writer.close()], name);
}

async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return err instanceof LoadError ? err.code : String(err);
  }
  return 'no error';
}

describe('Telegram JSON', () => {
  it('reads the chat, its people and wall-clock times', () => {
    const chat = json();
    expect(chat.platform).toBe('telegram');
    expect(chat.title).toBe('Weekend Hikers');
    expect(chat.people).toEqual(['Ada Demir', 'Bora Kaya', 'Cem Aydın', 'Ada Demir (2)', 'Deleted Account']);
    expect(chat.self).toBeNull();
    expect(chat.messages).toHaveLength(18);
    expect(byId(chat, 'tg3').time).toBe(at('2025-03-01T09:02:10'));
  });

  it('turns service messages into events', () => {
    const chat = json();
    expect(byId(chat, 'tg1').event).toMatchObject({ type: 'created', actor: { name: 'Ada Demir' }, value: 'Hikers' });
    expect(byId(chat, 'tg2').event).toMatchObject({ type: 'renamed', value: 'Weekend Hikers' });
    expect(byId(chat, 'tg15').event?.type).toBe('pinned');
    expect(byId(chat, 'tg16').event).toMatchObject({ type: 'left', actor: { name: 'Cem Aydın' } });
    expect(byId(chat, 'tg17').event?.type).toBe('unknown');
    expect(chat.warnings).toEqual([expect.objectContaining({ reason: 'unknownEvent' })]);
  });

  it('keeps styles apart from the plain text', () => {
    const chat = json();
    const welcome = byId(chat, 'tg3');
    expect(welcome.text).toBe('Welcome! Read the rules at https://example.org/rules');
    expect(welcome.spans).toEqual([
      { text: 'Welcome! Read the ' },
      { text: 'rules', b: true },
      { text: ' at ' },
      { text: 'https://example.org/rules', href: 'https://example.org/rules' },
    ]);
    // Telegram has no inline marks, so stars are just stars.
    const thanks = byId(chat, 'tg4');
    expect(thanks.text).toBe('Thanks *Ada*, see you Saturday');
    expect(thanks.spans).toBeUndefined();
    const forwarded = byId(chat, 'tg9');
    expect(forwarded.spans?.map(s => [s.text, s.i ?? s.spoiler ?? false])).toEqual([
      ['Snow expected', true],
      [' on the pass. ', false],
      ['Bring gloves', true],
    ]);
  });

  it('never keeps a link that could run code', () => {
    const spans = byId(json(), 'tg14').spans;
    expect(spans).toEqual([{ text: 'map and ' }, { text: 'site', href: 'https://example.org' }]);
  });

  it('reads replies, forwards, edits and reactions', () => {
    const chat = json();
    expect(byId(chat, 'tg4')).toMatchObject({ replyTo: 'tg3', edited: true });
    expect(byId(chat, 'tg9').forwardedFrom).toBe('Mountain News');
    expect(byId(chat, 'tg3').reactions).toEqual([
      { emoji: '👍', count: 2 },
      { emoji: null, count: 1 },
    ]);
  });

  it('reads attachments, left-out files, polls, places and contacts', () => {
    const chat = json();
    expect(byId(chat, 'tg5')).toMatchObject({ kind: 'file', media: 'image', file: 'photos/photo_1@01-03-2025_10-00-00.jpg', text: 'The trail' });
    expect(byId(chat, 'tg6')).toMatchObject({ kind: 'file', media: 'voice' });
    expect(byId(chat, 'tg7')).toMatchObject({ kind: 'file', media: 'sticker', file: 'stickers/sticker.tgs_thumb.jpg' });
    expect(byId(chat, 'tg8')).toMatchObject({ kind: 'omitted', media: 'video' });
    expect(byId(chat, 'tg10').poll).toEqual({
      question: 'Start time?',
      options: [
        { label: '7:00', votes: 1 },
        { label: '8:00', votes: 2 },
      ],
    });
    expect(byId(chat, 'tg11')).toMatchObject({ kind: 'location', text: 'https://maps.google.com/?q=40.5,29.25' });
    expect(byId(chat, 'tg12')).toMatchObject({ kind: 'file', media: 'contact', file: 'contacts/contact_1.vcf' });
    expect(chat.people[byId(chat, 'tg18').sender as number]).toBe('Deleted Account');
  });

  it('knows who exported a one-to-one chat and reads calls', () => {
    const chat = parseTelegramJson(
      JSON.stringify({
        name: 'Bora Kaya',
        type: 'personal_chat',
        id: 5,
        messages: [
          { id: 1, type: 'message', date: '2025-01-01T10:00:00', from: 'Bora Kaya', from_id: 'user2', text: 'hi' },
          { id: 2, type: 'message', date: '2025-01-01T10:01:00', from: 'Ada Demir', from_id: 'user1', text: 'hey' },
          { id: 3, type: 'service', date: '2025-01-01T11:00:00', actor: 'Ada Demir', actor_id: 'user1', action: 'phone_call', duration_seconds: 125 },
          { id: 4, type: 'service', date: '2025-01-01T12:00:00', actor: 'Bora Kaya', actor_id: 'user2', action: 'phone_call', discard_reason: 'missed' },
        ],
      }),
    );
    expect(chat.self).toBe('Ada Demir');
    expect(describeEvent(byId(chat, 'tg3').event!, 'en', chat.self)).toBe('Ada Demir called · 2:05');
    expect(describeEvent(byId(chat, 'tg4').event!, 'tr', chat.self)).toBe('Cevapsız arama: Bora Kaya');
  });

  it('opens an account export only when it holds a single chat', () => {
    const chat = { name: 'Solo', type: 'personal_chat', id: 1, messages: [{ id: 1, type: 'message', date: '2025-01-01T10:00:00', from: 'A', text: 'x' }] };
    const empty = { name: 'Empty', type: 'personal_chat', id: 2, messages: [] };
    expect(parseTelegramJson(JSON.stringify({ chats: { list: [chat, empty] } })).title).toBe('Solo');
    expect(() => parseTelegramJson(JSON.stringify({ chats: { list: [chat, { ...chat, name: 'Other' }] } }))).toThrow(WholeAccountError);
  });

  it('refuses JSON that is not a chat', () => {
    expect(() => parseTelegramJson('{"name": "x"}')).toThrow(NotAChatError);
    expect(() => parseTelegramJson('[1, 2]')).toThrow(NotAChatError);
    expect(() => parseTelegramJson('not json')).toThrow(NotAChatError);
  });
});

describe('Telegram HTML', () => {
  it('reads the same messages, under the same ids, as the JSON export', () => {
    const chat = html();
    expect(chat.platform).toBe('telegram');
    expect(chat.title).toBe('Weekend Hikers');
    expect(chat.people).toEqual(['Ada Demir', 'Bora Kaya', 'Cem Aydın']);
    const fromJson = json();
    for (const id of ['tg3', 'tg4', 'tg5', 'tg6', 'tg7', 'tg8', 'tg9', 'tg10', 'tg14']) {
      const a = byId(chat, id);
      const b = byId(fromJson, id);
      expect([a.time, a.kind, a.media, chat.people[a.sender as number]], id).toEqual([b.time, b.kind, b.media, fromJson.people[b.sender as number]]);
    }
  });

  it('reads styles, replies, forwards and reactions', () => {
    const chat = html();
    expect(byId(chat, 'tg3').spans).toEqual(byId(json(), 'tg3').spans);
    expect(byId(chat, 'tg3').reactions).toEqual([{ emoji: '👍', count: 2 }]);
    expect(byId(chat, 'tg4')).toMatchObject({ replyTo: 'tg3', text: 'Thanks *Ada*, see you Saturday <3' });
    // Telegram's HTML pages do not say which messages were edited.
    expect(byId(chat, 'tg4').edited).toBeUndefined();
    expect(byId(chat, 'tg9').forwardedFrom).toBe('Mountain News');
    expect(byId(chat, 'tg9').spans?.find(s => s.spoiler)?.text).toBe('Bring gloves');
    expect(byId(chat, 'tg10').poll?.options).toEqual([
      { label: '7:00', votes: 1 },
      { label: '8:00', votes: 2 },
    ]);
  });

  it('ignores scripts and links that could run code', () => {
    const m = byId(html(), 'tg14');
    expect(m.text).toBe('map and site');
    expect(m.spans).toEqual([{ text: 'map and ' }, { text: 'site', href: 'https://example.org' }]);
  });

  it('places service messages in time and reads the ones it knows', () => {
    const chat = html();
    expect(byId(chat, 'tg1')).toMatchObject({ time: at('2025-03-01T00:00:00'), event: { type: 'created', value: 'Hikers' } });
    expect(byId(chat, 'tg2').event).toMatchObject({ type: 'renamed', actor: { name: 'Ada Demir' }, value: 'Weekend Hikers' });
    expect(byId(chat, 'tg16')).toMatchObject({ time: at('2025-03-02T07:33:00'), event: { type: 'left' } });
    expect(byId(chat, 'tg17').event).toMatchObject({ type: 'unknown', raw: 'Ada Demir changed the chat theme to 🏔' });
  });

  it('refuses pages Telegram did not write', () => {
    expect(() => parseTelegramHtml(['<html><body><p>hello</p></body></html>'])).toThrow(NotAChatError);
  });
});

describe('Telegram channels', () => {
  const channelJson = JSON.stringify({
    name: 'Trail News 🏔',
    type: 'public_channel',
    id: 900,
    messages: [
      { id: 1, type: 'service', date: '2025-03-01T08:00:00', date_unixtime: '1740805200', actor: 'Trail News', actor_id: 'channel900', action: 'create_channel', title: 'Trail News', text: '', text_entities: [] },
      { id: 2, type: 'service', date: '2025-03-01T08:00:00', date_unixtime: '1740805200', actor: 'Trail News', actor_id: 'channel900', action: 'edit_group_photo', photo: 'photos/photo_1@01-03-2025_08-00-00.jpg', text: '', text_entities: [] },
      { id: 3, type: 'service', date: '2025-03-02T09:00:00', date_unixtime: '1740895200', actor: 'Trail News 🏔', actor_id: 'channel900', action: 'edit_group_title', title: 'Trail News 🏔', text: '', text_entities: [] },
      { id: 4, type: 'service', date: '2025-03-03T10:00:00', date_unixtime: '1740985200', actor: 'Trail News 🏔', actor_id: 'channel900', action: 'paid_messages_price_change', price_stars: 300, is_broadcast_messages_allowed: true, text: '', text_entities: [] },
      {
        id: 5,
        type: 'message',
        date: '2025-03-03T11:00:00',
        date_unixtime: '1740988800',
        edited: '2025-03-03T11:05:00',
        edited_unixtime: '1740989100',
        from: 'Trail News 🏔',
        from_id: 'channel900',
        text: '',
        text_entities: [
          { type: 'plain', text: 'Ask ' },
          { type: 'mention', text: '@ada_hikes' },
          { type: 'plain', text: ' or see ' },
          { type: 'link', text: 'example.org/trails' },
        ],
      },
      { id: 6, type: 'message', date: '2025-03-03T12:00:00', date_unixtime: '1740992400', from: null, from_id: 'user7', author: 'Ada', text: 'Old post', text_entities: [{ type: 'plain', text: 'Old post' }] },
    ],
  });
  const service = (id: number, text: string) => `<div class="message service" id="message${id}"><div class="body details">${text}</div></div>`;
  const post = (id: number, time: string, from: string, text: string) =>
    `<div class="message default clearfix" id="message${id}"><div class="body"><div class="pull_right date details" title="${time} UTC+03:00">x</div><div class="from_name">${from}</div><div class="text">${text}</div></div></div>`;
  const channelHtml = `<div class="page_wrap"><div class="page_header"><div class="content"><div class="text bold">Trail News 🏔</div></div></div><div class="history">
    ${service(-1, '1 March 2025')}
    ${service(1, 'Channel &laquo;Trail News&raquo; created')}
    ${service(2, 'Channel photo changed')}
    ${service(-2, '2 March 2025')}
    ${service(3, 'Channel title changed to &laquo;Trail News 🏔&raquo;')}
    ${service(-3, '3 March 2025')}
    ${service(4, 'Price per direct message changed to 300 Telegram Stars.')}
    ${post(5, '03.03.2025 11:00:00', 'Trail News 🏔', 'Ask <a href="https://t.me/ada_hikes">@ada_hikes</a> or see <a href="https://example.org/trails">example.org/trails</a>')}
    ${post(6, '03.03.2025 12:00:00', 'Deleted Account', 'Old post')}
  </div></div>`;

  it('reads the same channel events from JSON and HTML', () => {
    for (const chat of [parseTelegramJson(channelJson), parseTelegramHtml([channelHtml])]) {
      expect(chat.warnings).toEqual([]);
      expect(chat.messages.slice(0, 4).map(m => [m.event?.type, m.event?.actor, m.event?.value])).toEqual([
        ['channelCreated', undefined, 'Trail News'],
        ['channelIconChanged', undefined, undefined],
        ['channelRenamed', undefined, 'Trail News 🏔'],
        ['messagePriceChanged', undefined, '300'],
      ]);
      expect(describeEvent(chat.messages[2]!.event!, 'en', null)).toBe('Channel name changed to “Trail News 🏔”');
      expect(describeEvent(chat.messages[3]!.event!, 'tr', null)).toBe('Mesaj başına ücret ⭐ 300 olarak değiştirildi');
    }
  });

  it('reads mentions, bare web addresses and deleted senders alike', () => {
    const fromJson = parseTelegramJson(channelJson);
    const fromHtml = parseTelegramHtml([channelHtml]);
    const spans = [{ text: 'Ask ' }, { text: '@ada_hikes', mention: true }, { text: ' or see ' }, { text: 'example.org/trails', href: 'https://example.org/trails' }];
    expect(byId(fromJson, 'tg5').spans).toEqual(spans);
    expect(byId(fromHtml, 'tg5').spans).toEqual(spans);
    for (const chat of [fromJson, fromHtml]) expect(chat.people[byId(chat, 'tg6').sender as number]).toBe('Deleted Account');
  });
});

describe('Telegram exports together', () => {
  it('joins a JSON and an HTML export of the same chat', () => {
    const merged = mergeChats([html(), json()]);
    expect(merged.messages).toHaveLength(json().messages.length);
    expect(merged.messages.map(m => m.id)).toEqual(json().messages.map(m => m.id));
  });

  it('never joins a Telegram chat with a WhatsApp one', () => {
    const whatsapp = parseChat(fixture('android-en.txt'), { fileName: 'WhatsApp Chat with Weekend Hikers.txt' });
    expect(() => mergeChats([whatsapp, { ...json(), title: whatsapp.title }])).toThrow(DifferentChatsError);
  });

  it('finds the chat in an export folder', () => {
    expect(
      telegramExports(['ChatExport/photos/a.jpg', 'ChatExport/messages2.html', 'ChatExport/messages10.html', 'ChatExport/messages.html', 'ChatExport/css/style.css']),
    ).toEqual([{ format: 'html', paths: ['ChatExport/messages.html', 'ChatExport/messages2.html', 'ChatExport/messages10.html'] }]);
    expect(telegramExports(['x/result.json', 'result.json'])).toEqual([
      { format: 'json', path: 'result.json' },
      { format: 'json', path: 'x/result.json' },
    ]);
  });
});

describe('HTML reader', () => {
  it('decodes entities and keeps bad code points harmless', () => {
    expect(decodeEntities('a &amp; b &lt;3 &#x1F600; &#55296; &bogus;')).toBe('a & b <3 😀 � &bogus;');
  });

  it('survives deep nesting and unclosed tags', () => {
    const deep = '<div class="x">'.repeat(50_000) + 'end';
    expect(textOf(parseHtml(deep))).toBe('end');
    expect(textOf(parseHtml('<p>a<b>b<i>c</p>d'))).toBe('abcd');
  });
});

describe('opening Telegram exports', () => {
  it('opens a zipped JSON export and finds its files', async () => {
    const file = await zip('ChatExport.zip', {
      'ChatExport_2025-03-02/result.json': fixture('telegram/result.json'),
      'ChatExport_2025-03-02/photos/photo_1@01-03-2025_10-00-00.jpg': 'jpeg',
      'ChatExport_2025-03-02/files/notes.txt': 'not a chat',
    });
    const opened = await openExport([file]);
    expect(opened.chat.title).toBe('Weekend Hikers');
    expect(opened.found).toContain('photos/photo_1@01-03-2025_10-00-00.jpg');
    expect(opened.missing).toContain('voice_messages/audio_1@01-03-2025_10-01-00.ogg');
    expect(await opened.read('photos/photo_1@01-03-2025_10-00-00.jpg')).not.toBeNull();
    await opened.close();
  });

  it('opens HTML pages picked as loose files', async () => {
    const opened = await openExport([
      new File([fixture('telegram/messages2.html')], 'messages2.html'),
      new File([fixture('telegram/messages.html')], 'messages.html'),
    ]);
    expect(opened.chat.messages.map(m => m.id).slice(0, 3)).toEqual(['tg1', 'tg2', 'tg3']);
    await opened.close();
  });

  it('asks for a single chat when a whole account was exported', async () => {
    const page = fixture('telegram/messages.html');
    const file = await zip('DataExport.zip', {
      'export_results.html': '<html></html>',
      'chats/chat_01/messages.html': page,
      'chats/chat_02/messages.html': page,
    });
    expect(await failure(openExport([file]))).toBe('wholeAccount');
  });

  it('joins two exports of the same chat picked together', async () => {
    const all = JSON.parse(fixture('telegram/result.json'));
    const early = { ...all, messages: all.messages.slice(0, 10) };
    const late = { ...all, messages: all.messages.slice(6) };
    const opened = await openExport([
      new File([JSON.stringify(late)], 'result.json'),
      new File([JSON.stringify(early)], 'result.json'),
    ]);
    expect(opened.chat.messages).toHaveLength(all.messages.length);
    await opened.close();
  });

  it('still opens a WhatsApp export that carries a result.json attachment', async () => {
    const file = await zip('WhatsApp Chat with Weekend Hikers.zip', {
      'WhatsApp Chat with Weekend Hikers.txt': fixture('android-en.txt'),
      'result.json': '{"score": 3}',
    });
    const opened = await openExport([file]);
    expect(opened.chat.platform).toBe('android');
    await opened.close();
  });
});

describe('group info from Telegram events', () => {
  it('counts people who joined by themselves and who left', async () => {
    const { groupInfo } = await import('../src/ui/groupinfo');
    const chat = parseTelegramJson(
      JSON.stringify({
        name: 'Club',
        type: 'private_group',
        id: 9,
        messages: [
          { id: 1, type: 'service', date: '2025-01-01T09:00:00', actor: 'Ada', actor_id: 'user1', action: 'create_group', title: 'Club', members: ['Bora'] },
          { id: 2, type: 'service', date: '2025-01-01T10:00:00', actor: 'Cem', actor_id: 'user3', action: 'invite_members', members: ['Cem'] },
          { id: 3, type: 'service', date: '2025-01-01T11:00:00', actor: 'Ada', actor_id: 'user1', action: 'remove_members', members: ['Ada'] },
        ],
      }),
    );
    const info = groupInfo(chat);
    expect(info.created).toMatchObject({ actor: 'Ada', value: 'Club' });
    expect(info.members.map(m => [m.name, m.inGroup])).toEqual([
      ['Cem', true],
      ['Ada', false],
    ]);
  });
});
