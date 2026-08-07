const HASH_PATTERN = /^#sku=(\d+)$/;

export function getSkuIdFromHash(): number | null {
  const match = HASH_PATTERN.exec(window.location.hash);
  return match ? Number(match[1]) : null;
}

export function setSkuHash(skuNum: number | null): void {
  const base = window.location.pathname + window.location.search;
  const hash = skuNum == null ? '' : `#sku=${skuNum}`;
  window.history.replaceState(null, '', base + hash);
}

export function getSkuShareUrl(skuNum: number): string {
  const dir = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return `${window.location.origin}${dir}sku/${skuNum}/`;
}
