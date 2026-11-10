import { baseName } from '../files';

export { WholeAccountError } from './common';
export { parseTelegramJson } from './json';
export { isTelegramHtml, parseTelegramHtml } from './html';

export type TelegramExport = { format: 'json'; path: string } | { format: 'html'; paths: string[] };

function depth(path: string): number {
  return path.split(/[\\/]/).length;
}

function folderOf(path: string): string {
  return path.split(/[\\/]/).slice(0, -1).join('/');
}

const PAGE = /^messages(\d*)\.html$/i;

/**
 * Where a Telegram Desktop export keeps its chat: result.json, or the
 * messages.html, messages2.html… pages, in reading order. Pages in several
 * folders mean a whole account was exported; they are all returned so the
 * caller can tell.
 */
export function telegramExports(paths: string[]): TelegramExport[] {
  const out: TelegramExport[] = [];
  const json = paths.filter(p => baseName(p).toLowerCase() === 'result.json').sort((a, b) => depth(a) - depth(b));
  for (const path of json) out.push({ format: 'json', path });
  const folders = new Map<string, { path: string; n: number }[]>();
  for (const path of new Set(paths)) {
    const m = PAGE.exec(baseName(path));
    if (!m) continue;
    const folder = folderOf(path);
    let list = folders.get(folder);
    if (!list) folders.set(folder, (list = []));
    list.push({ path, n: m[1] ? Number(m[1]) : 1 });
  }
  const sorted = [...folders.entries()].sort((a, b) => depth(a[0] + '/x') - depth(b[0] + '/x'));
  for (const [, pages] of sorted) out.push({ format: 'html', paths: pages.sort((a, b) => a.n - b.n).map(p => p.path) });
  return out;
}
