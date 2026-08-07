export type SkuType = 'mesh' | 'furnishing' | 'token' | 'badge' | 'swatch' | 'floorplan' | 'service';
export type Gender = 'm' | 'f' | 'n';
export type TriState = 'any' | 'yes' | 'no';

export interface Sku {
  skuNum: number;
  skuType: SkuType;
  roleStrings: string[];
  gender: Gender;
  brand: string;
  drawerName: string;
  meshName: string;
  textureNames: string[];
  description: string;
  descriptionLong: string;
  stores: string[];
  bornWith: boolean;
  price: number;
  avail: boolean;
  quantityRemaining: number;
  respekt: number;
  expireTime: number;
  tags: string[];
  author: string;
  hasThumb: boolean;
}

export interface FilterState {
  search: string;
  types: Set<SkuType>;
  genders: Set<Gender>;
  brands: Set<string>;
  drawers: Set<string>;
  stores: Set<string>;
  tags: Set<string>;
  avail: TriState;
  bornWith: TriState;
  priceMin: number | null;
  priceMax: number | null;
  onlyWithThumb: boolean;
}

export type SortKey = 'skuNum' | 'price' | 'description' | 'respekt';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface Facets {
  types: SkuType[];
  genders: Gender[];
  brands: string[];
  drawers: string[];
  stores: string[];
  tags: string[];
  priceMin: number;
  priceMax: number;
}
