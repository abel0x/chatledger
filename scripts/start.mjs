import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, openBrowser, serve } from './serve.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const portArg = args.find(a => a.startsWith('--port='));
const port = portArg ? Number(portArg.slice(7)) : Number(process.env.CHATLEDGER_PORT) || DEFAULT_PORT;

const turkish = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('tr');
const say = {
  oldNode: v =>
    turkish
      ? `chatledger için Node.js 20 veya daha yenisi gerekiyor (bu bilgisayarda ${v} var). https://nodejs.org adresinden güncelleyin.`
      : `chatledger needs Node.js 20 or newer (this computer has ${v}). Update it from https://nodejs.org.`,
  building: turkish ? 'Uygulama hazırlanıyor, bir kez yapılır…' : 'Preparing the app, this happens once…',
  noBuild: turkish
    ? 'Uygulama dosyaları bulunamadı. Hazır sürümü indirin ya da önce "npm install" çalıştırın.'
    : 'The app files are missing. Download a release, or run "npm install" first.',
  running: url =>
    turkish
      ? `chatledger çalışıyor: ${url}\nTarayıcınız kendiliğinden açılmazsa bu adresi açın.\nKullandığınız sürece bu pencereyi açık tutun; kapatınca chatledger durur.`
      : `chatledger is running at ${url}\nIf your browser does not open by itself, open that address.\nKeep this window open while you use it; closing it stops chatledger.`,
  already: url => (turkish ? `chatledger zaten açık: ${url}` : `chatledger is already running at ${url}`),
  busy: p =>
    turkish
      ? `${p} numaralı bağlantı noktasını başka bir program kullanıyor. O programı kapatıp yeniden deneyin.`
      : `Another program is using port ${p}. Close it and try again.`,
};

const [major] = process.versions.node.split('.').map(Number);
if ((major ?? 0) < 20) {
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
try {
  const { url, alreadyRunning } = await serve({ root: dist, port });
  console.log(alreadyRunning ? say.already(url) : say.running(url));
  if (!noOpen) openBrowser(url);
  if (alreadyRunning) process.exit(0);
} catch (err) {
  console.error(err && err.code === 'EADDRINUSE' ? say.busy(port) : err);
  process.exit(1);
}
