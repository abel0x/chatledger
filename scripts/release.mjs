import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { build } from 'vite';
import { collectPackages, noticeFor } from './licenses.mjs';
import { buildSingle } from './single.mjs';

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

const packages = new Map();
await build({
  root,
  logLevel: 'warn',
  plugins: [collectPackages(packages, root)],
  worker: { plugins: () => [collectPackages(packages, root)] },
});
const notice = noticeFor(packages);

const files = [
  ...(await filesIn(join(root, 'dist'))),
  join(root, 'scripts', 'start.mjs'),
  join(root, 'scripts', 'launch.mjs'),
  join(root, 'scripts', 'serve.mjs'),
  join(root, 'chatledger.cmd'),
  join(root, 'chatledger.sh'),
  join(root, 'LICENSE'),
  join(root, 'README.md'),
  join(root, 'README.tr.md'),
  join(root, 'CHANGELOG.md'),
  join(root, 'SECURITY.md'),
  ...(await filesIn(join(root, 'docs', 'screenshots'))),
];

const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
for (const file of files) {
  const path = `${name}/${relative(root, file).split(sep).join('/')}`;
  await zip.add(path, new Uint8ArrayReader(await readFile(file)), { executable: file.endsWith('.sh') });
}
await zip.add(`${name}/THIRD_PARTY_LICENSES.txt`, new Uint8ArrayReader(new TextEncoder().encode(notice)));
const out = join(root, 'release', `${name}.zip`);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, await zip.close());
console.log(`${relative(root, out)} (${files.length + 1} files; bundled packages: ${[...packages.keys()].sort().join(', ')})`);

// The same app as one program that needs no Node.js, for the platform this runs on.
if (!process.argv.includes('--no-single')) {
  const single = await buildSingle({ root, version, notice });
  console.log(relative(root, single));
}
