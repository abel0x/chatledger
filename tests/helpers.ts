import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

/** Real exports live in coldstorage/ on the developer's machine only. */
export function coldPath(name: string): string | null {
  const path = fileURLToPath(new URL(`../coldstorage/${name}`, import.meta.url));
  return existsSync(path) ? path : null;
}
