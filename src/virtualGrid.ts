export interface PooledItem<T> {
  el: HTMLElement;
  update(item: T): void;
}

export interface VirtualGridOptions<T> {
  container: HTMLElement;
  itemHeight: number;
  itemMinWidth: number;
  gap: number;
  overscanRows?: number;
  createItem: () => PooledItem<T>;
}

/**
 * Minimal windowed grid: only the rows currently in (or near) the viewport
 * are ever in the DOM. Pooled elements are updated in place rather than
 * recreated every render — during continuous scrolling, most pool slots
 * keep showing the same item from frame to frame, so this avoids
 * re-triggering image loads for thumbnails that are already on screen.
 */
export class VirtualGrid<T> {
  private items: T[] = [];
  private topSpacer: HTMLDivElement;
  private bottomSpacer: HTMLDivElement;
  private content: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private rafId: number | null = null;
  private pool: PooledItem<T>[] = [];

  constructor(private opts: VirtualGridOptions<T>) {
    const { container } = opts;
    container.innerHTML = '';

    this.topSpacer = document.createElement('div');
    this.topSpacer.className = 'v-grid-spacer';
    this.bottomSpacer = document.createElement('div');
    this.bottomSpacer.className = 'v-grid-spacer';
    this.content = document.createElement('div');
    this.content.className = 'v-grid-content';

    container.append(this.topSpacer, this.content, this.bottomSpacer);

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
    const { container, itemHeight, gap, overscanRows = 3 } = this.opts;
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
    const needed = Math.max(0, endIndex - startIndex);

    while (this.pool.length < needed) {
      const pooled = this.opts.createItem();
      this.pool.push(pooled);
      this.content.appendChild(pooled.el);
    }
    while (this.pool.length > needed) {
      this.pool.pop()?.el.remove();
    }

    for (let i = 0; i < needed; i++) {
      this.pool[i].update(this.items[startIndex + i]);
    }

    this.topSpacer.style.height = `${startRow * rowHeight}px`;
    this.bottomSpacer.style.height = `${Math.max(0, (totalRows - endRow) * rowHeight)}px`;

    this.content.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    this.content.style.gap = `${gap}px`;
  }
}
