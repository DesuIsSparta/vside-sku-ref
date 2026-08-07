import { placeholderMeta } from './placeholder';
import type { Facets, FilterState, Gender, SkuType, SortState, TriState } from './types';
import { debounce } from './utils';
import { createDefaultFilters, createDefaultSort } from './filters';

type SetStringField = 'brands' | 'drawers' | 'stores' | 'tags';
type OnFiltersChange = (mutate: (f: FilterState) => FilterState) => void;
type OnSortChange = (sort: SortState) => void;

const GENDER_LABEL: Record<Gender, string> = { m: 'Male', f: 'Female', n: 'Neutral' };
const TRI_LABEL: Record<TriState, string> = { any: 'Any', yes: 'Yes', no: 'No' };
const SORT_OPTIONS: { value: SortState['key']; label: string }[] = [
  { value: 'skuNum', label: 'SKU #' },
  { value: 'description', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'respekt', label: 'Respekt' },
];

export interface FilterPanelHandle {
  reset(): void;
}

function section(title: string, open: boolean): { details: HTMLDetailsElement; body: HTMLDivElement } {
  const details = document.createElement('details');
  details.className = 'filter-section';
  details.open = open;
  const summary = document.createElement('summary');
  summary.textContent = title;
  const body = document.createElement('div');
  body.className = 'filter-section-body';
  details.append(summary, body);
  return { details, body };
}

function createToggleChip(
  label: string,
  accent: string,
  onToggle: (active: boolean) => void,
): { el: HTMLButtonElement; setActive: (active: boolean) => void } {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.textContent = label;
  btn.style.setProperty('--chip-accent', accent);
  btn.setAttribute('aria-pressed', 'false');

  function setActive(active: boolean): void {
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }

  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-pressed') !== 'true';
    setActive(next);
    onToggle(next);
  });

  return { el: btn, setActive };
}

function createTriState(
  name: string,
  onChange: (value: TriState) => void,
): { el: HTMLElement; setValue: (v: TriState) => void } {
  const wrap = document.createElement('div');
  wrap.className = 'tri-state';
  const inputs = new Map<TriState, HTMLInputElement>();

  (['any', 'yes', 'no'] as TriState[]).forEach((value) => {
    const label = document.createElement('label');
    label.className = 'tri-state-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.addEventListener('change', () => {
      if (input.checked) onChange(value);
    });
    const span = document.createElement('span');
    span.textContent = TRI_LABEL[value];
    label.append(input, span);
    wrap.appendChild(label);
    inputs.set(value, input);
  });

  function setValue(v: TriState): void {
    inputs.get(v)!.checked = true;
  }
  setValue('any');

  return { el: wrap, setValue };
}

function createMultiSelect(
  title: string,
  options: string[],
  field: SetStringField,
  onFiltersChange: OnFiltersChange,
  open: boolean,
): { details: HTMLDetailsElement; checkboxes: Map<string, HTMLInputElement> } {
  const { details, body } = section(title, open);
  const checkboxes = new Map<string, HTMLInputElement>();
  const rows = new Map<string, HTMLLabelElement>();

  if (options.length > 8) {
    const filterInput = document.createElement('input');
    filterInput.type = 'search';
    filterInput.placeholder = `Filter ${title.toLowerCase()}…`;
    filterInput.className = 'filter-section-search';
    filterInput.addEventListener('input', () => {
      const q = filterInput.value.trim().toLowerCase();
      for (const [opt, rowEl] of rows) {
        rowEl.style.display = !q || opt.toLowerCase().includes(q) ? '' : 'none';
      }
    });
    body.appendChild(filterInput);
  }

  const list = document.createElement('div');
  list.className = 'checkbox-list';
  body.appendChild(list);

  for (const opt of options) {
    const label = document.createElement('label');
    label.className = 'checkbox-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      onFiltersChange((f) => {
        const next = new Set(f[field]);
        if (input.checked) next.add(opt);
        else next.delete(opt);
        return { ...f, [field]: next };
      });
    });
    const text = document.createElement('span');
    text.textContent = opt;
    label.append(input, text);
    list.appendChild(label);
    checkboxes.set(opt, input);
    rows.set(opt, label);
  }

  return { details, checkboxes };
}

export function createFilterPanel(
  root: HTMLElement,
  facets: Facets,
  onFiltersChange: OnFiltersChange,
  onSortChange: OnSortChange,
): FilterPanelHandle {
  root.innerHTML = '';
  root.className = 'filter-panel';

  // --- Search ---
  const searchSection = section('Search', true);
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Name, mesh, texture, tag, author, #sku…';
  searchInput.className = 'filter-search';
  const debouncedSearch = debounce((value: string) => {
    onFiltersChange((f) => ({ ...f, search: value }));
  }, 120);
  searchInput.addEventListener('input', () => debouncedSearch(searchInput.value));
  searchSection.body.appendChild(searchInput);

  // --- Sort ---
  const sortSection = section('Sort', true);
  const sortRow = document.createElement('div');
  sortRow.className = 'sort-row';
  const sortSelect = document.createElement('select');
  for (const opt of SORT_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sortSelect.appendChild(o);
  }
  const dirButton = document.createElement('button');
  dirButton.type = 'button';
  dirButton.className = 'sort-dir';
  let currentSort: SortState = createDefaultSort();
  function syncSortUi(): void {
    sortSelect.value = currentSort.key;
    dirButton.textContent = currentSort.dir === 'asc' ? '↑ Asc' : '↓ Desc';
  }
  sortSelect.addEventListener('change', () => {
    currentSort = { ...currentSort, key: sortSelect.value as SortState['key'] };
    onSortChange(currentSort);
  });
  dirButton.addEventListener('click', () => {
    currentSort = { ...currentSort, dir: currentSort.dir === 'asc' ? 'desc' : 'asc' };
    syncSortUi();
    onSortChange(currentSort);
  });
  syncSortUi();
  sortRow.append(sortSelect, dirButton);
  sortSection.body.appendChild(sortRow);

  // --- Type ---
  const typeSection = section('Type', true);
  const typeList = document.createElement('div');
  typeList.className = 'chip-list';
  const typeChipSetters = new Map<SkuType, (active: boolean) => void>();
  for (const t of facets.types) {
    const meta = placeholderMeta(t);
    const chip = createToggleChip(meta.label, meta.color, (active) => {
      onFiltersChange((f) => {
        const next = new Set(f.types);
        if (active) next.add(t);
        else next.delete(t);
        return { ...f, types: next };
      });
    });
    typeList.appendChild(chip.el);
    typeChipSetters.set(t, chip.setActive);
  }
  typeSection.body.appendChild(typeList);

  // --- Gender ---
  const genderSection = section('Gender', true);
  const genderList = document.createElement('div');
  genderList.className = 'chip-list';
  const genderChipSetters = new Map<Gender, (active: boolean) => void>();
  for (const g of facets.genders) {
    const chip = createToggleChip(GENDER_LABEL[g], '#6d99d1', (active) => {
      onFiltersChange((f) => {
        const next = new Set(f.genders);
        if (active) next.add(g);
        else next.delete(g);
        return { ...f, genders: next };
      });
    });
    genderList.appendChild(chip.el);
    genderChipSetters.set(g, chip.setActive);
  }
  genderSection.body.appendChild(genderList);

  // --- Availability / Born With ---
  const availSection = section('Availability', true);
  const availTri = createTriState('avail', (v) => onFiltersChange((f) => ({ ...f, avail: v })));
  availSection.body.appendChild(availTri.el);

  const bornWithSection = section('Born With', false);
  const bornWithTri = createTriState('bornWith', (v) => onFiltersChange((f) => ({ ...f, bornWith: v })));
  bornWithSection.body.appendChild(bornWithTri.el);

  // --- Price ---
  const priceSection = section('Price', false);
  const priceRow = document.createElement('div');
  priceRow.className = 'price-row';
  const priceMinInput = document.createElement('input');
  priceMinInput.type = 'number';
  priceMinInput.placeholder = String(facets.priceMin);
  priceMinInput.min = '0';
  const priceMaxInput = document.createElement('input');
  priceMaxInput.type = 'number';
  priceMaxInput.placeholder = String(facets.priceMax);
  priceMaxInput.min = '0';
  const debouncedPrice = debounce(() => {
    const min = priceMinInput.value === '' ? null : Number(priceMinInput.value);
    const max = priceMaxInput.value === '' ? null : Number(priceMaxInput.value);
    onFiltersChange((f) => ({ ...f, priceMin: min, priceMax: max }));
  }, 150);
  priceMinInput.addEventListener('input', debouncedPrice);
  priceMaxInput.addEventListener('input', debouncedPrice);
  priceRow.append(priceMinInput, priceMaxInput);
  priceSection.body.appendChild(priceRow);

  // --- Display options ---
  const displaySection = section('Display', true);
  const thumbLabel = document.createElement('label');
  thumbLabel.className = 'checkbox-row';
  const thumbCheckbox = document.createElement('input');
  thumbCheckbox.type = 'checkbox';
  thumbCheckbox.addEventListener('change', () => {
    onFiltersChange((f) => ({ ...f, onlyWithThumb: thumbCheckbox.checked }));
  });
  const thumbText = document.createElement('span');
  thumbText.textContent = 'Only show SKUs with a real thumbnail';
  thumbLabel.append(thumbCheckbox, thumbText);
  displaySection.body.appendChild(thumbLabel);

  // --- Multi-selects ---
  const brandSelect = createMultiSelect('Brand', facets.brands, 'brands', onFiltersChange, false);
  const drawerSelect = createMultiSelect('Category', facets.drawers, 'drawers', onFiltersChange, false);
  const storeSelect = createMultiSelect('Store', facets.stores, 'stores', onFiltersChange, false);
  const tagSelect = createMultiSelect('Tags', facets.tags, 'tags', onFiltersChange, false);

  root.append(
    searchSection.details,
    sortSection.details,
    typeSection.details,
    genderSection.details,
    availSection.details,
    bornWithSection.details,
    priceSection.details,
    displaySection.details,
    brandSelect.details,
    drawerSelect.details,
    storeSelect.details,
    tagSelect.details,
  );

  function reset(): void {
    const defaults = createDefaultFilters();
    searchInput.value = '';
    currentSort = createDefaultSort();
    syncSortUi();
    for (const setActive of typeChipSetters.values()) setActive(false);
    for (const setActive of genderChipSetters.values()) setActive(false);
    availTri.setValue('any');
    bornWithTri.setValue('any');
    priceMinInput.value = '';
    priceMaxInput.value = '';
    thumbCheckbox.checked = false;
    for (const cb of brandSelect.checkboxes.values()) cb.checked = false;
    for (const cb of drawerSelect.checkboxes.values()) cb.checked = false;
    for (const cb of storeSelect.checkboxes.values()) cb.checked = false;
    for (const cb of tagSelect.checkboxes.values()) cb.checked = false;
    onFiltersChange(() => defaults);
    onSortChange(currentSort);
  }

  return { reset };
}
