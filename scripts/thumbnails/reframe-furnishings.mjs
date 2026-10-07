// Re-frames the 512x512 furnishing renders from vside-discord-bot-rs (made by
// the Blender inventory-preview add-on): trims the transparent margin, which
// is ~40% of each frame, then fits the item into a square with even padding.
//
// Usage: node scripts/thumbnails/reframe-furnishings.mjs
//          [--src ../vside-discord-bot-rs/assets/furnishings] [--out public/img/skus] [--size 256]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, parseArgs, startServer } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs();
const src = path.resolve(ROOT, args.src || '../vside-discord-bot-rs/assets/furnishings');
const outDir = path.resolve(ROOT, args.out || 'public/img/skus');
const size = Number(args.size || 256);
fs.mkdirSync(outDir, { recursive: true });

const { chromium } = loadPlaywright();
const server = await startServer([['/src/', src + path.sep]]);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/blank.html`);

let written = 0;
const empty = [];
for (const file of fs.readdirSync(src).filter((f) => f.endsWith('.png'))) {
  const bytes = await page.evaluate(async ({ file, size }) => {
    const img = new Image();
    img.src = `/src/${file}`;
    await img.decode();
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (data[(y * img.width + x) * 4 + 3] < 8) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    if (x1 < 0) return null;
    // 6% padding per side; never zoom past 15% of the source so specks stay specks.
    const side = Math.max(x1 - x0 + 1, y1 - y0 + 1, img.width * 0.15) * 1.12;
    const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
    const out = new OffscreenCanvas(size, size);
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
    const blob = await out.convertToBlob({ type: 'image/png' });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { file, size });
  if (!bytes) {
    empty.push(file);
    continue;
  }
  fs.writeFileSync(path.join(outDir, file), Buffer.from(bytes));
  written++;
}
console.log(`Re-framed ${written} furnishings; ${empty.length} fully transparent left as-is: ${empty.join(' ')}`);
await browser.close();
server.close();
