// Renders one SKU thumbnail per call from the character builder's converted
// GLB meshes and textures. Driven headlessly by render-wearables.mjs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const SIZE = Number(params.get('size') || 256);
const SUPERSAMPLE = 3;
const PADDING = 0.08;
const NO_OUTLINE = params.get('outline') === '0';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE * SUPERSAMPLE, SIZE * SUPERSAMPLE);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const out = document.createElement('canvas');
out.width = out.height = SIZE;
const outCtx = out.getContext('2d');

const fetchJson = async (url) => (await fetch(url)).json();
const [skus, meshManifest, textureManifest, materialFlags] = await Promise.all([
  fetchJson('/data/skus.json'),
  fetchJson('/assets/meshes-manifest.json'),
  fetchJson('/assets/textures-manifest.json'),
  fetchJson('/material-flags.json'),
]);
const byId = new Map(skus.map((s) => [s.skuNum, s]));
const availableMeshes = new Set(meshManifest.meshNames);
const availableTextures = new Set(textureManifest.available);

const loader = new GLTFLoader();
const gltfCache = new Map();
function loadGltf(url) {
  if (!gltfCache.has(url)) gltfCache.set(url, loader.loadAsync(url));
  return gltfCache.get(url);
}

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
function loadTexture(name) {
  if (!textureCache.has(name)) {
    textureCache.set(name, textureLoader.loadAsync(`/assets/textures/${name}.png`).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; // Torque UVs run outside 0..1 and tile
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    }, () => null));
  }
  return textureCache.get(name);
}

// vSide's celcube2 ramp: lit = 1.0, shade = 211/255 in display space (~0.66 linear).
const gradientMap = new THREE.DataTexture(new Uint8Array([168, 255]), 2, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const scene = new THREE.Scene();
const character = new THREE.Group();
character.rotation.y = Math.PI; // face +Z, matching the builder's viewer
scene.add(character);
// Physically based units: a white surface facing a light of intensity PI renders white.
const key = new THREE.DirectionalLight(0xffffff, Math.PI);
scene.add(key, key.target);
// Inverted-hull ink line, as in the builder viewer and vSide's shell outline;
// its width is set per shot so it stays ~1 output pixel at any zoom.
const outlineWidth = { value: 0.004 };
function createOutlineMaterial(map) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, map, alphaTest: map ? 0.5 : 0, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = outlineWidth;
    shader.vertexShader = 'uniform float outlineWidth;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += normalize(objectNormal) * outlineWidth;');
  };
  return mat;
}
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);

const skeletonGltf = await loadGltf('/assets/skeleton.glb');
character.add(skeletonGltf.scene);
const bones = new Map();
skeletonGltf.scene.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
character.updateMatrixWorld(true);

// Same procedural arm lowering as vside-sku-extractor's standing_pose: the
// meshes are bound in a T-pose, which makes every top render short and wide.
for (const side of ['L', 'R']) {
  const upper = bones.get(`Bip01_${side}_UpperArm`);
  const hand = bones.get(`Bip01_${side}_Hand`);
  if (!upper || !hand) continue;
  const shoulder = upper.getWorldPosition(new THREE.Vector3());
  const dir = hand.getWorldPosition(new THREE.Vector3()).sub(shoulder).normalize();
  const desired = new THREE.Vector3(Math.sign(dir.x) * 0.16, -1, 0.03).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(dir, desired);
  const worldQ = upper.getWorldQuaternion(new THREE.Quaternion());
  const parentQ = upper.parent.getWorldQuaternion(new THREE.Quaternion());
  upper.quaternion.copy(parentQ.invert().multiply(delta.multiply(worldQ)));
  character.updateMatrixWorld(true);
}

const stripColorway = (name) => { const i = name.indexOf('.'); return i === -1 ? name : name.slice(i + 1); };
const isSkinMaterial = (name) => stripColorway(name).split('.')[1] === 'skin';
function resolveTexture(materialName, owner, skin) {
  const suffix = stripColorway(materialName.replace(/#\d+$/, ''));
  const candidates = isSkinMaterial(materialName) ? skin?.textureNames ?? [] : owner.textureNames;
  let match = candidates.find((t) => stripColorway(t) === suffix);
  if (!match && candidates.length === 1) match = candidates[0];
  if (match && availableTextures.has(match)) return match;
  if (availableTextures.has(materialName)) return materialName;
  const base = materialName.replace(/#\d+$/, '');
  if (availableTextures.has(base)) return base;
  return null;
}

const genderOf = (sku) => (sku.gender === 'm' ? 'm' : 'f');
const firstBy = (pred) => skus.filter(pred).sort((a, b) => a.skuNum - b.skuNum)[0];
const defaults = {};
for (const g of ['m', 'f']) {
  defaults[g] = {
    skin: firstBy((s) => s.slot === 'skin' && s.gender === g),
    face: firstBy((s) => s.slot === 'face' && s.gender === g && s.meshName),
    eyes: firstBy((s) => s.slot === 'eyes' && s.gender === g && s.meshName),
    // Bare skin for nail polish: the barefoot feet, and the skin parts of a starter top's arms.
    feet: firstBy((s) => s.slot === 'feet' && s.gender === g && /\.feet\.bare$/.test(s.meshName)),
    hands: byId.get(g === 'm' ? 500 : 5510),
  };
}

const PIERCING = new Set(['earl', 'labret', 'lowlip', 'madonna', 'medusa', 'nostril', 'septum']);
const isPiercing = (slot) => PIERCING.has(slot) || /^(lft|rgh)(auricle|conch|eyebrow|lobe|orbital|pinna|rook|tragus)$/.test(slot);
const HEAD_ITEM = new Set(['hair', 'hat', 'glasses', 'mask', 'headphones', 'ear']);
const FACE_ONLY = new Set(['face', 'eyes', 'faceb', 'skin']);

/** Per-slot camera: yaw (deg, 0 = facing the character, + = character's left), elevation, min frame size (m), context. */
function shotFor(sku) {
  const slot = sku.slot || '';
  const side = /^(lft|wristleft|fingerleft|toeleft)/.test(slot) ? 1 : /^(rgh|wristright|fingerright|toeright)/.test(slot) ? -1 : 0;
  if (FACE_ONLY.has(slot)) return { yaw: 18, elev: 4, min: 0.3, context: 'head', frame: 'all' };
  if (isPiercing(slot)) return { yaw: side ? 55 * side : 22, elev: 4, min: 0.13, context: 'head', frame: 'item' };
  if (HEAD_ITEM.has(slot)) return { yaw: 25, elev: 6, min: 0.3, context: 'head', frame: 'all' };
  if (slot === 'back' || slot === 'tail') return { yaw: 155, elev: 8, min: 0.2, frame: 'item' };
  if (/^finger/.test(slot)) return { yaw: 80 * (side || 1), elev: 10, min: 0.17, context: 'hands', frame: 'item', raise: 0.45 };
  if (/^toe/.test(slot)) return { yaw: 25 * (side || 1), elev: 35, min: 0.15, context: 'feet', frame: 'item' };
  if (/^wrist/.test(slot)) return { yaw: 30 * (side || 1), elev: 12, min: 0.12, frame: 'item' };
  if (slot === 'feet' || slot === 'shoes') return { yaw: 50, elev: 18, min: 0.2, frame: 'item' };
  if (slot === 'props') return { yaw: 25, elev: 10, min: 0.08, frame: 'item', oneHand: true };
  if (/^(waist|neck)/.test(slot)) return { yaw: 20, elev: 6, min: 0.08, frame: 'item' };
  return { yaw: 20, elev: 6, min: 0.15, frame: 'item' };
}

// Torque only used texture alpha on materials flagged Translucent (0x4); the
// GLB conversion dropped the flags, so they come from the player .dts files
// (read-dts-material-flags.py). Other materials draw opaque whatever their
// alpha channel holds; guessing from the alpha itself can't tell a wing card
// whose feathers cover a sliver of each quad from an opaque item.
const TRANSLUCENT = 0x4;
function usesAlpha(materialName) {
  const flags = materialFlags[materialName] ?? materialFlags[materialName.replace(/#\d+$/, '')] ?? [];
  return flags.some((f) => f & TRANSLUCENT);
}

async function buildMeshes(owner, skin, skinOnly = false) {
  const meshes = [];
  for (const token of owner.meshName.split(/\s+/).filter((t) => availableMeshes.has(t))) {
    const gltf = await loadGltf(`/assets/meshes/${token}.glb`);
    const sources = [];
    gltf.scene.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) sources.push(o); });
    for (const src of sources) {
      if (skinOnly && !isSkinMaterial(src.material.name)) continue;
      const texName = resolveTexture(src.material.name, owner, skin);
      const map = texName ? await loadTexture(texName) : null;
      const cutout = Boolean(map) && usesAlpha(src.material.name);
      const alphaTest = cutout ? 0.5 : 0;
      const material = new THREE.MeshToonMaterial({
        map, color: map ? 0xffffff : 0x9aa4b8, gradientMap, alphaTest, side: THREE.DoubleSide,
      });
      if (!src.isSkinnedMesh) continue;
      const skeletonBones = src.skeleton.bones.map((b) => bones.get(b.name));
      if (skeletonBones.some((b) => !b)) continue;
      const outlineMaterial = createOutlineMaterial(map);
      outlineMaterial.alphaTest = alphaTest;
      for (const [mat, outline] of NO_OUTLINE || cutout ? [[material, false]] : [[material, false], [outlineMaterial, true]]) {
        const mesh = new THREE.SkinnedMesh(src.geometry, mat);
        mesh.bind(new THREE.Skeleton(skeletonBones, src.skeleton.boneInverses), src.bindMatrix);
        mesh.frustumCulled = false;
        mesh.userData.outline = outline;
        meshes.push(mesh);
      }
    }
  }
  return meshes;
}

function collectPoints(meshes) {
  const pts = [];
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    if (mesh.userData.outline) continue;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      mesh.getVertexPosition(i, v);
      pts.push(v.clone().applyMatrix4(mesh.matrixWorld));
    }
  }
  return pts;
}

// Two-handed props (a polish bottle and its brush) end up a body-width apart once
// the arms hang down; frame whichever hand holds the bigger piece.
function largerHand(pts) {
  const left = pts.filter((p) => p.x > 0.1), right = pts.filter((p) => p.x < -0.1);
  if (!left.length || !right.length || left.length + right.length < pts.length * 0.9) return pts;
  const size = (ps) => new THREE.Box3().setFromPoints(ps).getSize(new THREE.Vector3()).length();
  return size(left) >= size(right) ? left : right;
}

function frame(cx, cy, half, minHalf) {
  half = Math.max(half, minHalf);
  camera.left = cx - half; camera.right = cx + half;
  camera.top = cy + half; camera.bottom = cy - half;
  camera.near = 0.01; camera.far = 20;
  camera.updateProjectionMatrix();
  outlineWidth.value = (2 * half / SIZE) * 0.9;
}

const full = new OffscreenCanvas(SIZE * SUPERSAMPLE, SIZE * SUPERSAMPLE);
const fullCtx = full.getContext('2d', { willReadFrequently: true });
/** The last render's opaque pixels as camera-space bounds, or null if nothing drew. */
function drawnBounds() {
  const n = SIZE * SUPERSAMPLE;
  fullCtx.clearRect(0, 0, n, n);
  fullCtx.drawImage(renderer.domElement, 0, 0);
  const { data } = fullCtx.getImageData(0, 0, n, n);
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (data[(y * n + x) * 4 + 3] < 16) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = camera.right - camera.left, h = camera.top - camera.bottom;
  return {
    left: camera.left + (x0 / n) * w, right: camera.left + ((x1 + 1) / n) * w,
    top: camera.top - (y0 / n) * h, bottom: camera.top - ((y1 + 1) / n) * h,
  };
}

window.renderSku = async function renderSku(skuNum) {
  const sku = byId.get(skuNum);
  if (!sku || sku.skuType !== 'mesh') return { ok: false, reason: 'not a mesh sku' };
  const g = genderOf(sku);
  const d = defaults[g];
  const skin = sku.slot === 'skin' ? sku : d.skin;
  const shot = shotFor(sku);

  const itemOwner = sku.slot === 'skin' ? d.face : sku;
  if (!itemOwner?.meshName) return { ok: false, reason: 'no mesh' };
  const item = await buildMeshes(itemOwner, skin);
  if (!item.length) return { ok: false, reason: 'no loadable mesh' };
  const context = [];
  if (shot.context === 'hands' || shot.context === 'feet') {
    const ctx = d[shot.context];
    if (ctx) context.push(...(await buildMeshes(ctx, skin, true)));
  }
  if (shot.context === 'head') {
    for (const ctx of [d.face, d.eyes]) {
      if (!ctx || ctx === itemOwner || ctx.slot === sku.slot) continue;
      context.push(...(await buildMeshes(ctx, skin)));
    }
  }
  const all = [...item, ...context];
  character.add(...all);
  character.updateMatrixWorld(true);

  try {
    const yaw = THREE.MathUtils.degToRad(shot.yaw);
    const elev = THREE.MathUtils.degToRad(shot.elev);
    const viewDir = new THREE.Vector3(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
    let framePts = collectPoints(shot.frame === 'all' ? all : item);
    if (shot.oneHand) framePts = largerHand(framePts);
    if (!framePts.length) return { ok: false, reason: 'empty' };

    const center = new THREE.Box3().setFromPoints(framePts).getCenter(new THREE.Vector3());
    // From the side, the far hand shows past the (unrendered) body; cut away the far half.
    renderer.clippingPlanes = shot.context === 'hands' && Math.abs(center.x) > 0.05
      ? [new THREE.Plane(new THREE.Vector3(Math.sign(center.x), 0, 0), 0)]
      : [];
    camera.position.copy(center).addScaledVector(viewDir, 10);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const p = new THREE.Vector3();
    for (const pt of framePts) {
      p.copy(pt).applyMatrix4(inv);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const minHalf = shot.min / 2 * (1 + PADDING * 2);
    const fitHalf = Math.max(Math.max(maxX - minX, maxY - minY) / 2 * (1 + PADDING * 2), minHalf);
    // shot.raise shifts the frame up by a fraction of its height, e.g. from fingertips toward the wrist.
    frame((minX + maxX) / 2, (minY + maxY) / 2 + (shot.raise ?? 0) * fitHalf, fitHalf, minHalf);

    // Key light from the camera's upper left, like a product shot.
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    key.position.copy(center).addScaledVector(viewDir, 3).addScaledVector(right, -2).addScaledVector(up, 2.5);
    key.target.position.copy(center);
    key.target.updateMatrixWorld();

    renderer.render(scene, camera);
    // Cards cut out by texture alpha (tattoos, glove rings) can show a sliver of
    // their geometry's bounds; tighten the frame to what actually drew.
    const drawn = drawnBounds();
    if (drawn && Math.max(drawn.right - drawn.left, drawn.top - drawn.bottom) < 0.75 * (camera.right - camera.left)) {
      frame((drawn.left + drawn.right) / 2, (drawn.top + drawn.bottom) / 2,
        Math.max(drawn.right - drawn.left, drawn.top - drawn.bottom) / 2 * (1 + PADDING * 2), minHalf);
      renderer.render(scene, camera);
    }
    outCtx.clearRect(0, 0, SIZE, SIZE);
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
    const px = outCtx.getImageData(0, 0, SIZE, SIZE).data;
    let opaque = 0, luma = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      opaque++;
      luma += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    }
    return { ok: true, dataUrl: out.toDataURL('image/png'), coverage: opaque / (SIZE * SIZE), luma: opaque ? luma / opaque : 0 };
  } finally {
    character.remove(...all);
    for (const m of all) m.material.dispose();
  }
};

window.dropTextureCache = () => {
  for (const [name, promise] of textureCache) {
    promise.then((t) => t?.dispose());
    textureCache.delete(name);
  }
};
window.ready = true;
