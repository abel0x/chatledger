import { linkify } from './linkify';

export type Style = 'b' | 'i' | 's' | 'code';

export type RichNode =
  | { t: 'text'; v: string }
  | { t: 'link'; v: string; href: string }
  | { t: 'mention'; v: string; person: number | null }
  | { t: 'style'; s: Style; c: RichNode[] }
  | { t: 'block'; v: string };

const MARKS: Record<string, Style> = { '*': 'b', _: 'i', '~': 's', '`': 'code' };
const WORD = /[\p{L}\p{N}]/u;
const SPACE = /\s/;
const ISOLATES = /[\u2066-\u2069]/g;

/** A marker only counts next to something that is not part of a word, as in WhatsApp. */
function boundary(ch: string | undefined): boolean {
  return ch === undefined || !WORD.test(ch);
}

function pushText(out: RichNode[], v: string): void {
  if (!v) return;
  const last = out[out.length - 1];
  if (last?.t === 'text') last.v += v;
  else out.push({ t: 'text', v });
}

/** *bold*, _italic_, ~strike~ and `code`, nested where WhatsApp allows it, never across lines. */
export function parseStyles(text: string): RichNode[] {
  const out: RichNode[] = [];
  let i = 0;
  let plain = '';
  while (i < text.length) {
    const c = text[i] as string;
    const style = MARKS[c];
    const next = text[i + 1];
    if (style && boundary(text[i - 1]) && next !== undefined && !SPACE.test(next) && next !== c) {
      let close = -1;
      for (let j = text.indexOf(c, i + 2); j !== -1; j = text.indexOf(c, j + 1)) {
        if (text.slice(i + 1, j).includes('\n')) break;
        if (!SPACE.test(text[j - 1] as string) && boundary(text[j + 1])) {
          close = j;
          break;
        }
      }
      if (close !== -1) {
        pushText(out, plain);
        plain = '';
        const inner = text.slice(i + 1, close);
        out.push({ t: 'style', s: style, c: style === 'code' ? [{ t: 'text', v: inner }] : parseStyles(inner) });
        i = close + 1;
        continue;
      }
    }
    plain += c;
    i++;
  }
  pushText(out, plain);
  return out;
}

/** People sorted longest name first, so "Ada Yılmaz" wins over "Ada". */
function mentionMatcher(people: readonly string[]) {
  const sorted = people.map((name, index) => ({ name: name.toLocaleLowerCase(), index })).sort((a, b) => b.name.length - a.name.length);
  return (rest: string): { length: number; person: number } | null => {
    const lower = rest.toLocaleLowerCase();
    for (const p of sorted) {
      if (p.name && lower.startsWith(p.name) && boundary(rest[p.name.length])) return { length: p.name.length, person: p.index };
    }
    return null;
  };
}

function parseMentions(text: string, match: ReturnType<typeof mentionMatcher>): RichNode[] {
  const out: RichNode[] = [];
  let last = 0;
  for (let at = text.indexOf('@'); at !== -1; at = text.indexOf('@', at + 1)) {
    if (at < last || !boundary(text[at - 1])) continue;
    const rest = text.slice(at + 1);
    let length = 0;
    let person: number | null = null;
    let label = '';
    const isolated = /^\u2068([^\u2069\n]+)\u2069/.exec(rest);
    const phone = /^\+?\d[\d ]{5,}\d/.exec(rest);
    const named = match(rest.replace(ISOLATES, ''));
    if (isolated) {
      length = isolated[0].length;
      label = isolated[1] ?? '';
      person = match(label)?.person ?? null;
    } else if (named) {
      length = named.length;
      person = named.person;
      label = rest.slice(0, length);
    } else if (phone) {
      length = phone[0].length;
      label = phone[0];
    } else continue;
    out.push(...parseStyles(text.slice(last, at)));
    out.push({ t: 'mention', v: `@${label}`, person });
    last = at + 1 + length;
  }
  out.push(...parseStyles(text.slice(last)));
  return out;
}

/**
 * Turns message text into display nodes: ```code blocks```, links,
 * @mentions and inline styles. Nothing here ever becomes raw markup.
 */
export function richText(text: string, people: readonly string[] = []): RichNode[] {
  const match = mentionMatcher(people);
  const out: RichNode[] = [];
  const blocks = /```([\s\S]+?)```/g;
  let last = 0;
  const inline = (segment: string) => {
    for (const part of linkify(segment)) {
      if (part.href) out.push({ t: 'link', v: part.text, href: part.href });
      else for (const node of parseMentions(part.text, match)) node.t === 'text' ? pushText(out, node.v) : out.push(node);
    }
  };
  for (const m of text.matchAll(blocks)) {
    inline(text.slice(last, m.index));
    out.push({ t: 'block', v: m[1] ?? '' });
    last = m.index + m[0].length;
  }
  inline(text.slice(last));
  return out;
}

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** 1 to 3 when the message is nothing but that many emoji, shown large like on a phone; otherwise 0. */
export function emojiOnly(text: string): number {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40 || !EMOJI.test(trimmed) || !segmenter) return 0;
  const parts = Array.from(segmenter.segment(trimmed), s => s.segment).filter(s => s.trim());
  return parts.length <= 3 && parts.every(s => EMOJI.test(s)) ? parts.length : 0;
}

/** Plain text for copying: styling marks stay, as WhatsApp would paste them. */
export function plainText(text: string): string {
  return text.replace(ISOLATES, '');
}
