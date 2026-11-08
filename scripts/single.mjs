import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { build } from 'vite';

configure({ useWebWorkers: false });

const PLATFORMS = { win32: 'windows', linux: 'linux', darwin: 'macos' };

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Node's own license; it ships inside the executable, so its notice ships beside it. */
function nodeLicense() {
  const near = dirname(process.execPath);
  const file = [join(near, 'LICENSE'), join(near, '..', 'LICENSE')].find(existsSync);
  if (!file) throw new Error(`Node.js LICENSE not found next to ${process.execPath}.`);
  return readFileSync(file, 'utf8');
}

/**
 * Packs Node.js, the small server and the built app (already in dist/) into
 * one program for the platform this runs on, and zips it with its notices.
 */
export async function buildSingle({ root, version, notice }) {
  const help = spawnSync(process.execPath, ['--help'], { encoding: 'utf8' }).stdout ?? '';
  if (!help.includes('--build-sea')) throw new Error(`Building a single executable needs a Node.js with --build-sea (this is ${process.version}).`);

  const work = join(root, 'build', 'sea');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  // One CommonJS file is what Node runs inside a single executable.
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    build: {
      ssr: join(root, 'scripts', 'sea-entry.mjs'),
      outDir: work,
      emptyOutDir: false,
      target: 'node22',
      minify: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'main.cjs' } },
    },
  });

  const dist = join(root, 'dist');
  const assets = Object.fromEntries(filesIn(dist).map(file => [relative(dist, file).split(sep).join('/'), file]));
  const platform = PLATFORMS[process.platform] ?? process.platform;
  const program = join(work, process.platform === 'win32' ? 'chatledger.exe' : 'chatledger');
  const config = join(work, 'sea-config.json');
  writeFileSync(
    config,
    JSON.stringify({ main: join(work, 'main.cjs'), output: program, disableExperimentalSEAWarning: true, useCodeCache: false, assets }, null, 2),
  );
  const made = spawnSync(process.execPath, ['--build-sea', config], { stdio: 'inherit' });
  if (made.status !== 0) throw new Error('Building the single executable failed.');

  const name = `chatledger-${version}`;
  const fullNotice = `${notice}\n${'='.repeat(72)}\nNode.js ${process.version} (built into the program)\n${'='.repeat(72)}\n\n${nodeLicense()}`;
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await zip.add(`${name}/${relative(work, program)}`, new Uint8ArrayReader(readFileSync(program)), { executable: true });
  for (const doc of ['README.md', 'README.tr.md', 'CHANGELOG.md', 'SECURITY.md', 'LICENSE']) {
    await zip.add(`${name}/${doc}`, new Uint8ArrayReader(readFileSync(join(root, doc))));
  }
  await zip.add(`${name}/THIRD_PARTY_LICENSES.txt`, new Uint8ArrayReader(new TextEncoder().encode(fullNotice)));
  const out = join(root, 'release', `${name}-${platform}-${process.arch}.zip`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await zip.close());
  return out;
}
