import { placeholderMeta, placeholderSvgDataUri } from './placeholder';
import type { Gender, Sku } from './types';
import { escapeHtml, formatDuration, formatNumber } from './utils';

const IMG_BASE = `${import.meta.env.BASE_URL}img/skus/`;

const GENDER_LABEL: Record<Gender, string> = { m: 'Male', f: 'Female', n: 'Neutral' };

export interface ModalHandle {
  open(sku: Sku): void;
  close(): void;
}

export function createModal(): ModalHandle {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function close(): void {
    overlay.hidden = true;
    dialog.innerHTML = '';
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });

  function row(label: string, value: string | number | undefined | null): string {
    if (value === undefined || value === null || value === '') return '';
    return (
      `<div class="modal-row"><span class="modal-row-label">${escapeHtml(label)}</span>` +
      `<span class="modal-row-value">${escapeHtml(String(value))}</span></div>`
    );
  }

  function open(sku: Sku): void {
    dialog.innerHTML = '';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', close);

    const header = document.createElement('div');
    header.className = 'modal-header';

    const img = document.createElement('img');
    img.className = 'modal-thumb';
    img.src = sku.hasThumb ? `${IMG_BASE}${sku.skuNum}.png` : placeholderSvgDataUri(sku.skuType);
    img.alt = '';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = sku.description || `SKU #${sku.skuNum}`;
    const subtitle = document.createElement('div');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = `${placeholderMeta(sku.skuType).label} · #${sku.skuNum}`;
    titleWrap.append(title, subtitle);

    header.append(img, titleWrap);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = [
      row('Description', sku.descriptionLong !== sku.description ? sku.descriptionLong : ''),
      row('Brand', sku.brand),
      row('Category', sku.drawerName),
      row('Gender', GENDER_LABEL[sku.gender]),
      row('Mesh', sku.meshName),
      row('Textures', sku.textureNames.join(', ')),
      row('Price', formatNumber(sku.price)),
      row('Available', sku.avail ? 'Yes' : 'No'),
      row('Born With', sku.bornWith ? 'Yes' : 'No'),
      row('Quantity Remaining', sku.quantityRemaining === -1 ? 'Unlimited' : formatNumber(sku.quantityRemaining)),
      row('Respekt', sku.respekt || ''),
      row('Expires', formatDuration(sku.expireTime)),
      row('Stores', sku.stores.join(', ')),
      row('Tags', sku.tags.join(', ')),
      row('Author', sku.author),
      row('Restricted To', sku.roleStrings.join(', ')),
    ].join('');

    dialog.append(closeBtn, header, body);
    overlay.hidden = false;
  }

  return { open, close };
}
