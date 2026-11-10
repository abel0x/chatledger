import type { Message } from '../core';
import { dayOf } from './format';

export type Row =
  | { kind: 'day'; day: number; key: string }
  | { kind: 'event'; day: number; key: string; index: number }
  | { kind: 'message'; day: number; key: string; index: number; first: boolean };

export interface Rows {
  rows: Row[];
  /** Row number of each message, by message index. */
  rowOf: Int32Array;
}

/** Lays the chat out as one flat list: a heading for each day, then its messages. */
export function buildRows(messages: Message[]): Rows {
  const rows: Row[] = [];
  const rowOf = new Int32Array(messages.length);
  let day = Number.NaN;
  let prev: Message | undefined;
  messages.forEach((m, index) => {
    const d = dayOf(m.time);
    if (d !== day) {
      day = d;
      rows.push({ kind: 'day', day: d, key: `d${d}` });
      prev = undefined;
    }
    rowOf[index] = rows.length;
    if (m.kind === 'event') {
      rows.push({ kind: 'event', day: d, key: m.id, index });
      prev = undefined;
    } else {
      const first = !prev || prev.sender !== m.sender;
      rows.push({ kind: 'message', day: d, key: m.id, index, first });
      prev = m;
    }
  });
  return { rows, rowOf };
}

const LINE = 20;
const CHARS_PER_LINE = 48;

/** A first guess at a row's height; the real one replaces it once the row is drawn. */
export function estimateHeight(row: Row, m: Message | undefined, showName: boolean): number {
  if (row.kind === 'day') return 44;
  if (row.kind === 'event' || !m) return 40;
  let h = 36 + (row.first ? 8 : 0) + (showName ? 20 : 0);
  if (m.forwardedFrom) h += 20;
  if (m.replyTo) h += 46;
  if (m.reactions) h += 30;
  if (m.text) {
    let lines = 0;
    for (const line of m.text.split('\n')) lines += Math.max(1, Math.ceil(line.length / CHARS_PER_LINE));
    h += (lines - 1) * LINE;
  }
  switch (m.kind) {
    case 'file':
      if (m.media === 'sticker') h += 150;
      else if (m.media === 'image' || m.media === 'video' || m.media === 'gif') h += 220;
      else if (m.media === 'voice' || m.media === 'audio') h += 40;
      else h += 30;
      break;
    case 'poll':
      h += 40 + (m.poll?.options.length ?? 0) * 34;
      break;
    case 'location':
      h += 20;
      break;
  }
  return h;
}
