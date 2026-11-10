import { baseName, mediaHintFor } from './files';
import { BIDI, detectDateOrder, detectPlatform, matchHeader, toSeconds, type RawHeader } from './header';
import { LIMITS } from './limits';
import { LOCALES, type LocalePack } from './locales';
import type { Chat, ChatEvent, Message, ParseWarning, Party, Poll, WhatsAppPlatform as Platform } from './model';

export interface ParseOptions {
  /**
   * Name of the exported file; WhatsApp puts the chat title in it. When a
   * list is given, the first name that carries a title wins.
   */
  fileName?: string | string[];
  /** Force a locale pack instead of detecting it. */
  locale?: string;
  /** Called now and then with how many messages have been read out of how many. */
  onProgress?: (done: number, total: number) => void;
}

export class NotAChatError extends Error {
  constructor() {
    super('The file does not look like a WhatsApp chat export.');
    this.name = 'NotAChatError';
  }
}

interface Entry {
  line: number;
  header: RawHeader;
  body: string;
}

type Body = Omit<Message, 'id' | 'time' | 'sender'>;

const MAX_WARNINGS = 500;
const ISOLATES = /[\u2068\u2069]/g;
const SAMPLE = 3000;

/** Small, fast, well-spread string hash; ids only need to be stable, not secret. */
function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function splitSender(body: string): [string, string] | null {
  const at = body.indexOf(': ');
  return at > 0 ? [body.slice(0, at), body.slice(at + 2)] : null;
}

function stripBidi(s: string): string {
  return s.replace(BIDI, '');
}

function matchEvent(text: string, pack: LocalePack): ChatEvent | null {
  if (text.length > LIMITS.eventLineChars) return null;
  for (const r of pack.events) {
    const m = r.re.exec(text);
    if (!m) continue;
    const g = m.groups ?? {};
    const party = (raw: string): Party => {
      const name = raw.replace(ISOLATES, '').trim();
      if (pack.self.includes(name)) return { self: true };
      return { name: pack.cleanName ? pack.cleanName(name) : name };
    };
    const event: ChatEvent = { type: r.type, raw: text };
    if (g.actor) event.actor = party(g.actor);
    else if (r.selfActor) event.actor = { self: true };
    if (g.targets) {
      event.targets = g.targets
        .split(pack.listSeparator)
        .map(s => s.trim())
        .filter(Boolean)
        .map(party);
    }
    if (g.value != null) event.value = g.value;
    if (g.previous != null) event.previous = g.previous;
    return event;
  }
  return null;
}

function parsePoll(content: string, pack: LocalePack): Poll | null {
  if (!content.startsWith(pack.pollHeader + '\n')) return null;
  const question: string[] = [];
  const options: Poll['options'] = [];
  for (const line of content.split('\n').slice(1)) {
    const m = pack.pollOption.exec(line.trim());
    if (m) options.push({ label: m[1] ?? '', votes: Number(m[2]) });
    else if (!options.length && line.trim()) question.push(line.trim());
  }
  return options.length ? { question: question.join('\n'), options } : null;
}

function findAttachment(content: string, pack: LocalePack): { file: string; caption: string } | null {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    const m = pack.attachedAndroid.exec(line) ?? pack.attachedIos.exec(line);
    if (!m) continue;
    const caption = lines.filter((_, k) => k !== i).join('\n').trim();
    return { file: (m[1] ?? '').trim(), caption };
  }
  return null;
}

/** Reads what a person sent: text, a file, a deleted placeholder and so on. */
function classify(raw: string, pack: LocalePack): Body & { bySelf?: true } {
  let content = stripBidi(raw);
  let edited = false;
  for (const mark of pack.edited) {
    if (content.trimEnd().endsWith(mark)) {
      content = content.trimEnd().slice(0, -mark.length).trimEnd();
      edited = true;
      break;
    }
  }
  const out = (b: Body & { bySelf?: true }) => (edited ? { ...b, edited: true as const } : b);
  const trimmed = content.trim();
  const bare = trimmed.replace(/\.$/, '');

  if (!trimmed) return out({ kind: 'empty' });
  if (pack.deletedBySelf.includes(bare)) return out({ kind: 'deleted', bySelf: true });
  if (pack.deleted.includes(bare)) return out({ kind: 'deleted' });
  if (pack.mediaOmitted.includes(trimmed)) return out({ kind: 'omitted', media: 'unknown' });
  for (const [re, media] of pack.omittedByKind) {
    if (re.test(trimmed)) return out({ kind: 'omitted', media });
  }
  if (pack.viewOnce.test(trimmed)) return out({ kind: 'viewOnce' });
  if (pack.pending.test(trimmed)) return out({ kind: 'pending' });
  const poll = parsePoll(trimmed, pack);
  if (poll) return out({ kind: 'poll', poll });
  const att = findAttachment(content, pack);
  if (att) {
    const b: Body = { kind: 'file', file: att.file, media: mediaHintFor(att.file) };
    if (att.caption && att.caption !== att.file) b.text = att.caption;
    return out(b);
  }
  const loc = pack.location.exec(trimmed);
  if (loc) return out({ kind: 'location', text: (loc[1] ?? '').trim() });
  return out({ kind: 'text', text: content.replace(/\s+$/, '') });
}

function readEntries(lines: string[], platform: Platform, warnings: ParseWarning[]): Entry[] {
  const entries: Entry[] = [];
  let last: Entry | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const header = matchHeader(line, platform);
    if (header) {
      last = { line: i + 1, header, body: header.body };
      entries.push(last);
    } else if (last) {
      last.body += '\n' + line;
    } else if (line.trim() && warnings.length < MAX_WARNINGS) {
      warnings.push({ line: i + 1, reason: 'unparsedLine', text: line });
    }
  }
  for (const e of entries) e.body = e.body.replace(/\n+$/, '');
  return entries;
}

function pickLocale(entries: Entry[], forced?: string): LocalePack {
  const fallback = LOCALES[0] as LocalePack;
  if (forced) return LOCALES.find(p => p.id === forced) ?? fallback;
  let best = fallback;
  let bestScore = -1;
  for (const pack of LOCALES) {
    let score = 0;
    for (let i = 0; i < entries.length && i < SAMPLE; i++) {
      const body = stripBidi((entries[i] as Entry).body);
      const split = splitSender(body);
      if (matchEvent(body, pack) || (split && matchEvent(split[1], pack))) score += 2;
      else if (split && classify(split[1], pack).kind !== 'text') score += 1;
    }
    if (score > bestScore) {
      best = pack;
      bestScore = score;
    }
  }
  return best;
}

/** The chat title WhatsApp writes into the export's file name, if there is one. */
export function titleFromFileName(path: string): string | null {
  const name = baseName(path).normalize('NFC');
  for (const pack of LOCALES) {
    for (const re of pack.titleFromFileName) {
      const m = re.exec(name);
      if (m?.[1]) return m[1].trim();
    }
  }
  return null;
}

function titleFrom(fileName: string | string[] | undefined, messages: Message[]): string | null {
  for (const name of typeof fileName === 'string' ? [fileName] : (fileName ?? [])) {
    const title = titleFromFileName(name);
    if (title) return title;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const ev = messages[i]?.event;
    if ((ev?.type === 'renamed' || ev?.type === 'created') && ev.value) return ev.value;
  }
  return null;
}

export function parseChat(input: string, options: ParseOptions = {}): Chat {
  const text = input.replace(/^\uFEFF/, '').normalize('NFC');
  const lines = text.split(/\r?\n/).map(l => (l.endsWith('\r') ? l.slice(0, -1) : l));
  const platform = detectPlatform(lines);
  if (!platform) throw new NotAChatError();

  const warnings: ParseWarning[] = [];
  const entries = readEntries(lines, platform, warnings);
  const order = detectDateOrder(entries.map(e => e.header));
  const pack = pickLocale(entries, options.locale);

  const people: string[] = [];
  const peopleIndex = new Map<string, number>();
  const person = (name: string): number => {
    let i = peopleIndex.get(name);
    if (i === undefined) {
      i = people.length;
      people.push(name);
      peopleIndex.set(name, i);
    }
    return i;
  };
  const selfVotes = new Map<string, number>();
  const seen = new Map<string, number>();
  const messages: Message[] = [];

  const step = Math.max(2000, Math.floor(entries.length / 50));
  for (const [n, entry] of entries.entries()) {
    if (options.onProgress && n % step === 0) options.onProgress(n, entries.length);
    const time = toSeconds(entry.header, order);
    const key = hash(`${time}|${entry.body}`);
    const dup = seen.get(key) ?? 0;
    seen.set(key, dup + 1);
    const id = dup ? `${key}-${dup}` : key;

    const asEvent = (event: ChatEvent): void => {
      if (event.type === 'unknown' && warnings.length < MAX_WARNINGS) {
        warnings.push({ line: entry.line, reason: 'unknownEvent', text: event.raw });
      }
      messages.push({ id, time, sender: null, kind: 'event', event });
    };

    const body = entry.body;
    const split = splitSender(body);

    if (platform === 'android') {
      const event = matchEvent(stripBidi(body), pack);
      if (event) {
        asEvent(event);
        continue;
      }
    }
    if (!split) {
      const clean = stripBidi(body);
      asEvent(matchEvent(clean, pack) ?? { type: 'unknown', raw: clean });
      continue;
    }

    const [sender, content] = split;
    const marked = /^\s*\u200E/.test(content);
    const msg = classify(content, pack);
    if (platform === 'ios' && marked && msg.kind === 'text') {
      const clean = stripBidi(content).trim();
      asEvent(matchEvent(clean, pack) ?? { type: 'unknown', actor: { name: sender }, raw: clean });
      continue;
    }

    const senderName = stripBidi(sender).trim();
    if (msg.bySelf) selfVotes.set(senderName, (selfVotes.get(senderName) ?? 0) + 1);
    const { bySelf: _, ...rest } = msg;
    messages.push({ id, time, sender: person(senderName), ...rest });
  }

  let self: string | null = null;
  let votes = 0;
  for (const [name, n] of selfVotes) {
    if (n > votes) {
      self = name;
      votes = n;
    }
  }

  return {
    title: titleFrom(options.fileName, messages),
    platform,
    locale: pack.id,
    self,
    people,
    messages,
    warnings,
  };
}
