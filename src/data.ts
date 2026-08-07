import type { Facets, Sku } from './types';

let cache: Promise<Sku[]> | null = null;

export function loadSkus(): Promise<Sku[]> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}data/skus.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load dataset: ${res.status}`);
      return res.json() as Promise<Sku[]>;
    });
  }
  return cache;
}

export function buildFacets(skus: Sku[]): Facets {
  const types = new Set<Sku['skuType']>();
  const genders = new Set<Sku['gender']>();
  const brands = new Set<string>();
  const drawers = new Set<string>();
  const stores = new Set<string>();
  const tags = new Set<string>();
  let priceMin = Infinity;
  let priceMax = -Infinity;

  for (const s of skus) {
    types.add(s.skuType);
    genders.add(s.gender);
    if (s.brand) brands.add(s.brand);
    if (s.drawerName) drawers.add(s.drawerName);
    for (const st of s.stores) stores.add(st);
    for (const t of s.tags) tags.add(t);
    if (s.price < priceMin) priceMin = s.price;
    if (s.price > priceMax) priceMax = s.price;
  }

  const collator = new Intl.Collator('en');
  return {
    types: [...types].sort(collator.compare),
    genders: [...genders].sort(collator.compare),
    brands: [...brands].sort(collator.compare),
    drawers: [...drawers].sort(collator.compare),
    stores: [...stores].sort(collator.compare),
    tags: [...tags].sort(collator.compare),
    priceMin: Number.isFinite(priceMin) ? priceMin : 0,
    priceMax: Number.isFinite(priceMax) ? priceMax : 0,
  };
}
