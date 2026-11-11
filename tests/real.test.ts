import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChat, parseTelegramHtml, parseTelegramJson, type Chat, type Message } from '../src/core';
import { coldPath } from './helpers';

/**
 * Runs against whatever real exports are kept in coldstorage/ on this machine;
 * skipped everywhere else. Nothing about their content is written down here.
 */
const dir = coldPath('');
const exports = dir ? readdirSync(dir).filter(f => f.toLowerCase().endsWith('.txt')) : [];

describe.skipIf(!exports.length)('real exports', () => {
  describe.each(exports)('export %#', file => {
    const raw = readFileSync(join(dir ?? '', file), 'utf8');
    const chat = parseChat(raw, { fileName: file });

    it('reads every message without surprises', () => {
      expect(chat.title).not.toBeNull();
      expect(chat.self).not.toBeNull();
      expect(chat.warnings).toEqual([]);
      expect(chat.messages.filter(m => m.event?.type === 'unknown')).toEqual([]);
    });

    it('agrees with a plain header count', () => {
      const header = chat.platform === 'ios' ? /^\u200E?\[\d/ : /^\u200E?\d{1,4}[./-]\d{1,2}[./-]\d{1,4},? \d/;
      expect(chat.messages).toHaveLength(raw.split('\n').filter(l => header.test(l)).length);
    });
  });
});

/** Telegram Desktop export folders kept in coldstorage/, read in both formats when both are there. */
const telegram = dir
  ? readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && existsSync(join(dir, e.name, 'result.json')))
      .map(e => join(dir, e.name))
  : [];

describe.skipIf(!telegram.length)('real Telegram exports', () => {
  describe.each(telegram.map((path, n) => [n, path] as const))('export %i', (_, path) => {
    const fromJson = parseTelegramJson(readFileSync(join(path, 'result.json'), 'utf8'));
    const pages = readdirSync(path)
      .filter(f => /^messages\d*\.html$/.test(f))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
    const fromHtml = pages.length ? parseTelegramHtml(pages.map(p => readFileSync(join(path, p), 'utf8'))) : null;

    it('reads every message without surprises', () => {
      for (const chat of [fromJson, fromHtml]) {
        if (!chat) continue;
        expect(chat.title).not.toBeNull();
        expect(chat.warnings).toEqual([]);
        expect(chat.messages.filter(m => m.event?.type === 'unknown')).toEqual([]);
      }
    });

    it.skipIf(!fromHtml)('reads the same messages from the HTML pages', () => {
      const html = new Map((fromHtml?.messages ?? []).map(m => [m.id, m]));
      expect([...html.keys()]).toEqual(fromJson.messages.map(m => m.id));
      for (const m of fromJson.messages) {
        const o = html.get(m.id) as Message;
        const who = (chat: Chat, i: number | null) => (i === null ? null : chat.people[i]);
        // HTML pages give no time for service messages, and never say a message was edited.
        expect([o.kind, o.media, o.file, o.text, o.spans, o.reactions, o.replyTo, o.forwardedFrom, o.event?.type, o.event?.value, who(fromHtml as Chat, o.sender)], m.id).toEqual([
          m.kind,
          m.media,
          m.file,
          m.text,
          m.spans,
          m.reactions,
          m.replyTo,
          m.forwardedFrom,
          m.event?.type,
          m.event?.value,
          who(fromJson, m.sender),
        ]);
        if (m.kind !== 'event') expect(o.time, m.id).toBe(m.time);
      }
    });
  });
});
