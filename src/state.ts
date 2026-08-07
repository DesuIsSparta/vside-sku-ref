import { applyFilters, applySort, createDefaultFilters, createDefaultSort } from './filters';
import type { Facets, FilterState, SortState, Sku } from './types';

export interface AppState {
  allSkus: Sku[];
  facets: Facets;
  filters: FilterState;
  sort: SortState;
  results: Sku[];
}

type Listener = (state: AppState) => void;

export class AppStore {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(allSkus: Sku[], facets: Facets) {
    const filters = createDefaultFilters();
    const sort = createDefaultSort();
    this.state = {
      allSkus,
      facets,
      filters,
      sort,
      results: applySort(applyFilters(allSkus, filters), sort),
    };
  }

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private recompute(): void {
    const filtered = applyFilters(this.state.allSkus, this.state.filters);
    this.state = { ...this.state, results: applySort(filtered, this.state.sort) };
    for (const l of this.listeners) l(this.state);
  }

  setFilters(filters: FilterState): void {
    this.state = { ...this.state, filters };
    this.recompute();
  }

  updateFilters(fn: (f: FilterState) => FilterState): void {
    this.setFilters(fn(this.state.filters));
  }

  setSort(sort: SortState): void {
    this.state = { ...this.state, sort };
    this.recompute();
  }
}
