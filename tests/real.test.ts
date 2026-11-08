import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/core';
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
