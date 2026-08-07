import type { FilterState, SortState, Sku } from './types';

export function createDefaultFilters(): FilterState {
  return {
    search: '',
    types: new Set(),
    genders: new Set(),
    brands: new Set(),
    drawers: new Set(),
    stores: new Set(),
    tags: new Set(),
    avail: 'any',
    bornWith: 'any',
    priceMin: null,
    priceMax: null,
    onlyWithThumb: false,
  };
}

export function createDefaultSort(): SortState {
  return { key: 'skuNum', dir: 'asc' };
}

function matchesSearch(sku: Sku, q: string): boolean {
  if (
    sku.description.toLowerCase().includes(q) ||
    sku.descriptionLong.toLowerCase().includes(q) ||
    sku.meshName.toLowerCase().includes(q) ||
    sku.brand.toLowerCase().includes(q) ||
    sku.drawerName.toLowerCase().includes(q) ||
    sku.author.toLowerCase().includes(q) ||
    String(sku.skuNum).includes(q)
  ) {
    return true;
  }
  return (
    sku.textureNames.some((t) => t.toLowerCase().includes(q)) ||
    sku.tags.some((t) => t.toLowerCase().includes(q)) ||
    sku.stores.some((t) => t.toLowerCase().includes(q))
  );
}

export function applyFilters(skus: Sku[], filters: FilterState): Sku[] {
  const q = filters.search.trim().toLowerCase();
  return skus.filter((sku) => {
    if (filters.types.size > 0 && !filters.types.has(sku.skuType)) return false;
    if (filters.genders.size > 0 && !filters.genders.has(sku.gender)) return false;
    if (filters.brands.size > 0 && !filters.brands.has(sku.brand)) return false;
    if (filters.drawers.size > 0 && !filters.drawers.has(sku.drawerName)) return false;
    if (filters.stores.size > 0 && !sku.stores.some((s) => filters.stores.has(s))) return false;
    if (filters.tags.size > 0 && !sku.tags.some((t) => filters.tags.has(t))) return false;
    if (filters.avail === 'yes' && !sku.avail) return false;
    if (filters.avail === 'no' && sku.avail) return false;
    if (filters.bornWith === 'yes' && !sku.bornWith) return false;
    if (filters.bornWith === 'no' && sku.bornWith) return false;
    if (filters.priceMin != null && sku.price < filters.priceMin) return false;
    if (filters.priceMax != null && sku.price > filters.priceMax) return false;
    if (filters.onlyWithThumb && !sku.hasThumb) return false;
    if (q && !matchesSearch(sku, q)) return false;
    return true;
  });
}

export function applySort(skus: Sku[], sort: SortState): Sku[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const sorted = skus.slice();
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case 'skuNum':
        cmp = a.skuNum - b.skuNum;
        break;
      case 'price':
        cmp = a.price - b.price;
        break;
      case 'respekt':
        cmp = a.respekt - b.respekt;
        break;
      case 'description':
        cmp = a.description.localeCompare(b.description);
        break;
    }
    return cmp * dir;
  });
  return sorted;
}

export function isFiltersActive(filters: FilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.types.size > 0 ||
    filters.genders.size > 0 ||
    filters.brands.size > 0 ||
    filters.drawers.size > 0 ||
    filters.stores.size > 0 ||
    filters.tags.size > 0 ||
    filters.avail !== 'any' ||
    filters.bornWith !== 'any' ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.onlyWithThumb
  );
}
