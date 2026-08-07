import { getSkuShareUrl } from './deepLink';
import { placeholderMeta, placeholderSvgDataUri } from './placeholder';
import type { Gender, Sku } from './types';
import { escapeHtml, formatDuration, formatNumber, loadThumbWithFade } from './utils';

const MODAL_TRANSITION_MS = 180;

const IMG_BASE = `${import.meta.env.BASE_URL}img/skus/`;

const GENDER_LABEL: Record<Gender, string> = { m: 'Male', f: 'Female', n: 'Neutral' };

export interface ModalHandle {
  open(sku: Sku): void;
  close(): void;
}

export interface ModalOptions {
  onOpen?: (sku: Sku) => void;
  onClose?: () => void;
}

export function createModal(options: ModalOptions = {}): ModalHandle {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  let closeTimer: number | undefined;

  function close(): void {
    if (!overlay.classList.contains('modal-visible')) return;
    overlay.classList.remove('modal-visible');
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      overlay.hidden = true;
      dialog.innerHTML = '';
    }, MODAL_TRANSITION_MS);
    options.onClose?.();
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
    window.clearTimeout(closeTimer);
    dialog.innerHTML = '';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', close);

    const header = document.createElement('div');
    header.className = 'modal-header';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'modal-thumb-wrap';

    const img = document.createElement('img');
    img.className = 'modal-thumb';
    img.alt = '';
    thumbWrap.appendChild(img);
    if (sku.hasThumb) {
      loadThumbWithFade(thumbWrap, img, `${IMG_BASE}${sku.skuNum}.png`, false);
    } else {
      loadThumbWithFade(thumbWrap, img, placeholderSvgDataUri(sku.skuType), true);
    }

    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = sku.description || `SKU #${sku.skuNum}`;

    const subtitleRow = document.createElement('div');
    subtitleRow.className = 'modal-subtitle-row';
    const subtitle = document.createElement('span');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = `${placeholderMeta(sku.skuType).label} · #${sku.skuNum}`;

    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.type = 'button';
    copyLinkBtn.className = 'modal-copy-link';
    copyLinkBtn.textContent = 'Copy link';
    copyLinkBtn.addEventListener('click', () => {
      navigator.clipboard
        .writeText(getSkuShareUrl(sku.skuNum))
        .then(() => {
          copyLinkBtn.textContent = 'Copied!';
          copyLinkBtn.classList.add('copied');
          window.setTimeout(() => {
            copyLinkBtn.textContent = 'Copy link';
            copyLinkBtn.classList.remove('copied');
          }, 1200);
        })
        .catch(() => {
          // Clipboard API unavailable or blocked — nothing sensible to fall back to.
        });
    });

    subtitleRow.append(subtitle, copyLinkBtn);
    titleWrap.append(title, subtitleRow);

    header.append(thumbWrap, titleWrap);

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
    // Force a style flush so the hidden -> visible transition actually
    // animates instead of the class landing before layout picks it up.
    void overlay.offsetWidth;
    overlay.classList.add('modal-visible');
    options.onOpen?.(sku);
  }

  return { open, close };
}
