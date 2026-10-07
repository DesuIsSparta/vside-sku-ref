// Renders 256x256 thumbnails for every wearable (skuType "mesh") SKU from the
// character builder's converted GLB meshes and textures, in headless Chromium.
//
// Usage: node scripts/thumbnails/render-wearables.mjs [--out public/img/skus]
//          [--ids 100,1001] [--size 256] [--no-outline]
//
// Needs a sibling reside checkout (CHARACTER_BUILDER_ROOT overrides) with its
// npm dependencies and Playwright's Chromium installed. SKUs that fail to
// render keep whatever file already exists; see _render-report.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDER_ROOT, loadPlaywright, parseArgs, startServer } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs();
const outDir = path.resolve(ROOT, args.out || 'public/img/skus');
const size = Number(args.size || 256);
fs.mkdirSync(outDir, { recursive: true });

const skus = JSON.parse(fs.readFileSync(path.join(BUILDER_ROOT, 'public/data/skus.json'), 'utf8'));
const ids = args.ids
  ? String(args.ids).split(',').map(Number)
  : skus.filter((s) => s.skuType === 'mesh').map((s) => s.skuNum);

const { chromium } = loadPlaywright();
const server = await startServer();
// ANGLE on D3D11 uses the real GPU; headless Chromium otherwise falls back to SwiftShader.
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));
const outline = args['no-outline'] ? 0 : 1;
await page.goto(`http://127.0.0.1:${server.address().port}/page.html?size=${size}&outline=${outline}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });

const report = { rendered: [], skipped: [] };
const started = Date.now();
for (const [i, id] of ids.entries()) {
  const result = await page.evaluate((n) => window.renderSku(n), id);
  if (result.ok) {
    fs.writeFileSync(path.join(outDir, `${id}.png`), Buffer.from(result.dataUrl.split(',')[1], 'base64'));
    report.rendered.push({ id, coverage: +result.coverage.toFixed(4), luma: Math.round(result.luma) });
  } else {
    report.skipped.push({ id, reason: result.reason });
  }
  if ((i + 1) % 500 === 0) {
    await page.evaluate(() => window.dropTextureCache());
    console.log(`${i + 1}/${ids.length}`);
  }
}
fs.writeFileSync(path.join(ROOT, 'scripts/thumbnails/_render-report.json'), JSON.stringify(report));
console.log(
  `Rendered ${report.rendered.length}, skipped ${report.skipped.length} in ${((Date.now() - started) / 1000).toFixed(0)}s`,
);
await browser.close();
server.close();
