import { DEFAULT_PORT, openBrowser, serve } from './serve.mjs';

const turkish = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('tr');

export const say = {
  running: url =>
    turkish
      ? `chatledger çalışıyor: ${url}\nTarayıcınız kendiliğinden açılmazsa bu adresi açın.\nKullandığınız sürece bu pencereyi açık tutun; kapatınca chatledger durur.`
      : `chatledger is running at ${url}\nIf your browser does not open by itself, open that address.\nKeep this window open while you use it; closing it stops chatledger.`,
  runningAlone: url =>
    turkish
      ? `chatledger çalışıyor: ${url}\nTarayıcınız kendiliğinden açılmazsa bu adresi açın.\nchatledger'ın son sekmesini kapattıktan birkaç dakika sonra kendiliğinden durur.`
      : `chatledger is running at ${url}\nIf your browser does not open by itself, open that address.\nIt stops by itself a few minutes after you close its last browser tab.`,
  already: url => (turkish ? `chatledger zaten açık: ${url}` : `chatledger is already running at ${url}`),
  busy: port =>
    turkish
      ? `${port} numaralı bağlantı noktasını başka bir program kullanıyor. O programı kapatıp yeniden deneyin.`
      : `Another program is using port ${port}. Close it and try again.`,
};

export function readArgs(argv) {
  const portArg = argv.find(a => a.startsWith('--port='));
  return {
    noOpen: argv.includes('--no-open'),
    port: portArg ? Number(portArg.slice(7)) : Number(process.env.CHATLEDGER_PORT) || DEFAULT_PORT,
  };
}

/**
 * Starts the server and opens the browser. A copy started without a
 * terminal (`idleExit`) stops by itself once no tab has called in for a while.
 */
export async function launch({ root, source, idleExit = 0, argv = [] }) {
  const { noOpen, port } = readArgs(argv);
  try {
    const { url, alreadyRunning } = await serve({ root, source, port, idleExit });
    console.log(alreadyRunning ? say.already(url) : idleExit ? say.runningAlone(url) : say.running(url));
    if (!noOpen) openBrowser(url);
    if (alreadyRunning) process.exit(0);
  } catch (err) {
    console.error(err && err.code === 'EADDRINUSE' ? say.busy(port) : err);
    process.exit(1);
  }
}
