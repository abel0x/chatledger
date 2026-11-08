import type { Chat } from '../core';

export type PrintRange = { kind: 'all' } | { kind: 'dates'; from: number | null; to: number | null } | { kind: 'starred' };

/** Printing renders every chosen message at once; past this many the browser struggles. */
export const PRINT_LIMIT = 20_000;

/** Indices of the messages a print covers, in order, and how many there were before the limit. */
export function printSelection(chat: Chat, range: PrintRange, starred: ReadonlySet<string>): { indices: number[]; total: number } {
  const indices: number[] = [];
  let total = 0;
  chat.messages.forEach((m, i) => {
    if (range.kind === 'starred' && !starred.has(m.id)) return;
    if (range.kind === 'dates') {
      const day = Math.floor(m.time / 86400);
      if ((range.from != null && day < range.from) || (range.to != null && day > range.to)) return;
    }
    total++;
    if (indices.length < PRINT_LIMIT) indices.push(i);
  });
  return { indices, total };
}
