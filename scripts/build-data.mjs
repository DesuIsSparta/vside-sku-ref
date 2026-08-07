// Converts the exported skus.json from vside-sku-parser-rs into the compact
// dataset shipped with the site (public/data/skus.json), and records which
// SKUs have a real thumbnail in public/img/skus.
//
// Usage: node scripts/build-data.mjs
// Expects a sibling checkout at ../vside-sku-parser-rs/skus.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const SOURCE_PATH = path.resolve(ROOT, '../vside-sku-parser-rs/skus.json');
const IMG_DIR = path.resolve(ROOT, 'public/img/skus');
const OUT_PATH = path.resolve(ROOT, 'public/data/skus.json');

if (!fs.existsSync(SOURCE_PATH)) {
  console.error(`Source data not found at ${SOURCE_PATH}`);
  console.error('This script expects a sibling checkout of vside-sku-parser-rs.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const thumbIds = new Set(
  fs.readdirSync(IMG_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => Number.parseInt(f, 10))
);

const skus = raw.map((s) => ({
  skuNum: s.sku_num,
  skuType: s.sku_type,
  roleStrings: s.role_strings,
  gender: s.gender,
  brand: s.brand,
  drawerName: s.drawer_name,
  meshName: s.mesh_name,
  textureNames: s.texture_names,
  description: s.description,
  descriptionLong: s.description_long,
  stores: s.stores,
  bornWith: s.born_with,
  price: s.price,
  avail: s.avail,
  quantityRemaining: s.quantity_remaining,
  respekt: s.respekt,
  expireTime: s.expire_time,
  tags: s.tags,
  author: s.author,
  hasThumb: thumbIds.has(s.sku_num),
}));

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(skus));

const withThumb = skus.filter((s) => s.hasThumb).length;
console.log(`Wrote ${skus.length} SKUs to ${path.relative(ROOT, OUT_PATH)}`);
console.log(`  ${withThumb} with real thumbnails, ${skus.length - withThumb} using placeholder icons`);
console.log(`  Output size: ${(fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2)} MB`);
