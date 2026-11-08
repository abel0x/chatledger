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

/** Files from a folder on disk. */
export function directorySource(root) {
  return async rawUrl => {
    const file = resolvePath(root, rawUrl);
    const info = file ? await stat(file).catch(() => null) : null;
    if (!file || !info?.isFile()) return null;
    return { name: file, size: info.size, body: () => createReadStream(file) };
  };
}

/** Files packed into a single executable, looked up by their path in the build. */
export function assetSource(keys, read) {
  const known = new Set(keys);
  return async rawUrl => {
    let path;
    try {
      path = decodeURIComponent(new URL(`http://localhost${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`).pathname);
    } catch {
      return null;
    }
    if (path.endsWith('/')) path += 'index.html';
    // Only the packed paths exist, so nothing else can be reached however the path is written.
    const key = path.split('/').filter(Boolean).join('/');
    if (!known.has(key)) return null;
    const data = Buffer.from(read(key));
    return { name: key, size: data.length, body: () => data };
  };
}

/**
 * Answers the page. The page calls POST /alive now and then; `alive` hears
 * about it, so a copy started without a window can stop once no page is open.
 */
export function createApp(source, { alive } = {}) {
  const find = typeof source === 'string' ? directorySource(source) : source;
  return async (req, res) => {
    if (req.method === 'POST' && (req.url ?? '').split('?')[0] === '/alive') {
      alive?.();
      res.writeHead(204, HEADERS).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...HEADERS, Allow: 'GET, HEAD' }).end();
      return;
    }
    const file = await find(req.url ?? '/');
    if (!file) {
      res.writeHead(404, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const hashed = /(^|[\\/])assets[\\/]/.test(file.name);
    res.writeHead(200, {
      ...HEADERS,
      'Content-Type': MIME[extname(file.name).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': file.size,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else {
      const body = file.body();
      if (Buffer.isBuffer(body)) res.end(body);
      else body.pipe(res);
    }
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
export function serve({ root, source, port = DEFAULT_PORT, host = HOST, idleExit = 0, onIdle = () => process.exit(0) }) {
  let lastSeen = Date.now();
  return new Promise((resolveStart, reject) => {
    const server = createServer(createApp(source ?? root, { alive: () => (lastSeen = Date.now()) }));
    if (idleExit) {
      // Stops a copy that has no window of its own once no page has called in for a while.
      const timer = setInterval(() => {
        if (Date.now() - lastSeen > idleExit) {
          clearInterval(timer);
          server.close(() => onIdle());
        }
      }, Math.min(15_000, idleExit));
      timer.unref();
      server.on('close', () => clearInterval(timer));
    }
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
