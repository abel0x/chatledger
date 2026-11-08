import type { Chat, Message } from './model';

export class DifferentChatsError extends Error {
  constructor() {
    super('The exports belong to different chats.');
    this.name = 'DifferentChatsError';
  }
}

/** How much a version of a message tells; the fuller one wins when exports disagree. */
const RICHNESS: Record<Message['kind'], number> = {
  file: 6,
  poll: 5,
  location: 5,
  text: 4,
  event: 4,
  viewOnce: 3,
  omitted: 2,
  pending: 1,
  deleted: 1,
  empty: 0,
};

interface Entry {
  m: Message;
  /** Which export it came from; higher is newer. */
  age: number;
  name: string | null;
}

/** Two exports describe the same chat when they share a message or carry the same title. */
export function sameChat(a: Chat, b: Chat): boolean {
  if (a.title && b.title && a.title === b.title) return true;
  const ids = new Set(a.messages.map(m => m.id));
  return b.messages.some(m => ids.has(m.id));
}

/**
 * Joins several exports of one chat into one timeline. WhatsApp only exports
 * the most recent messages, so long chats come in pieces; where pieces
 * overlap, each message appears once, in its fullest form: a photo over
 * "media omitted", the text over "this message was deleted", and the later
 * wording of an edited message.
 */
export function mergeChats(chats: Chat[]): Chat {
  if (chats.length === 0) throw new Error('nothing to merge');
  if (chats.length === 1) return chats[0] as Chat;
  // Oldest export first, so "newer" means a higher index.
  const ordered = [...chats].sort((a, b) => (a.messages.at(-1)?.time ?? 0) - (b.messages.at(-1)?.time ?? 0));
  for (const chat of ordered.slice(1)) if (!sameChat(ordered[0] as Chat, chat)) throw new DifferentChatsError();

  // Messages are matched by minute and sender, then by their order within that minute.
  const groups = new Map<string, { time: number; order: number; slots: Entry[][] }>();
  let order = 0;
  ordered.forEach((chat, age) => {
    const seen = new Map<string, number>();
    for (const m of chat.messages) {
      const name = m.sender == null ? null : (chat.people[m.sender] ?? null);
      const key = `${m.time}|${name ?? ''}`;
      const position = seen.get(key) ?? 0;
      seen.set(key, position + 1);
      let group = groups.get(key);
      if (!group) {
        group = { time: m.time, order: order++, slots: [] };
        groups.set(key, group);
      }
      (group.slots[position] ??= []).push({ m, age, name });
    }
  });

  const people: string[] = [];
  const index = new Map<string, number>();
  const person = (name: string) => {
    let i = index.get(name);
    if (i === undefined) {
      i = people.length;
      people.push(name);
      index.set(name, i);
    }
    return i;
  };

  const used = new Set<string>();
  const messages: Message[] = [];
  const sorted = [...groups.values()].sort((a, b) => a.time - b.time || a.order - b.order);
  for (const group of sorted) {
    for (const versions of group.slots) {
      const best = versions.reduce((a, b) => {
        const ra = RICHNESS[a.m.kind];
        const rb = RICHNESS[b.m.kind];
        if (ra !== rb) return rb > ra ? b : a;
        return b.age > a.age ? b : a;
      });
      let id = best.m.id;
      for (let n = 1; used.has(id); n++) id = `${best.m.id}-${n}`;
      used.add(id);
      messages.push({ ...best.m, id, sender: best.name == null ? null : person(best.name) });
    }
  }

  const newest = ordered.at(-1) as Chat;
  return {
    title: newest.title ?? ordered.find(c => c.title)?.title ?? null,
    platform: newest.platform,
    locale: newest.locale,
    self: newest.self ?? ordered.find(c => c.self)?.self ?? null,
    people,
    messages,
    warnings: ordered.flatMap(c => c.warnings),
  };
}
