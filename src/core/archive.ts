import { baseName, extensionOf } from './files';
import { titleFromFileName } from './parse';

/** Junk that archivers on macOS and Windows leave behind. */
function isJunk(path: string): boolean {
  const name = baseName(path);
  return /(^|[\\/])__MACOSX[\\/]/.test(path) || name.startsWith('._') || name === '.DS_Store';
}

function rank(path: string): number {
  const name = baseName(path).normalize('NFC');
  if (name.toLowerCase() === '_chat.txt') return 0;
  if (titleFromFileName(name)) return 1;
  return 2;
}

/**
 * Text files that may hold the chat, most likely first. iOS calls it
 * _chat.txt, Android names it after the chat in the phone's language.
 */
export function chatCandidates(paths: string[]): string[] {
  return paths
    .filter(p => extensionOf(p) === 'txt' && !isJunk(p))
    .map((path, i) => ({ path, i, rank: rank(path), depth: path.split(/[\\/]/).length }))
    .sort((a, b) => a.rank - b.rank || a.depth - b.depth || a.i - b.i)
    .map(c => c.path);
}

export function isZipName(name: string): boolean {
  return extensionOf(name) === 'zip';
}
