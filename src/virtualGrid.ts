export interface VirtualGridOptions<T> {
  container: HTMLElement;
  itemHeight: number;
  itemMinWidth: number;
  gap: number;
  overscanRows?: number;
  renderItem: (item: T, index: number) => HTMLElement;
}

/**
 * Minimal windowed grid: only the rows currently in (or near) the viewport
 * are ever in the DOM. Row count and column count are derived from the
 * container size, so it stays smooth over 10k+ items without a UI framework.
 */
export class VirtualGrid<T> {
  private items: T[] = [];
  private topSpacer: HTMLDivElement;
  private bottomSpacer: HTMLDivElement;
  private content: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private rafId: number | null = null;

  constructor(private opts: VirtualGridOptions<T>) {
    const { container } = opts;
    container.innerHTML = '';

    this.topSpacer = document.createElement('div');
    this.topSpacer.className = 'v-grid-spacer';
    this.bottomSpacer = document.createElement('div');
    this.bottomSpacer.className = 'v-grid-spacer';
    this.content = document.createElement('div');
    this.content.className = 'v-grid-content';

    container.appendChild(this.topSpacer);
    container.appendChild(this.content);
    container.appendChild(this.bottomSpacer);

    container.addEventListener('scroll', () => this.scheduleRender(), { passive: true });
    // Resizes are infrequent, so render immediately rather than routing through
    // the rAF throttle below (which only ever fires once the tab is visible).
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(container);
  }

  setItems(items: T[]): void {
    this.items = items;
    this.opts.container.scrollTop = 0;
    this.render();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
  }

  private scheduleRender(): void {
    // Cancel-and-reschedule instead of a "pending" guard, so a frame that
    // never fires (e.g. the tab was backgrounded) can't permanently wedge
    // future renders — the latest trigger always wins once a frame does fire.
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  private computeColumns(): number {
    const { container, itemMinWidth, gap } = this.opts;
    const width = container.clientWidth;
    return Math.max(1, Math.floor((width + gap) / (itemMinWidth + gap)));
  }

  private render(): void {
    const { container, itemHeight, gap, overscanRows = 3, renderItem } = this.opts;
    const columns = this.computeColumns();
    const rowHeight = itemHeight + gap;
    const totalRows = Math.ceil(this.items.length / columns);

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    const firstVisibleRow = rowHeight > 0 ? Math.floor(scrollTop / rowHeight) : 0;
    const visibleRowCount = rowHeight > 0 ? Math.ceil(viewportHeight / rowHeight) + 1 : 1;

    const startRow = Math.max(0, firstVisibleRow - overscanRows);
    const endRow = Math.min(totalRows, firstVisibleRow + visibleRowCount + overscanRows);

    const startIndex = startRow * columns;
    const endIndex = Math.min(this.items.length, endRow * columns);

    this.topSpacer.style.height = `${startRow * rowHeight}px`;
    this.bottomSpacer.style.height = `${Math.max(0, (totalRows - endRow) * rowHeight)}px`;

    this.content.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    this.content.style.gap = `${gap}px`;
    this.content.replaceChildren(...Array.from({ length: endIndex - startIndex }, (_, i) => renderItem(this.items[startIndex + i], startIndex + i)));
  }
}
