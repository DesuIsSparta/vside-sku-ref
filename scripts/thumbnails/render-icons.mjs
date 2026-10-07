// Builds 256x256 thumbnails for the SKU types that are pictures rather than
// models: badges, tokens and floorplans (vSide's own UI art from its builds) and
// swatches (the residence builder's swatch textures, tiled).
//
// Usage: node scripts/thumbnails/render-icons.mjs [--out public/img/skus] [--size 256]
//          [--vside E:/__vSide] [--residence-assets ../reside/reside-residence-builder/public/assets]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, parseArgs, startServer } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs();
const outDir = path.resolve(ROOT, args.out || 'public/img/skus');
const size = Number(args.size || 256);
const BUILDS = path.join(args.vside || 'E:/__vSide', 'Assets/Modified/Builds');
const RESIDENCE_ASSETS = path.resolve(ROOT, args['residence-assets'] || '../reside/reside-residence-builder/public/assets');
fs.mkdirSync(outDir, { recursive: true });

const skus = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/skus.json'), 'utf8'));

// Badge and token art lives in each build's client/ui/{badges,tokens}; prefer the newest build.
const iconFiles = new Map();
for (const build of fs.existsSync(BUILDS) ? fs.readdirSync(BUILDS).sort().reverse() : []) {
  for (const ui of ['projects/vside/client/ui', 'platform/client/ui']) {
    for (const kind of ['badges', 'tokens']) {
      const dir = path.join(BUILDS, build, ui, kind);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        const stem = path.basename(file, path.extname(file)).toLowerCase();
        if (!iconFiles.has(stem) && /\.(png|jpg)$/i.test(file)) iconFiles.set(stem, path.join(dir, file));
      }
    }
  }
}

// Floorplans use the building directory's own floorplan card for each residence
// (platform/client/ui/buildingDir_model_*.png): interior shots around the plan outline.
// The NV255 L, Tower S/M, iiR S, Loft and Beatup cards only ever shipped as a
// hand-drawn "MODEL" placeholder, so sizes borrow a sibling card of the same
// building and the Loft and Beatup floorplans keep the generic icon.
const FLOORPLAN_CARDS = {
  45000: 'nv_NV255_S', 45001: 'nv_NV255_M', 45002: 'nv_NV255_M',
  45004: 'lga_LGATowerL', 45005: 'lga_LGATowerL', 45006: 'lga_LGATowerL',
  45007: 'lga_LaBocaYachtM', 45008: 'lga_LaBocaYatchL',
  45009: 'rj_iiRResidences_M', 45010: 'rj_iiRResidences_M', 45011: 'rj_iiRResidences_L',
  45013: 'lga_TheDotDorms_A', 45014: 'lga_TheDotDorms_B',
  45015: 'lga_LaVilla', 45016: 'nv_ClubRage', 45017: 'rj_Islands',
};
const floorplanFiles = new Map();
for (const build of fs.existsSync(BUILDS) ? fs.readdirSync(BUILDS).sort().reverse() : []) {
  const dir = path.join(BUILDS, build, 'platform/client/ui');
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    const match = file.match(/^buildingDir_model_(.+)\.png$/i);
    if (match && !floorplanFiles.has(match[1])) floorplanFiles.set(match[1], path.join(dir, file));
  }
}

const jobs = [];
for (const sku of skus) {
  if (sku.skuType === 'badge' || sku.skuType === 'token') {
    const file = iconFiles.get((sku.textureNames[0] ?? '').toLowerCase());
    if (file) jobs.push({ id: sku.skuNum, kind: 'icon', file });
  } else if (sku.skuType === 'swatch') {
    const file = path.join(RESIDENCE_ASSETS, 'swatches', `${sku.skuNum}.png`);
    if (fs.existsSync(file)) jobs.push({ id: sku.skuNum, kind: 'swatch', file });
  } else if (sku.skuType === 'floorplan') {
    const file = floorplanFiles.get(FLOORPLAN_CARDS[sku.skuNum]);
    if (file) jobs.push({ id: sku.skuNum, kind: 'icon', file });
  }
}

const { chromium } = loadPlaywright();
const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/blank.html`);

const counts = {};
for (const job of jobs) {
  const mime = /\.jpe?g$/i.test(job.file) ? 'image/jpeg' : 'image/png';
  const url = `data:${mime};base64,${fs.readFileSync(job.file).toString('base64')}`;
  const bytes = await page.evaluate(async ({ url, kind, size }) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    const rounded = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    if (kind === 'icon') {
      // vSide UI art (64px badges, 200px floorplan cards): scale whole, keeping its own transparency.
      const scale = Math.min(size / img.width, size / img.height) * 0.92;
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    } else if (kind === 'swatch') {
      // A tileable surface: show a 2x2 repeat so the pattern reads, in a rounded tile.
      const inset = size * 0.04, tile = size - inset * 2;
      rounded(inset, inset, tile, tile, size * 0.08);
      ctx.save();
      ctx.clip();
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) ctx.drawImage(img, inset + tx * tile / 2, inset + ty * tile / 2, tile / 2, tile / 2);
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { url, kind: job.kind, size });
  fs.writeFileSync(path.join(outDir, `${job.id}.png`), Buffer.from(bytes));
  counts[job.kind] = (counts[job.kind] ?? 0) + 1;
}
const wanted = skus.filter((s) => ['badge', 'token', 'swatch', 'floorplan'].includes(s.skuType)).length;
console.log(`Wrote ${jobs.length} of ${wanted} picture SKUs:`, counts);
await browser.close();
server.close();
