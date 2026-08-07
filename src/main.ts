import './style.css';
import { buildFacets, loadSkus } from './data';
import { createCardShell } from './card';
import { getSkuIdFromHash, setSkuHash } from './deepLink';
import { createFilterPanel } from './filterPanel';
import { createModal } from './modal';
import { AppStore } from './state';
import type { Sku } from './types';
import { VirtualGrid } from './virtualGrid';

function renderSkeleton(): string {
  const filterSections = Array.from({ length: 8 }, () => '<div class="skeleton skeleton-filter-section"></div>').join('');
  const cards = Array.from(
    { length: 28 },
    () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-card-thumb"></div>
        <div class="skeleton skeleton-card-label"></div>
      </div>`,
  ).join('');

  return `
    <div class="layout">
      <header class="topbar">
        <div class="brand">vSide <span>Sku Ref</span></div>
        <div class="skeleton skeleton-topbar-count"></div>
        <div class="skeleton skeleton-topbar-btn"></div>
      </header>
      <div class="main">
        <aside class="filter-panel">${filterSections}</aside>
        <div class="grid-wrap">
          <div class="skeleton-grid">${cards}</div>
        </div>
      </div>
    </div>
  `;
}

async function main(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app root not found');

  app.innerHTML = renderSkeleton();

  const skus = await loadSkus();
  const facets = buildFacets(skus);
  const store = new AppStore(skus, facets);

  app.innerHTML = `
    <div class="layout">
      <header class="topbar">
        <div class="brand">vSide <span>Sku Ref</span></div>
        <div class="result-count" id="result-count"></div>
        <button type="button" class="reset-btn" id="reset-btn">Reset filters</button>
      </header>
      <div class="main">
        <aside class="filter-panel" id="filter-panel"></aside>
        <div class="grid-wrap">
          <div class="grid-area" id="grid-area"></div>
          <div class="empty-state" id="empty-state" hidden>No SKUs match these filters.</div>
        </div>
      </div>
    </div>
  `;
  app.querySelector('.layout')?.classList.add('app-fade-in');

  const resultCountEl = document.getElementById('result-count') as HTMLElement;
  const gridArea = document.getElementById('grid-area') as HTMLElement;
  const emptyState = document.getElementById('empty-state') as HTMLElement;
  const filterPanelEl = document.getElementById('filter-panel') as HTMLElement;
  const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

  const modal = createModal({
    onOpen: (sku) => setSkuHash(sku.skuNum),
    onClose: () => setSkuHash(null),
  });

  const grid = new VirtualGrid<Sku>({
    container: gridArea,
    itemHeight: 148,
    itemMinWidth: 108,
    gap: 10,
    createItem: () => createCardShell((s) => modal.open(s)),
  });

  function syncResults(): void {
    const { results, allSkus } = store.getState();
    resultCountEl.textContent = `${results.length.toLocaleString()} / ${allSkus.length.toLocaleString()} SKUs`;
    emptyState.hidden = results.length > 0;
    grid.setItems(results);
  }

  store.subscribe(syncResults);
  syncResults();

  const panel = createFilterPanel(
    filterPanelEl,
    facets,
    (mutate) => store.updateFilters(mutate),
    (sort) => store.setSort(sort),
  );

  resetBtn.addEventListener('click', () => panel.reset());

  function openFromHash(): void {
    const id = getSkuIdFromHash();
    if (id == null) return;
    const sku = store.getState().allSkus.find((s) => s.skuNum === id);
    if (sku) modal.open(sku);
  }

  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}

main().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `<div class="error">Failed to load vSide Sku Ref: ${err instanceof Error ? err.message : String(err)}</div>`;
  }
});
