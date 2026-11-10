import { extensionOf, mediaHintFor } from '../files';
import type { MediaHint, Message, Span } from '../model';

/** Telegram numbers its messages, so ids stay the same in every export of the chat, JSON or HTML. */
export function messageId(n: number | string): string {
  return `tg${n}`;
}

/** Folders Telegram Desktop sorts attachments into. */
const FOLDERS: Record<string, MediaHint> = {
  photos: 'image',
  video_files: 'video',
  round_video_messages: 'video',
  voice_messages: 'voice',
  stickers: 'sticker',
  contacts: 'contact',
};

export function mediaFromPath(path: string): MediaHint {
  const folder = path.split(/[\\/]/).slice(-2, -1)[0]?.toLowerCase() ?? '';
  return FOLDERS[folder] ?? mediaHintFor(path);
}

/** Sticker formats a browser cannot draw as a picture; their thumbnail is shown instead. */
export function stickerNeedsThumbnail(path: string): boolean {
  const ext = extensionOf(path);
  return ext === 'tgs' || ext === 'webm';
}

/** A link from the export, kept only when it is a web or mail address. */
export function safeHref(href: string): string | undefined {
  const h = href.trim();
  if (/^https?:\/\//i.test(h)) return h;
  if (/^mailto:/i.test(h)) return h;
  if (/^www\./i.test(h)) return `https://${h}`;
  return undefined;
}

/** Telegram writes "(File not included. Change data exporting settings to download.)" where a file was left out. */
export function isLeftOut(path: string): boolean {
  const p = path.trim();
  return !p || (p.startsWith('(') && p.endsWith(')'));
}

/** Seconds of wall-clock time from "2025-11-10T12:34:56" or "10.11.2025 12:34:56". */
export function wallClock(text: string): number | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(text.trim());
  if (iso) {
    const [, y, mo, d, h, mi, s] = iso;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)) / 1000;
  }
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text.trim());
  if (dotted) {
    const [, d, mo, y, h, mi, s] = dotted;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)) / 1000;
  }
  return null;
}

function sameStyle(a: Span, b: Span): boolean {
  return (
    a.b === b.b &&
    a.i === b.i &&
    a.u === b.u &&
    a.s === b.s &&
    a.code === b.code &&
    a.pre === b.pre &&
    a.spoiler === b.spoiler &&
    a.quote === b.quote &&
    a.mention === b.mention &&
    a.href === b.href
  );
}

/** Joins neighbouring runs with the same styles and drops empty ones. */
export function tidySpans(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    const last = out[out.length - 1];
    if (last && sameStyle(last, span)) last.text += span.text;
    else out.push({ ...span });
  }
  return out;
}

/** Text and styled runs, keeping the runs only when some of them carry a style. */
export function withText(spans: Span[]): Pick<Message, 'text' | 'spans'> {
  const tidy = tidySpans(spans);
  const text = tidy.map(s => s.text).join('');
  if (!text.trim()) return {};
  const styled = tidy.some(s => Object.keys(s).length > 1);
  return styled ? { text, spans: tidy } : { text };
}

export class WholeAccountError extends Error {
  constructor() {
    super('This is an export of a whole Telegram account, with many chats in it.');
    this.name = 'WholeAccountError';
  }
}
