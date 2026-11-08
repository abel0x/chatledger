import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const turkish = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('tr');
const say = {
  oldNode: v =>
    turkish
      ? `chatledger için Node.js 22 veya daha yenisi gerekiyor (bu bilgisayarda ${v} var). https://nodejs.org adresinden güncelleyin.`
      : `chatledger needs Node.js 22 or newer (this computer has ${v}). Update it from https://nodejs.org.`,
  building: turkish ? 'Uygulama hazırlanıyor, bir kez yapılır…' : 'Preparing the app, this happens once…',
  noBuild: turkish
    ? 'Uygulama dosyaları bulunamadı. Hazır sürümü indirin ya da önce "npm install" çalıştırın.'
    : 'The app files are missing. Download a release, or run "npm install" first.',
};

const [major] = process.versions.node.split('.').map(Number);
if ((major ?? 0) < 22) {
  console.error(say.oldNode(process.versions.node));
  process.exit(1);
}

function newest(dir) {
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
  }
  return latest;
}

/** A source checkout rebuilds when the code is newer than the last build; a release just runs. */
async function ensureBuilt() {
  const src = join(root, 'src');
  const built = join(dist, 'index.html');
  const hasSource = existsSync(src) && existsSync(join(root, 'node_modules', 'vite'));
  if (!hasSource) {
    if (existsSync(built)) return;
    console.error(say.noBuild);
    process.exit(1);
  }
  const stale = !existsSync(built) || Math.max(newest(src), statSync(join(root, 'index.html')).mtimeMs) > statSync(built).mtimeMs;
  if (!stale) return;
  console.log(say.building);
  const { build } = await import('vite');
  await build({ root, logLevel: 'warn' });
}

await ensureBuilt();
const { launch } = await import('./launch.mjs');
await launch({ root: dist, argv: process.argv.slice(2) });
