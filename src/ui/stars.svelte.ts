import { SvelteSet } from 'svelte/reactivity';
import type { Chat } from '../core';
import { readSetting, writeSetting } from './settings';

/**
 * Identifies a chat across re-exports: message ids come from content, and a
 * later export of the same chat starts with the same first message.
 */
export function chatKey(chat: Chat): string {
  return chat.messages[0]?.id ?? 'empty';
}

export class Stars {
  readonly ids: SvelteSet<string>;

  constructor(private readonly key: string) {
    let list: unknown = [];
    try {
      list = JSON.parse(readSetting(`stars.${key}`) ?? '[]');
    } catch {
      list = [];
    }
    this.ids = new SvelteSet(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  /** Returns whether the message is starred afterwards. */
  toggle(id: string): boolean {
    const now = !this.ids.has(id);
    if (now) this.ids.add(id);
    else this.ids.delete(id);
    this.save();
    return now;
  }

  /** Adds ids and returns how many were new. */
  addAll(ids: Iterable<string>): number {
    let added = 0;
    for (const id of ids) {
      if (this.ids.has(id)) continue;
      this.ids.add(id);
      added++;
    }
    if (added) this.save();
    return added;
  }

  private save(): void {
    writeSetting(`stars.${this.key}`, this.ids.size ? JSON.stringify([...this.ids]) : null);
  }
}

const FORMAT = 'chatledger-stars';

/** A file someone can keep or move to another computer; it repeats the text so it is readable on its own. */
export function exportStars(chat: Chat, ids: ReadonlySet<string>): string {
  const messages = chat.messages
    .filter(m => ids.has(m.id))
    .map(m => ({
      id: m.id,
      time: new Date(m.time * 1000).toISOString().slice(0, 19),
      sender: m.sender == null ? null : chat.people[m.sender],
      text: m.text ?? m.file ?? m.poll?.question ?? m.event?.raw ?? '',
    }));
  return `${JSON.stringify({ format: FORMAT, version: 1, chat: chat.title, messages }, null, 2)}\n`;
}

/** Ids from a stars file that belong to this chat; null when the file is not a stars file. */
export function importStars(text: string, chat: Chat): string[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || (data as { format?: unknown }).format !== FORMAT) return null;
  const list = (data as { messages?: unknown }).messages;
  if (!Array.isArray(list)) return null;
  const known = new Set(chat.messages.map(m => m.id));
  return list
    .map(item => (item && typeof item === 'object' ? (item as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === 'string' && known.has(id));
}
