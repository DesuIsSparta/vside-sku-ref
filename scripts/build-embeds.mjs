// Generates a static HTML page per SKU under docs/sku/<id>/index.html, each
// carrying OG/Twitter meta tags baked in for that specific SKU (title,
// description, thumbnail image) so link-preview crawlers (Discord, etc.),
// which never execute JS, see per-SKU embeds. Real visitors are bounced into
// the SPA via a JS redirect that opens the SKU modal.
//
// Runs after `vite build`, reading the already-built docs/data/skus.json.
// Usage: node scripts/build-embeds.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const DOCS_DIR = path.resolve(ROOT, 'docs');
const DATA_PATH = path.resolve(DOCS_DIR, 'data/skus.json');
const SITE_URL = 'https://desuissparta.github.io/vside-sku-ref/';

if (!fs.existsSync(DATA_PATH)) {
  console.error(`Built dataset not found at ${DATA_PATH}`);
  console.error('Run `npm run build` (vite build) before this script.');
  process.exit(1);
}

const skus = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDescription(sku) {
  const lines = [];
  if (sku.descriptionLong && sku.descriptionLong !== sku.description) lines.push(sku.descriptionLong);
  if (sku.brand) lines.push(`Brand: ${sku.brand}`);
  if (sku.drawerName) lines.push(`Category: ${sku.drawerName}`);

  const statusParts = [];
  if (sku.price > 0) statusParts.push(`Price: ${sku.price.toLocaleString('en-US')}`);
  statusParts.push(sku.avail ? 'Available' : 'Unavailable');
  lines.push(statusParts.join(' · '));

  return lines.join('\n') || `SKU #${sku.skuNum} on vSide Sku Ref`;
}

function renderPage(sku) {
  const title = escapeHtml(sku.description || `SKU #${sku.skuNum}`);
  const description = escapeHtml(buildDescription(sku));
  const pageUrl = `${SITE_URL}sku/${sku.skuNum}/`;
  const redirectTarget = `../../#sku=${sku.skuNum}`;
  const image = sku.hasThumb ? `${SITE_URL}img/skus/${sku.skuNum}.png` : `${SITE_URL}og-image.png`;
  const imageWidth = sku.hasThumb ? 128 : 1200;
  const imageHeight = sku.hasThumb ? 128 : 630;
  const twitterCard = sku.hasThumb ? 'summary' : 'summary_large_image';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${description}" />
    <meta name="theme-color" content="#0a1730" />
    <title>${title} · vSide Sku Ref</title>

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="vSide Sku Ref" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="${imageWidth}" />
    <meta property="og:image:height" content="${imageHeight}" />
    <meta name="twitter:card" content="${twitterCard}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />

    <script>window.location.replace(${JSON.stringify(redirectTarget)});</script>
  </head>
  <body>
    <p><a href="${redirectTarget}">View ${title} on vSide Sku Ref</a></p>
  </body>
</html>
`;
}

const skuDir = path.resolve(DOCS_DIR, 'sku');
fs.rmSync(skuDir, { recursive: true, force: true });

for (const sku of skus) {
  const dir = path.resolve(skuDir, String(sku.skuNum));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.resolve(dir, 'index.html'), renderPage(sku));
}

console.log(`Wrote ${skus.length} SKU embed pages to ${path.relative(ROOT, skuDir)}`);
