import { placeholderMeta, placeholderSvgDataUri } from './placeholder';
import type { Sku } from './types';

const IMG_BASE = `${import.meta.env.BASE_URL}img/skus/`;

export function createCard(sku: Sku, onSelect: (sku: Sku) => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'sku-card';
  card.title = sku.descriptionLong || sku.description || `SKU #${sku.skuNum}`;
  card.setAttribute('aria-label', `${sku.description || placeholderMeta(sku.skuType).label} — SKU ${sku.skuNum}`);

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'sku-card-thumb';

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 96;
  img.height = 96;
  img.alt = '';
  img.src = sku.hasThumb ? `${IMG_BASE}${sku.skuNum}.png` : placeholderSvgDataUri(sku.skuType);
  thumbWrap.appendChild(img);

  const label = document.createElement('div');
  label.className = 'sku-card-label';
  label.textContent = sku.description || placeholderMeta(sku.skuType).label;

  const num = document.createElement('div');
  num.className = 'sku-card-num';
  num.textContent = `#${sku.skuNum}`;

  card.append(thumbWrap, label, num);
  card.addEventListener('click', () => onSelect(sku));

  return card;
}
