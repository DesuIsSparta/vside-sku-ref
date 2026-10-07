// Stages a copy of every furnishing whose .dts can't find its textures, filling
// the gaps from elsewhere, so the Blender inventory-preview add-on can re-render
// it without touching the source tree.
//
// The DTS importer only looks for <material>.png/.jpg beside the shape (and in
// its parent folders). Many furnishing folders under For_UE5\Inventory never got
// their textures copied in, so they rendered as flat placeholder colours; the
// originals are in the vSide builds, sibling item folders, or the residence
// builder's Unreal texture exports.
//
// 1. blender --background --factory-startup --python list-inventory-materials.py -- <inventory> <materials.json>
// 2. node stage-furnishings.mjs --materials <materials.json> --out <staging dir>
// 3. <inventory>\render_inventory_previews_parallel.ps1 -InventoryRoot <staging dir> -ItemIds <printed ids>
//      -Resolutions 512 -LogDirectory <somewhere outside the inventory>
// 4. node stage-furnishings.mjs --collect <staging dir> --out <dir of 512px previews>
// 5. node reframe-furnishings.mjs --src <dir of 512px previews>
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './server.mjs';

const args = parseArgs();
const VSIDE = args.vside || 'E:/__vSide';
const INVENTORY = path.join(VSIDE, 'Assets/For_UE5/Inventory');
const BUILDS = path.join(VSIDE, 'Assets/Modified/Builds');
const RESIDENCE_EXPORTS = args['residence-exports']
  || path.resolve(import.meta.dirname, '../../../reside/reside-residence-builder/public/assets/furnishings');
const IMPORTER_EXTENSIONS = ['png', 'jpg'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tga', 'dds'];

if (args.collect) {
  // Gather each staged item's 512px render, named by SKU, for reframe-furnishings.mjs.
  fs.mkdirSync(args.out, { recursive: true });
  let n = 0;
  for (const id of fs.readdirSync(args.collect).filter((d) => /^\d+$/.test(d))) {
    const dir = path.join(args.collect, id);
    const file = fs.readdirSync(dir).find((f) => f === `Inventory_${id}_Preview_512x512.png`)
      ?? fs.readdirSync(dir).find((f) => f.endsWith('_Preview_512x512.png'));
    if (!file) continue;
    fs.copyFileSync(path.join(dir, file), path.join(args.out, `${id}.png`));
    n++;
  }
  console.log(`Collected ${n} previews into ${args.out}`);
  process.exit(0);
}

const materials = JSON.parse(fs.readFileSync(args.materials, 'utf8'));
const outRoot = path.resolve(args.out);

/** The importer's own lookup: <name>.png/.jpg in the shape's folder or any parent. */
function importerFinds(dir, name) {
  for (let d = dir; ; d = path.dirname(d)) {
    for (const ext of IMPORTER_EXTENSIONS) {
      const file = path.join(d, `${name}.${ext}`);
      if (fs.existsSync(file)) return file;
    }
    if (path.dirname(d) === d) return null;
  }
}

function walk(dir, visit) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, visit);
    else visit(p);
  }
}

// Candidate textures by lower-case stem. Newer builds first; then the rest of the
// asset tree (sibling item folders); then Unreal's exported base colours, skipping
// the 1x1 placeholders it wrote for textures it never had either.
const candidates = new Map();
const offer = (stem, file) => { if (!candidates.has(stem)) candidates.set(stem, file); };
const builds = fs.existsSync(BUILDS) ? fs.readdirSync(BUILDS).sort().reverse() : [];
for (const build of builds) {
  walk(path.join(BUILDS, build), (file) => {
    const ext = path.extname(file).slice(1).toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext)) offer(path.basename(file, path.extname(file)).toLowerCase(), file);
  });
}
walk(path.join(VSIDE, 'Assets'), (file) => {
  if (file.startsWith(BUILDS)) return;
  const ext = path.extname(file).slice(1).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) offer(path.basename(file, path.extname(file)).toLowerCase(), file);
});
if (fs.existsSync(RESIDENCE_EXPORTS)) {
  for (const file of fs.readdirSync(RESIDENCE_EXPORTS)) {
    const match = file.match(/^(.*)_BaseColor_\d+\.png$/);
    const full = path.join(RESIDENCE_EXPORTS, file);
    if (match && fs.statSync(full).size > 200) offer(match[1].toLowerCase(), full);
  }
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
const staged = [];
const unresolved = {};
let filled = 0;
for (const [id, shapes] of Object.entries(materials)) {
  const missing = [];
  for (const shape of shapes) {
    const dir = path.join(INVENTORY, id, path.dirname(shape.dts));
    for (const name of shape.materials ?? []) {
      if (name && !importerFinds(dir, name)) missing.push({ shape, name });
    }
  }
  if (!missing.length) continue;
  const dest = path.join(outRoot, id);
  fs.cpSync(path.join(INVENTORY, id), dest, {
    recursive: true,
    filter: (src) => !/\.blend1?$/.test(src) && !/Inventory_\d+_Preview/.test(src) && !src.includes('__FBX'),
  });
  // Staging drops the parent folders the importer would have searched, so bring those finds along too.
  for (const shape of shapes) {
    const srcDir = path.join(INVENTORY, id, path.dirname(shape.dts));
    const destDir = path.join(dest, path.dirname(shape.dts));
    for (const name of shape.materials ?? []) {
      const found = name && importerFinds(srcDir, name);
      if (found && !found.startsWith(path.join(INVENTORY, id))) fs.copyFileSync(found, path.join(destDir, path.basename(found)));
    }
  }
  for (const { shape, name } of missing) {
    const source = candidates.get(name.toLowerCase());
    if (!source) {
      (unresolved[id] ??= []).push(name);
      continue;
    }
    const ext = path.extname(source).slice(1).toLowerCase();
    if (!IMPORTER_EXTENSIONS.includes(ext)) {
      (unresolved[id] ??= []).push(`${name} (only as .${ext})`);
      continue;
    }
    fs.copyFileSync(source, path.join(dest, path.dirname(shape.dts), `${name}.${ext}`));
    filled++;
  }
  staged.push(id);
}
fs.writeFileSync(path.join(outRoot, '_unresolved.json'), JSON.stringify(unresolved, null, 1));
console.log(`Staged ${staged.length} items, filled ${filled} textures; ${Object.keys(unresolved).length} items still miss some (see _unresolved.json).`);
console.log(`ItemIds: ${staged.join(',')}`);
