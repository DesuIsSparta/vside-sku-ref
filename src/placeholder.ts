import type { SkuType } from './types';

interface TypeMeta {
  label: string;
  glyph: string;
  color: string;
}

const TYPE_META: Record<SkuType, TypeMeta> = {
  mesh: { label: 'Mesh', glyph: 'M', color: '#6d99d1' },
  furnishing: { label: 'Furnishing', glyph: 'F', color: '#44e72d' },
  token: { label: 'Token', glyph: 'T', color: '#f19731' },
  badge: { label: 'Badge', glyph: 'B', color: '#eb37c2' },
  swatch: { label: 'Swatch', glyph: 'S', color: '#ff53d4' },
  floorplan: { label: 'Floorplan', glyph: 'P', color: '#92a7c9' },
  service: { label: 'Service', glyph: 'V', color: '#4f9dff' },
};

const FALLBACK_META: TypeMeta = { label: 'Unknown', glyph: '?', color: '#92a7c9' };

export function placeholderMeta(type: SkuType): TypeMeta {
  return TYPE_META[type] ?? FALLBACK_META;
}

const svgCache = new Map<SkuType, string>();

export function placeholderSvgDataUri(type: SkuType): string {
  const cached = svgCache.get(type);
  if (cached) return cached;

  const { glyph, color } = placeholderMeta(type);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="12" fill="#0e1f41"/>` +
    `<rect x="1.5" y="1.5" width="125" height="125" rx="10.5" fill="none" stroke="${color}" stroke-opacity="0.4"/>` +
    `<text x="64" y="78" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="46" font-weight="700" fill="${color}" fill-opacity="0.85" text-anchor="middle">${glyph}</text>` +
    `</svg>`;

  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  svgCache.set(type, uri);
  return uri;
}
