import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { extname, resolve, sep } from 'node:path';

/**
 * Serves the built app on this computer only. The port stays the same from
 * run to run because the browser keeps saved chats per address.
 */
export const DEFAULT_PORT = 5170;
export const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** The page carries its own policy; these add what a page cannot set for itself. */
const HEADERS = {
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Chatledger': '1',
};

/** Maps a request path to a file inside root, or null when it would leave it. */
export function resolvePath(root, rawUrl) {
  let path;
  try {
    // Joined, not resolved: a path like "//x" must not be read as another host.
    path = decodeURIComponent(new URL(`http://localhost${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`).pathname);
  } catch {
    return null;
  }
  if (path.includes('\0')) return null;
  if (path.endsWith('/')) path += 'index.html';
  const base = resolve(root);
  const full = resolve(base, `.${path}`);
  return full === base || full.startsWith(base + sep) ? full : null;
}

export function createApp(root) {
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...HEADERS, Allow: 'GET, HEAD' }).end();
      return;
    }
    const file = resolvePath(root, req.url ?? '/');
    const info = file ? await stat(file).catch(() => null) : null;
    if (!file || !info?.isFile()) {
      res.writeHead(404, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const hashed = /[\\/]assets[\\/]/.test(file);
    res.writeHead(200, {
      ...HEADERS,
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  };
}

/** Whether the program already listening on the port is chatledger. */
function isChatledger(port) {
  return new Promise(done => {
    const req = request({ host: HOST, port, path: '/', method: 'HEAD', timeout: 1500 }, res => {
      res.resume();
      done(res.headers['x-chatledger'] === '1');
    });
    req.on('error', () => done(false));
    req.on('timeout', () => {
      req.destroy();
      done(false);
    });
    req.end();
  });
}

export function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: process.platform === 'win32' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // The address is printed; the user can open it by hand.
  }
}

/**
 * Starts the server. Resolves with the address once it listens, or once a
 * copy that is already running has been found.
 */
export function serve({ root, port = DEFAULT_PORT, host = HOST }) {
  return new Promise((resolveStart, reject) => {
    const server = createServer(createApp(root));
    server.once('error', async err => {
      if (err.code === 'EADDRINUSE' && (await isChatledger(port))) {
        resolveStart({ url: `http://${host}:${port}/`, server: null, alreadyRunning: true });
      } else reject(err);
    });
    server.listen(port, host, () => {
      const address = server.address();
      const actual = typeof address === 'object' && address ? address.port : port;
      resolveStart({ url: `http://${host}:${actual}/`, server, alreadyRunning: false });
    });
  });
}
