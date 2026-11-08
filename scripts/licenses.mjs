import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function packageAt(dir) {
  const file = join(dir, 'package.json');
  if (!existsSync(file)) return null;
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  return pkg.name ? { name: pkg.name, version: pkg.version, license: pkg.license ?? 'unknown', dir } : null;
}

/**
 * Remembers every third-party package that ends up in the build, so the
 * release can carry their licenses. Used for the page and its worker alike.
 */
export function collectPackages(found, root) {
  return {
    name: 'collect-packages',
    apply: 'build',
    moduleParsed(info) {
      const id = (info.id.split('?')[0] ?? '').replace(/\\/g, '/');
      // Code Vite writes into the bundle itself, such as its module preload helper.
      if (id.includes('vite/modulepreload-polyfill') || id.startsWith('\0vite/')) {
        const vite = packageAt(join(root, 'node_modules', 'vite'));
        if (vite) found.set(vite.name, vite);
        return;
      }
      if (!id.includes('/node_modules/')) return;
      // Walk up past nested package.json files that only mark a module type.
      for (let dir = dirname(id); dir.includes('/node_modules/'); dir = dirname(dir)) {
        const pkg = packageAt(dir);
        if (pkg) {
          found.set(pkg.name, pkg);
          return;
        }
      }
    },
  };
}

function licenseText(dir) {
  const file = readdirSync(dir).find(f => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null;
}

export function noticeFor(packages) {
  const list = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
  const rule = '='.repeat(72);
  const parts = ['chatledger includes the following third-party software, each used under the license reproduced below.'];
  for (const p of list) {
    parts.push(`${rule}\n${p.name} ${p.version} (${p.license})\n${rule}\n\n${licenseText(p.dir) ?? `Licensed under ${p.license}.`}`);
  }
  return `${parts.join('\n\n')}\n`;
}
