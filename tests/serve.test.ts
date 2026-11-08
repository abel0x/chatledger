import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolvePath, serve } from '../scripts/serve.mjs';

const root = mkdtempSync(join(tmpdir(), 'chatledger-serve-'));
mkdirSync(join(root, 'assets'));
writeFileSync(join(root, 'index.html'), '<!doctype html><title>t</title>');
writeFileSync(join(root, 'assets', 'app-1234.js'), 'export {};');
writeFileSync(join(root, '..', 'chatledger-secret.txt'), 'outside');

function get(port: number, path: string, method = 'GET') {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path, method }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

describe('resolvePath', () => {
  it('stays inside the folder it serves', () => {
    expect(resolvePath(root, '/')).toBe(join(root, 'index.html'));
    expect(resolvePath(root, '/assets/app-1234.js?v=1')).toBe(join(root, 'assets', 'app-1234.js'));
    expect(resolvePath(root, '//')).toBe(join(root, 'index.html'));
    expect(resolvePath(root, '//assets/app-1234.js')).toBe(join(root, 'assets', 'app-1234.js'));
    for (const bad of ['/../chatledger-secret.txt', '/%2e%2e/chatledger-secret.txt', '/..%2fchatledger-secret.txt', '/..%5cchatledger-secret.txt', '/a%00b', '/%E0%A4%A']) {
      const resolved = resolvePath(root, bad);
      expect(resolved === null || resolved.startsWith(root), bad).toBe(true);
    }
  });
});

describe('serve', () => {
  let port = 0;
  let close = () => {};

  beforeAll(async () => {
    const started = await serve({ root, port: 0 });
    port = Number(new URL(started.url).port);
    close = () => started.server?.close();
  });

  afterAll(() => {
    close();
    rmSync(root, { recursive: true, force: true });
    rmSync(join(root, '..', 'chatledger-secret.txt'), { force: true });
  });

  it('serves the page and its assets with the right headers', async () => {
    const page = await get(port, '/');
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.headers['cache-control']).toBe('no-cache');
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");

    const script = await get(port, '/assets/app-1234.js');
    expect(script.headers['content-type']).toContain('text/javascript');
    expect(script.headers['cache-control']).toContain('immutable');
  });

  it('never hands out files from outside', async () => {
    for (const path of ['/..%2fchatledger-secret.txt', '/%2e%2e/chatledger-secret.txt', '/../chatledger-secret.txt']) {
      const res = await get(port, path);
      expect(res.body, path).not.toContain('outside');
    }
    expect((await get(port, '/missing.js')).status).toBe(404);
  });

  it('only answers reads', async () => {
    expect((await get(port, '/', 'POST')).status).toBe(405);
    expect((await get(port, '/', 'HEAD')).body).toBe('');
  });

  it('recognises a copy that is already running', async () => {
    const again = await serve({ root, port });
    expect(again.alreadyRunning).toBe(true);
  });
});
