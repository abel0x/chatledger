import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/core';
import { printSelection } from '../src/ui/printing';
import { fixture } from './helpers';

const chat = parseChat(fixture('android-en.txt'));
const day = (d: number) => Date.UTC(2025, 9, d) / 86400000;

describe('printSelection', () => {
  it('covers the whole chat, a date range or the starred messages', () => {
    expect(printSelection(chat, { kind: 'all' }, new Set()).total).toBe(chat.messages.length);
    expect(printSelection(chat, { kind: 'dates', from: day(2), to: day(2) }, new Set()).indices).toHaveLength(3);
    const starred = new Set([chat.messages[4]!.id]);
    expect(printSelection(chat, { kind: 'starred' }, starred).indices).toEqual([4]);
  });
});
