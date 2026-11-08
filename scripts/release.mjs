import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { build } from 'vite';

/**
 * Builds the app and packs what someone needs to run it, without npm or the
 * source: the built files, the small server, the launchers and the docs.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const name = `chatledger-${version}`;

configure({ useWebWorkers: false });

async function filesIn(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesIn(path)));
    else out.push(path);
  }
  return out;
}

await build({ root, logLevel: 'warn' });

const files = [
  ...(await filesIn(join(root, 'dist'))),
  join(root, 'scripts', 'start.mjs'),
  join(root, 'scripts', 'serve.mjs'),
  join(root, 'chatledger.cmd'),
  join(root, 'chatledger.sh'),
  join(root, 'LICENSE'),
  join(root, 'README.md'),
  join(root, 'README.tr.md'),
];

const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
for (const file of files) {
  const path = `${name}/${relative(root, file).split(sep).join('/')}`;
  await zip.add(path, new Uint8ArrayReader(await readFile(file)), { executable: file.endsWith('.sh') });
}
const out = join(root, 'release', `${name}.zip`);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, await zip.close());
console.log(`${relative(root, out)} (${files.length} files)`);
