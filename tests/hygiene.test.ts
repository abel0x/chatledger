import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const INVISIBLE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'fixtures' ? [] : files(path);
    return /\.(ts|svelte|mjs|js|css|html|md)$/.test(entry.name) ? [path] : [];
  });
}

describe('source files', () => {
  it('write invisible direction marks as escapes, never as raw characters', () => {
    // Raw marks hide in diffs and make GitHub warn about hidden text; the export samples in fixtures/ keep theirs on purpose.
    const offenders = ['src', 'tests', 'scripts']
      .flatMap(dir => files(join(root, dir)))
      .concat(join(root, 'index.html'), join(root, 'README.md'), join(root, 'README.tr.md'))
      .filter(path => INVISIBLE.test(readFileSync(path, 'utf8')))
      .map(path => relative(root, path));
    expect(offenders).toEqual([]);
  });
});
