import { NotAChatError, type ParseOptions } from '../parse';
import type { Chat, ChatEvent, Message, ParseWarning, Party, Poll, Reaction, Span } from '../model';
import { isLeftOut, mediaFromPath, messageId, safeHref, stickerNeedsThumbnail, wallClock, WholeAccountError, withText } from './common';
import { People } from './people';

type Json = Record<string, unknown>;

const MAX_WARNINGS = 500;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v);
  return undefined;
}

function entitySpan(e: unknown): Span | null {
  if (typeof e === 'string') return { text: e };
  if (!isObject(e)) return null;
  const text = str(e.text) ?? '';
  switch (str(e.type)) {
    case 'bold':
      return { text, b: true };
    case 'italic':
      return { text, i: true };
    case 'underline':
      return { text, u: true };
    case 'strikethrough':
      return { text, s: true };
    case 'code':
      return { text, code: true };
    case 'pre':
      return { text, pre: true };
    case 'spoiler':
      return { text, spoiler: true };
    case 'blockquote':
      return { text, quote: true };
    case 'mention':
    case 'mention_name':
      return { text, mention: true };
    case 'link': {
      // Telegram marks web addresses written without https:// too.
      const href = safeHref(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
      return href ? { text, href } : { text };
    }
    case 'text_link': {
      const href = safeHref(str(e.href) ?? '');
      return href ? { text, href } : { text };
    }
    case 'email':
      return { text, href: `mailto:${text}` };
    default:
      return { text };
  }
}

/** Text as Telegram stores it: a string, or a list of strings and styled pieces. */
function spansOf(m: Json, key = 'text'): Span[] {
  const entities = key === 'text' ? m.text_entities : undefined;
  const source = Array.isArray(entities) ? entities : m[key];
  if (typeof source === 'string') return [{ text: source }];
  if (!Array.isArray(source)) return [];
  return source.map(entitySpan).filter((s): s is Span => s !== null);
}

function plain(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(e => (typeof e === 'string' ? e : isObject(e) ? (str(e.text) ?? '') : '')).join('');
  if (isObject(v)) return str(v.text) ?? '';
  return '';
}

function poll(v: unknown): Poll | null {
  if (!isObject(v) || !Array.isArray(v.answers)) return null;
  const options = v.answers.filter(isObject).map(a => ({ label: plain(a.text), votes: num(a.voters) ?? 0 }));
  return options.length ? { question: plain(v.question), options } : null;
}

function reactions(v: unknown): Reaction[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: Reaction[] = [];
  for (const r of v) {
    if (!isObject(r)) continue;
    const count = num(r.count) ?? 0;
    if (count <= 0) continue;
    const type = str(r.type);
    const emoji = type === 'paid' ? '\u2B50' : type === 'emoji' ? (str(r.emoji) ?? null) : null;
    out.push({ emoji, count });
  }
  return out.length ? out : undefined;
}

type Body = Omit<Message, 'id' | 'time' | 'sender'>;

const MEDIA_TYPES: Record<string, Message['media']> = {
  sticker: 'sticker',
  animation: 'gif',
  video_file: 'video',
  video_message: 'video',
  voice_message: 'voice',
  audio_file: 'audio',
};

function body(m: Json): Body {
  const text = withText(spansOf(m));
  const p = poll(m.poll);
  if (p) return { kind: 'poll', poll: p };

  const where = m.location_information;
  if (isObject(where)) {
    const lat = num(where.latitude) ?? Number(where.latitude);
    const lon = num(where.longitude) ?? Number(where.longitude);
    const name = [str(m.place_name), str(m.address)].filter(Boolean).join(', ');
    const link = Number.isFinite(lat) && Number.isFinite(lon) ? `https://maps.google.com/?q=${lat},${lon}` : '';
    return { kind: 'location', text: [name, link].filter(Boolean).join('\n') };
  }

  const contact = m.contact_information;
  if (isObject(contact)) {
    const vcard = str(m.contact_vcard);
    if (vcard && !isLeftOut(vcard)) return { kind: 'file', file: vcard, media: 'contact' };
    const name = [str(contact.first_name), str(contact.last_name)].filter(Boolean).join(' ');
    return { kind: 'text', text: [name, str(contact.phone_number)].filter(Boolean).join('\n') || '\u2014' };
  }

  const photo = str(m.photo);
  const file = str(m.file);
  const path = photo ?? file;
  if (path !== undefined) {
    let media = photo !== undefined ? 'image' : (MEDIA_TYPES[str(m.media_type) ?? ''] ?? mediaFromPath(str(m.file_name) ?? path));
    if (media === 'document' && str(m.mime_type)?.startsWith('image/')) media = 'image';
    let shown = path;
    if (media === 'sticker' && stickerNeedsThumbnail(path)) {
      const thumb = str(m.thumbnail);
      shown = thumb && !isLeftOut(thumb) ? thumb : '';
    }
    if (isLeftOut(shown)) return { kind: 'omitted', media, ...text };
    return { kind: 'file', file: shown, media, ...text };
  }

  if (text.text) return { kind: 'text', ...text };
  return { kind: 'empty' };
}

function names(v: unknown): string[] {
  return Array.isArray(v) ? v.map(n => (typeof n === 'string' && n ? n : 'Deleted Account')) : [];
}

function event(m: Json, actorName: string | undefined, channel: boolean): ChatEvent {
  const action = str(m.action) ?? '';
  // In a channel the channel itself does everything, and Telegram's own HTML names no one.
  const actor: Party | undefined = actorName && !channel ? { name: actorName } : undefined;
  const members = names(m.members);
  const title = str(m.title);
  const base = { actor, raw: [actorName, action.replace(/_/g, ' ')].filter(Boolean).join(': ') };
  const alone = members.length === 1 && members[0] === actorName;
  switch (action) {
    case 'create_group':
      return { ...base, type: 'created', value: title };
    case 'create_channel':
      return { ...base, type: 'channelCreated', value: title };
    case 'edit_group_title':
      return { ...base, type: channel ? 'channelRenamed' : 'renamed', value: title };
    case 'edit_group_photo':
      return { ...base, type: channel ? 'channelIconChanged' : 'iconChanged' };
    case 'delete_group_photo':
      return { ...base, type: 'iconDeleted' };
    case 'invite_members':
      return alone ? { ...base, type: 'entered' } : { ...base, type: 'added', targets: members.map(name => ({ name })) };
    case 'remove_members':
      return alone ? { ...base, type: 'left' } : { ...base, type: 'removed', targets: members.map(name => ({ name })) };
    case 'join_group_by_link':
      return { ...base, type: 'joined' };
    case 'join_group_by_request':
      return { ...base, type: 'entered' };
    case 'pin_message':
      return { ...base, type: 'pinned' };
    case 'phone_call': {
      const reason = str(m.discard_reason);
      if (reason === 'missed' || reason === 'busy') return { ...base, type: 'missedCall' };
      const seconds = num(m.duration_seconds);
      return seconds ? { ...base, type: 'call', value: String(seconds) } : { ...base, type: 'call' };
    }
    case 'group_call':
      return { ...base, type: 'groupCall' };
    case 'migrate_to_supergroup':
    case 'migrate_from_group':
      return { ...base, type: 'migrated' };
    case 'clear_history':
      return { ...base, type: 'historyCleared' };
    case 'contact_sign_up':
      return { ...base, type: 'signedUp' };
    case 'set_messages_ttl': {
      const period = num(m.period) ?? num(m.period_seconds) ?? 0;
      return period > 0 ? { ...base, type: 'disappearingOn', value: String(period) } : { ...base, type: 'disappearingOff' };
    }
    case 'paid_messages_price_change': {
      const stars = num(m.price_stars);
      return stars === undefined ? { ...base, type: 'unknown' } : { ...base, type: 'messagePriceChanged', value: String(stars) };
    }
    case 'topic_created':
      return { ...base, type: 'topicCreated', value: title };
    default:
      return { ...base, type: 'unknown' };
  }
}

/** The one chat in the file: a chat export, or an account export that holds a single chat. */
function pickChat(data: unknown): Json {
  if (!isObject(data)) throw new NotAChatError();
  if (Array.isArray(data.messages)) return data;
  const chats = isObject(data.chats) && Array.isArray(data.chats.list) ? data.chats.list.filter(isObject) : null;
  if (!chats) throw new NotAChatError();
  const withMessages = chats.filter(c => Array.isArray(c.messages) && c.messages.length > 0);
  if (withMessages.length === 1) return withMessages[0] as Json;
  throw new WholeAccountError();
}

/** Reads the result.json that Telegram Desktop writes for "Export chat history" in JSON. */
export function parseTelegramJson(input: string, options: ParseOptions = {}): Chat {
  let data: unknown;
  try {
    data = JSON.parse(input.replace(/^\uFEFF/, ''));
  } catch {
    throw new NotAChatError();
  }
  const chat = pickChat(data);
  const list = chat.messages as unknown[];
  const channel = /channel/.test(str(chat.type) ?? '');
  const people = new People();
  const warnings: ParseWarning[] = [];
  const messages: Message[] = [];

  const step = Math.max(2000, Math.floor(list.length / 50));
  list.forEach((raw, n) => {
    if (options.onProgress && n % step === 0) options.onProgress(n, list.length);
    if (!isObject(raw)) return;
    const id = num(raw.id);
    const time = wallClock(str(raw.date) ?? '') ?? num(raw.date_unixtime);
    if (id === undefined || time === undefined) {
      if (warnings.length < MAX_WARNINGS) warnings.push({ line: n + 1, reason: 'unparsedLine', text: JSON.stringify(raw).slice(0, 200) });
      return;
    }
    if (raw.type === 'service') {
      const actor = raw.actor === null ? 'Deleted Account' : str(raw.actor);
      const ev = event(raw, actor && people.name(actor, str(raw.actor_id)), channel);
      if (ev.type === 'unknown' && warnings.length < MAX_WARNINGS) warnings.push({ line: n + 1, reason: 'unknownEvent', text: ev.raw });
      messages.push({ id: messageId(id), time, sender: null, kind: 'event', event: ev });
      return;
    }
    const from = str(raw.from) || 'Deleted Account';
    const msg: Message = { id: messageId(id), time, sender: people.index(from, str(raw.from_id)), ...body(raw) };
    if (raw.edited !== undefined || raw.edited_unixtime !== undefined) msg.edited = true;
    const forwarded = str(raw.forwarded_from) ?? str(raw.saved_from);
    if (forwarded) msg.forwardedFrom = forwarded;
    const reply = num(raw.reply_to_message_id);
    if (reply !== undefined && raw.reply_to_peer_id === undefined) msg.replyTo = messageId(reply);
    const r = reactions(raw.reactions);
    if (r) msg.reactions = r;
    messages.push(msg);
  });

  const title = str(chat.name) ?? null;
  return {
    title,
    platform: 'telegram',
    locale: '',
    self: people.self(str(chat.type), title),
    people: people.list,
    messages,
    warnings,
  };
}
