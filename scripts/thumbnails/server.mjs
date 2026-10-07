// Loopback-only static server for the headless thumbnail pages. Serves the
// character builder's converted assets and its three.js copy next to this folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKU_REF_ROOT = path.resolve(HERE, '../..');

export const BUILDER_ROOT = path.resolve(
  process.env.CHARACTER_BUILDER_ROOT || path.join(SKU_REF_ROOT, '../reside/reside-character-builder'),
);

/** Playwright comes from the character builder's dev dependencies; this site doesn't carry its own. */
export function loadPlaywright() {
  return createRequire(path.join(BUILDER_ROOT, 'package.json'))('playwright');
}

export function parseArgs(argv = process.argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    args[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : (i++, next);
  }
  return args;
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
};

/** extraRoots: [urlPrefix, directory] pairs checked before the defaults. */
export function startServer(extraRoots = []) {
  const roots = [
    ...extraRoots,
    ['/assets/', path.join(BUILDER_ROOT, 'public/assets/')],
    ['/data/', path.join(BUILDER_ROOT, 'public/data/')],
    ['/three/', path.join(BUILDER_ROOT, 'node_modules/three/')],
    ['/', HERE + path.sep],
  ];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    for (const [prefix, dir] of roots) {
      if (!url.startsWith(prefix)) continue;
      const file = path.resolve(dir, url.slice(prefix.length));
      if (!file.startsWith(path.resolve(dir))) break;
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
