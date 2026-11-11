import type { Chat, Message } from '../core';
import { parseQuery, SearchIndex } from '../core/search';

/** What one saved chat holds for a search across all of them. */
export interface ChatHits {
  id: string;
  title: string | null;
  people: string[];
  self: string | null;
  /** Matches in this chat in total. */
  total: number;
  /** The newest matches, newest first. */
  hits: Message[];
}

/** How many matches each chat shows before the reader opens it for the rest. */
export const HITS_PER_CHAT = 5;

interface Entry {
  chat: Chat;
  index: SearchIndex;
}

/**
 * Searches every saved chat at once. A chat is read the first time a search
 * needs it and then kept, so the next words typed are found at once.
 */
export class Everywhere {
  private readonly cache = new Map<string, Promise<Entry | null>>();
  private latest = 0;

  constructor(private readonly load: (id: string) => Promise<Chat>) {}

  private entry(id: string): Promise<Entry | null> {
    let entry = this.cache.get(id);
    if (!entry) {
      entry = this.load(id).then(
        chat => ({ chat, index: new SearchIndex(chat) }),
        // A chat that cannot be read is left out rather than stopping the search.
        () => null,
      );
      this.cache.set(id, entry);
    }
    return entry;
  }

  /**
   * Looks through the chats in the order given and reports each one with
   * matches as soon as it is done. A newer search stops an older one, which
   * then reports nothing more and settles with false.
   */
  async search(
    query: string,
    ids: string[],
    onChat: (hits: ChatHits) => void,
    onProgress?: (done: number, total: number) => void,
  ): Promise<boolean> {
    const run = ++this.latest;
    const wanted = new Set(ids);
    for (const id of this.cache.keys()) if (!wanted.has(id)) this.cache.delete(id);
    if (!parseQuery(query).length) return true;
    for (const [done, id] of ids.entries()) {
      const entry = await this.entry(id);
      if (run !== this.latest) return false;
      onProgress?.(done + 1, ids.length);
      if (!entry) continue;
      const { chat, index } = entry;
      const found = index.search(query, { sender: null, kind: 'all', limit: HITS_PER_CHAT });
      if (!found.total) continue;
      onChat({
        id,
        title: chat.title,
        people: chat.people,
        self: chat.self,
        total: found.total,
        hits: found.hits.toReversed().map(i => chat.messages[i] as Message),
      });
    }
    return true;
  }
}
