import { NotAChatError, type ParseOptions } from '../parse';
import type { Chat, ChatEvent, MediaHint, Message, ParseWarning, Party, Reaction, Span } from '../model';
import { mediaFromPath, messageId, safeHref, stickerNeedsThumbnail, wallClock, withText } from './common';
import { byClass, childByClass, find, findAll, hasClass, isEl, labelOf, parseHtml, textOf, type El, type Node } from './dom';
import { People } from './people';

const MAX_WARNINGS = 500;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Day headings read "1 March 2025". */
function dayHeading(text: string): number | null {
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(text.trim());
  const month = m ? MONTHS.indexOf((m[2] ?? '').toLowerCase()) : -1;
  if (!m || month < 0) return null;
  return Date.UTC(Number(m[3]), month, Number(m[1])) / 1000;
}

type Style = Omit<Span, 'text'>;

function spansOf(el: El): Span[] {
  const out: Span[] = [];
  const walk = (n: Node, style: Style) => {
    if (!isEl(n)) {
      const text = textOf(n);
      if (text) out.push({ text, ...style });
      return;
    }
    if (n.tag === 'br') {
      out.push({ text: '\n', ...style });
      return;
    }
    const next: Style = { ...style };
    switch (n.tag) {
      case 'strong':
      case 'b':
        next.b = true;
        break;
      case 'em':
      case 'i':
        next.i = true;
        break;
      case 'u':
        next.u = true;
        break;
      case 's':
      case 'strike':
      case 'del':
        next.s = true;
        break;
      case 'code':
        next.code = true;
        break;
      case 'pre':
        next.pre = true;
        break;
      case 'blockquote':
        next.quote = true;
        break;
      case 'a': {
        const href = safeHref(n.attrs.get('href') ?? '');
        const label = labelOf(n);
        // Usernames link to t.me; kept as a mention, the way the JSON export marks them.
        if (label.startsWith('@') && (!href || href.toLowerCase() === `https://t.me/${label.slice(1).toLowerCase()}`)) next.mention = true;
        else if (href) next.href = href;
        break;
      }
    }
    if (hasClass(n, 'spoiler')) next.spoiler = true;
    for (const c of n.children) walk(c, next);
  };
  for (const c of el.children) walk(c, {});
  const first = out[0];
  if (first) first.text = first.text.replace(/^\s+/, '');
  const last = out[out.length - 1];
  if (last) last.text = last.text.replace(/\s+$/, '');
  return out;
}

/** The local file a media block links to, if the export has it. */
function localLink(el: El): string | null {
  const a = find(el, e => e.tag === 'a' && !!e.attrs.get('href'));
  const href = a?.attrs.get('href') ?? '';
  if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  return href;
}

const WRAPS: [string, MediaHint][] = [
  ['photo_wrap', 'image'],
  ['media_photo', 'image'],
  ['animated_wrap', 'gif'],
  ['media_animated', 'gif'],
  ['video_file_wrap', 'video'],
  ['media_video', 'video'],
  ['media_round_video', 'video'],
  ['sticker_wrap', 'sticker'],
  ['media_sticker', 'sticker'],
  ['media_voice_message', 'voice'],
  ['media_audio_file', 'audio'],
  ['media_contact', 'contact'],
  ['media_file', 'document'],
];

function hintOf(el: El): MediaHint | null {
  for (const [cls, hint] of WRAPS) if (hasClass(el, cls) || byClass(el, cls)) return hint;
  return null;
}

type Body = Omit<Message, 'id' | 'time' | 'sender'>;

function media(wrap: El): Body | null {
  const poll = byClass(wrap, 'media_poll');
  if (poll) {
    const options = findAll(poll, e => hasClass(e, 'answer')).map(a => {
      const details = childByClass(a, 'details');
      const label = labelOf({ ...a, children: a.children.filter(c => c !== details) }).replace(/^-\s*/, '');
      return { label, votes: Number(/\d+/.exec(details ? labelOf(details) : '')?.[0] ?? 0) };
    });
    const question = byClass(poll, 'question');
    return { kind: 'poll', poll: { question: question ? labelOf(question) : '', options } };
  }
  const location = byClass(wrap, 'media_location') ?? (hasClass(wrap, 'media_location') ? wrap : undefined);
  if (location) {
    const a = find(location, e => e.tag === 'a') ?? (location.tag === 'a' ? location : undefined);
    const href = safeHref(a?.attrs.get('href') ?? location.attrs.get('href') ?? '');
    return { kind: 'location', text: href ?? '' };
  }
  const link = localLink(wrap);
  const hint = hintOf(wrap) ?? (link ? mediaFromPath(link) : 'unknown');
  if (hint === 'contact' && !link) {
    const title = byClass(wrap, 'title');
    const status = byClass(wrap, 'status');
    return { kind: 'text', text: [title && labelOf(title), status && labelOf(status)].filter(Boolean).join('\n') || '\u2014' };
  }
  if (!link) return { kind: 'omitted', media: hint };
  let file = link;
  if (hint === 'sticker' && stickerNeedsThumbnail(link)) {
    const img = find(wrap, e => e.tag === 'img');
    const src = img?.attrs.get('src') ?? '';
    if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src)) return { kind: 'omitted', media: hint };
    file = src;
  }
  const media = hint === 'document' ? mediaFromPath(link) : hint;
  return { kind: 'file', file: decodeURIComponentSafe(file), media };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function reactionsOf(body: El): Reaction[] | undefined {
  const box = byClass(body, 'reactions');
  if (!box) return undefined;
  const out: Reaction[] = [];
  for (const r of findAll(box, e => hasClass(e, 'reaction'))) {
    const emoji = byClass(r, 'emoji');
    const count = byClass(r, 'count');
    const pics = findAll(r, e => hasClass(e, 'userpic')).length;
    const n = count ? Number(/\d+/.exec(labelOf(count))?.[0] ?? 0) : Math.max(1, pics);
    if (n > 0) out.push({ emoji: (emoji && labelOf(emoji)) || null, count: n });
  }
  return out.length ? out : undefined;
}

/** Name in a from_name block, without the date or "via @bot" Telegram puts next to it. */
function nameOf(el: El): string {
  const own = { ...el, children: el.children.filter(c => !(isEl(c) && (hasClass(c, 'date') || hasClass(c, 'details')))) };
  return labelOf(own).replace(/\s+via @\S+$/, '');
}

const QUOTED = '[\u00AB"\u201C](.+)[\u00BB"\u201D]';
const EVENTS: [RegExp, (g: string[], party: (s: string) => Party) => Omit<ChatEvent, 'raw'>][] = [
  [new RegExp(`^(.+?) created group ${QUOTED}$`), ([a, v], p) => ({ type: 'created', actor: p(a as string), value: v })],
  [new RegExp(`^Channel ${QUOTED} created$`), ([v]) => ({ type: 'channelCreated', value: v })],
  [/^Channel photo changed$/, () => ({ type: 'channelIconChanged' })],
  [new RegExp(`^Channel title changed to ${QUOTED}$`), ([v]) => ({ type: 'channelRenamed', value: v })],
  [/^Price per (?:direct )?message changed to (\d+) Telegram Stars?\.?$/, ([v]) => ({ type: 'messagePriceChanged', value: v })],
  [new RegExp(`^(.+?) changed group title to ${QUOTED}$`), ([a, v], p) => ({ type: 'renamed', actor: p(a as string), value: v })],
  [/^(.+?) changed group photo$/, ([a], p) => ({ type: 'iconChanged', actor: p(a as string) })],
  [/^(.+?) deleted group photo$/, ([a], p) => ({ type: 'iconDeleted', actor: p(a as string) })],
  [/^(.+?) joined group by link(?: from .+)?$/, ([a], p) => ({ type: 'joined', actor: p(a as string) })],
  [/^(.+?) joined group by request$/, ([a], p) => ({ type: 'entered', actor: p(a as string) })],
  [/^(.+?) pinned .+$/, ([a], p) => ({ type: 'pinned', actor: p(a as string) })],
  [/^(.+?) converted .+ to a supergroup$/, ([a], p) => ({ type: 'migrated', actor: p(a as string) })],
  [/^History cleared$/, () => ({ type: 'historyCleared' })],
  [/^(.+?) joined Telegram$/, ([a], p) => ({ type: 'signedUp', actor: p(a as string) })],
  [new RegExp(`^(.+?) created topic ${QUOTED}$`), ([a, v], p) => ({ type: 'topicCreated', actor: p(a as string), value: v })],
  [
    /^(.+?) invited (.+)$/,
    ([a, t], p) => {
      const targets = (t as string).split(/, | and /).map(p);
      const actor = p(a as string);
      const alone = targets.length === 1 && 'name' in actor && 'name' in (targets[0] as Party) && (targets[0] as { name: string }).name === actor.name;
      return alone ? { type: 'entered', actor } : { type: 'added', actor, targets };
    },
  ],
  [
    /^(.+?) removed (.+)$/,
    ([a, t], p) => {
      const targets = (t as string).split(/, | and /).map(p);
      const actor = p(a as string);
      const alone = targets.length === 1 && 'name' in actor && (targets[0] as { name?: string }).name === actor.name;
      return alone ? { type: 'left', actor } : { type: 'removed', actor, targets };
    },
  ],
  [/^(.+?) left the group$/, ([a], p) => ({ type: 'left', actor: p(a as string) })],
];

function serviceEvent(text: string, people: People): ChatEvent {
  const party = (s: string): Party => ({ name: people.name(s.trim()) });
  if (text.length <= 2000) {
    for (const [re, make] of EVENTS) {
      const m = re.exec(text);
      if (m) return { ...make(m.slice(1), party), raw: text };
    }
  }
  return { type: 'unknown', raw: text };
}

function callEvent(call: El, actor: string): ChatEvent {
  const title = byClass(call, 'title');
  const status = byClass(call, 'status');
  const raw = [title && labelOf(title), status && labelOf(status)].filter(Boolean).join(' \u00B7 ');
  const party: Party = { name: actor };
  if (hasClass(call, 'missed') || /missed|declined|cancel/i.test(raw)) return { type: 'missedCall', actor: party, raw };
  const status_ = status ? labelOf(status) : '';
  const h = Number(/(\d+)\s*h/.exec(status_)?.[1] ?? 0);
  const min = Number(/(\d+)\s*min/.exec(status_)?.[1] ?? 0);
  const sec = Number(/(\d+)\s*sec/.exec(status_)?.[1] ?? 0);
  const seconds = h * 3600 + min * 60 + sec;
  return seconds ? { type: 'call', actor: party, value: String(seconds), raw } : { type: 'call', actor: party, raw };
}

/** Whether a page looks like one Telegram Desktop wrote. */
export function isTelegramHtml(html: string): boolean {
  const head = html.slice(0, 4000);
  return /class="page_wrap"|class="page_header"/.test(head) || /<div class="history">/.test(html.slice(0, 20000));
}

/**
 * Reads the messages.html, messages2.html… pages Telegram Desktop writes for
 * "Export chat history" in HTML, given in that order.
 */
export function parseTelegramHtml(pages: string[], options: ParseOptions = {}): Chat {
  if (!pages.length || !pages.some(isTelegramHtml)) throw new NotAChatError();
  const people = new People();
  const warnings: ParseWarning[] = [];
  const messages: Message[] = [];
  let title: string | null = null;
  let dayStart: number | null = null;
  let lastTime: number | null = null;
  let lastSender: number | null = null;
  let line = 0;

  pages.forEach((page, p) => {
    options.onProgress?.(p, pages.length);
    const root = parseHtml(page);
    if (title === null) {
      const header = byClass(root, 'page_header');
      const name = header && find(header, e => hasClass(e, 'text') && hasClass(e, 'bold'));
      if (name) title = labelOf(name) || null;
    }
    for (const el of findAll(root, e => hasClass(e, 'message') && /^message-?\d+$/.test(e.attrs.get('id') ?? ''))) {
      line++;
      const n = Number((el.attrs.get('id') ?? '').slice('message'.length));
      const body = childByClass(el, 'body');
      if (!body) continue;

      if (hasClass(el, 'service')) {
        const text = labelOf(body);
        const day = dayHeading(text);
        if (n < 0 || day !== null) {
          if (day !== null) dayStart = day;
          continue;
        }
        const time = lastTime !== null && (dayStart === null || lastTime >= dayStart) ? lastTime : dayStart;
        if (time === null) {
          if (warnings.length < MAX_WARNINGS) warnings.push({ line, reason: 'unparsedLine', text });
          continue;
        }
        const event = serviceEvent(text, people);
        if (event.type === 'unknown' && warnings.length < MAX_WARNINGS) warnings.push({ line, reason: 'unknownEvent', text });
        messages.push({ id: messageId(n), time, sender: null, kind: 'event', event });
        continue;
      }

      const date = childByClass(body, 'date');
      const stamp = date?.attrs.get('title') ?? '';
      const time = wallClock(stamp);
      if (time === null) {
        if (warnings.length < MAX_WARNINGS) warnings.push({ line, reason: 'unparsedLine', text: labelOf(body).slice(0, 200) });
        continue;
      }
      lastTime = time;
      const from = childByClass(body, 'from_name');
      const sender = from ? people.index(nameOf(from) || 'Deleted Account') : hasClass(el, 'joined') ? lastSender : null;
      if (sender === null) {
        if (warnings.length < MAX_WARNINGS) warnings.push({ line, reason: 'unparsedLine', text: labelOf(body).slice(0, 200) });
        continue;
      }
      lastSender = sender;

      const forwarded = childByClass(body, 'forwarded');
      const content = forwarded ?? body;
      const wrap = childByClass(content, 'media_wrap');
      const call = wrap && (byClass(wrap, 'media_call') ?? (hasClass(wrap, 'media_call') ? wrap : undefined));
      if (call) {
        messages.push({ id: messageId(n), time, sender: null, kind: 'event', event: callEvent(call, people.list[sender] as string) });
        continue;
      }
      const text = childByClass(content, 'text');
      const spans = text ? withText(spansOf(text)) : {};
      const fromMedia = wrap ? media(wrap) : null;
      let msg: Message;
      if (fromMedia) {
        msg = { id: messageId(n), time, sender, ...fromMedia };
        if (spans.text && fromMedia.kind !== 'text' && fromMedia.kind !== 'location') Object.assign(msg, spans);
      } else if (spans.text) msg = { id: messageId(n), time, sender, kind: 'text', ...spans };
      else msg = { id: messageId(n), time, sender, kind: 'empty' };

      if (forwarded) {
        const name = childByClass(forwarded, 'from_name');
        if (name && nameOf(name)) msg.forwardedFrom = nameOf(name);
      }
      const reply = childByClass(body, 'reply_to');
      const target = reply && find(reply, e => e.tag === 'a');
      const go = /^#go_to_message(\d+)$/.exec(target?.attrs.get('href') ?? '');
      if (go) msg.replyTo = messageId(go[1] as string);
      const reactions = reactionsOf(body);
      if (reactions) msg.reactions = reactions;
      messages.push(msg);
    }
  });
  options.onProgress?.(pages.length, pages.length);

  return {
    title,
    platform: 'telegram',
    locale: '',
    self: people.self(undefined, title),
    people: people.list,
    messages,
    warnings,
  };
}
