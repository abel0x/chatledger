import type { Chat, Message } from '../core';

/** Characters that NFD does not take apart but people type without their marks. */
const EXTRA: Record<string, string> = {
  ı: 'i',
  ø: 'o',
  đ: 'd',
  ł: 'l',
  ß: 'ss',
  ς: 'σ',
  æ: 'ae',
  œ: 'oe',
};
const MARKS = /[̀-ͯ]/g;

function foldChar(c: string): string {
  const lower = c.normalize('NFD').replace(MARKS, '').toLowerCase();
  return EXTRA[lower] ?? lower;
}

const EXTRA_RE = new RegExp(`[${Object.keys(EXTRA).join('')}]`, 'g');

/**
 * Lower case without accents, so "ogretmen" finds "Öğretmen" and "isik"
 * finds "IŞIK". Works on the whole string at once, which is what keeps
 * indexing a very long chat quick; highlighting folds one character at a
 * time instead, to keep positions traceable.
 */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(EXTRA_RE, c => EXTRA[c] ?? c);
}

/** Words to find, every one of them; "quoted text" stays one phrase. */
export function parseQuery(query: string): string[] {
  const terms: string[] = [];
  const re = /"([^"]*)"?|(\S+)/g;
  for (const m of query.matchAll(re)) {
    const term = fold((m[1] ?? m[2] ?? '').trim());
    if (term) terms.push(term);
  }
  return terms;
}

export type KindFilter = 'all' | 'media' | 'links';

export interface SearchOptions {
  sender: number | null;
  kind: KindFilter;
  /** First and last day to include, as days since 1970; either may be left open. */
  from?: number | null;
  to?: number | null;
  limit?: number;
}

export interface SearchResult {
  /** Message indices, oldest first; with a limit, the newest ones are kept. */
  hits: number[];
  /** Matches found in total, which may be more than were kept. */
  total: number;
}

const LINK = /\b(?:https?:\/\/|www\.)\S/i;

export function searchableText(m: Message): string {
  const parts: string[] = [];
  if (m.text) parts.push(m.text);
  if (m.file) parts.push(m.file);
  if (m.poll) parts.push(m.poll.question, ...m.poll.options.map(o => o.label));
  if (m.event) parts.push(m.event.raw);
  return parts.join('\n');
}

const CHUNK = 4000;

function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 500 });
  else setTimeout(run, 0);
}

export class SearchIndex {
  private readonly folded: string[] = [];

  constructor(private readonly chat: Chat) {}

  private fill(until: number): void {
    const messages = this.chat.messages;
    for (let i = this.folded.length; i < until && i < messages.length; i++) {
      this.folded.push(fold(searchableText(messages[i] as Message)));
    }
  }

  /** Builds the index a slice at a time while the browser is idle, so the first search is instant. */
  prepare(): void {
    const step = () => {
      if (this.folded.length >= this.chat.messages.length) return;
      this.fill(this.folded.length + CHUNK);
      whenIdle(step);
    };
    whenIdle(step);
  }

  private texts(): string[] {
    this.fill(this.chat.messages.length);
    return this.folded;
  }

  search(query: string, options: SearchOptions): SearchResult {
    const terms = parseQuery(query);
    const from = options.from ?? null;
    const to = options.to ?? null;
    const filtered = options.sender != null || options.kind !== 'all' || from != null || to != null;
    if (!terms.length && !filtered) return { hits: [], total: 0 };
    const texts = this.texts();
    const limit = options.limit ?? Infinity;
    const hits: number[] = [];
    let total = 0;
    this.chat.messages.forEach((m, i) => {
      if (options.sender != null && m.sender !== options.sender) return;
      const day = Math.floor(m.time / 86400);
      if ((from != null && day < from) || (to != null && day > to)) return;
      if (options.kind === 'media' && m.kind !== 'file' && m.kind !== 'omitted') return;
      if (options.kind === 'links' && !(m.text && LINK.test(m.text))) return;
      const text = texts[i] ?? '';
      for (const t of terms) if (!text.includes(t)) return;
      total++;
      hits.push(i);
    });
    return { hits: hits.length > limit ? hits.slice(-limit) : hits, total };
  }
}

export interface Mark {
  text: string;
  hit: boolean;
}

/** Splits text into runs, marking the parts that match any term. */
export function highlight(text: string, terms: string[]): Mark[] {
  if (!terms.length || !text) return [{ text, hit: false }];
  const chars = [...text];
  let folded = '';
  const owner: number[] = [];
  chars.forEach((c, i) => {
    const f = foldChar(c);
    folded += f;
    for (let k = 0; k < f.length; k++) owner.push(i);
  });
  const marked = new Uint8Array(chars.length);
  for (const term of terms) {
    for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + term.length)) {
      for (let k = at; k < at + term.length; k++) marked[owner[k] as number] = 1;
    }
  }
  const out: Mark[] = [];
  chars.forEach((c, i) => {
    const hit = marked[i] === 1;
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += c;
    else out.push({ text: c, hit });
  });
  return out;
}

/** A short piece of text around the first match, for result lists. */
export function snippet(text: string, terms: string[], radius = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= radius * 2) return flat;
  const folded = fold(flat);
  let at = -1;
  for (const t of terms) {
    const i = folded.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at <= radius) return flat.slice(0, radius * 2).trimEnd() + '…';
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + radius);
  return (start > 0 ? '…' : '') + flat.slice(start, end).trim() + (end < flat.length ? '…' : '');
}
