import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Prints the CHANGELOG section of a version, after checking it matches package.json. */
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tag = (process.argv[2] ?? '').replace(/^v/, '');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (tag !== version) {
  console.error(`Tag v${tag} does not match package.json version ${version}.`);
  process.exit(1);
}
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');
const start = changelog.search(new RegExp(`^## \\[?${version.replace(/\./g, '\\.')}\\]?`, 'm'));
if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${version}.`);
  process.exit(1);
}
const rest = changelog.slice(start);
const next = rest.slice(1).search(/^## /m);
const section = (next === -1 ? rest : rest.slice(0, next + 1)).split('\n').slice(1).join('\n').trim();
console.log(section);
