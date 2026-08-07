import { placeholderMeta, placeholderSvgDataUri } from './placeholder';
import type { PooledItem } from './virtualGrid';
import type { Sku } from './types';
import { loadThumbWithFade } from './utils';

const IMG_BASE = `${import.meta.env.BASE_URL}img/skus/`;

export function createCardShell(onSelect: (sku: Sku) => void): PooledItem<Sku> {
  let current: Sku | null = null;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'sku-card';

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'sku-card-thumb';

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 96;
  img.height = 96;
  img.alt = '';
  thumbWrap.appendChild(img);

  const label = document.createElement('div');
  label.className = 'sku-card-label';

  const num = document.createElement('div');
  num.className = 'sku-card-num';

  card.append(thumbWrap, label, num);
  card.addEventListener('click', () => {
    if (current) onSelect(current);
  });

  function update(sku: Sku): void {
    if (current === sku) return;
    current = sku;

    card.title = sku.descriptionLong || sku.description || `SKU #${sku.skuNum}`;
    card.setAttribute('aria-label', `${sku.description || placeholderMeta(sku.skuType).label} — SKU ${sku.skuNum}`);

    if (sku.hasThumb) {
      loadThumbWithFade(thumbWrap, img, `${IMG_BASE}${sku.skuNum}.png`, false);
    } else {
      loadThumbWithFade(thumbWrap, img, placeholderSvgDataUri(sku.skuType), true);
    }

    label.textContent = sku.description || placeholderMeta(sku.skuType).label;
    num.textContent = `#${sku.skuNum}`;

    card.classList.remove('card-enter');
    void card.offsetWidth;
    card.classList.add('card-enter');
  }

  return { el: card, update };
}
