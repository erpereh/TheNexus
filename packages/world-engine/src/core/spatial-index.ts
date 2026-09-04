/**
 * Uniform-grid spatial index for point-with-radius items (crews, stations,
 * props). Rect queries return intersecting items in ascending id order so
 * every consumer sees a deterministic order regardless of insertion history.
 */

export interface SpatialItem {
  id: string;
  /** Grid-space position. */
  x: number;
  y: number;
  /** Radius in grid cells; the item AABB is [x-r, x+r] x [y-r, y+r]. */
  radius: number;
}

export interface SpatialRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SpatialIndex<T extends SpatialItem> {
  readonly cellSize: number;
  private readonly buckets = new Map<string, Set<T>>();
  private readonly items = new Map<string, T>();

  constructor(cellSize = 8) {
    if (cellSize <= 0) throw new Error('cellSize must be positive');
    this.cellSize = cellSize;
  }

  get size(): number {
    return this.items.size;
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  /** Throws on duplicate ids: duplicates would break the deterministic order. */
  insert(item: T): void {
    if (this.items.has(item.id)) {
      throw new Error(`spatial index already contains item "${item.id}"`);
    }
    this.items.set(item.id, item);
    this.addToBuckets(item);
  }

  remove(id: string): boolean {
    const item = this.items.get(id);
    if (item === undefined) return false;
    this.items.delete(id);
    this.removeFromBuckets(item);
    return true;
  }

  /** Moves an item, re-bucketing only when its bucket span changes. */
  update(id: string, x: number, y: number): void {
    const item = this.items.get(id);
    if (item === undefined) throw new Error(`spatial index has no item "${id}"`);
    if (item.x === x && item.y === y) return;
    const before = this.spanOf(item);
    item.x = x;
    item.y = y;
    const after = this.spanOf(item);
    if (
      before.minCx !== after.minCx ||
      before.maxCx !== after.maxCx ||
      before.minCy !== after.minCy ||
      before.maxCy !== after.maxCy
    ) {
      this.removeFromBuckets(item, before);
      this.addToBuckets(item);
    }
  }

  /**
   * All items whose AABB intersects the rect (edges inclusive), sorted by id
   * ascending. O(buckets overlapped) plus per-candidate filtering.
   */
  queryRect(rect: SpatialRect): T[] {
    const minCx = Math.floor(rect.x / this.cellSize);
    const maxCx = Math.floor((rect.x + rect.width) / this.cellSize);
    const minCy = Math.floor(rect.y / this.cellSize);
    const maxCy = Math.floor((rect.y + rect.height) / this.cellSize);
    const maxX = rect.x + rect.width;
    const maxY = rect.y + rect.height;
    const candidates = new Set<T>();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.buckets.get(`${cx}:${cy}`);
        if (bucket === undefined) continue;
        for (const item of bucket) candidates.add(item);
      }
    }
    const result: T[] = [];
    for (const item of candidates) {
      if (
        item.x - item.radius <= maxX &&
        item.x + item.radius >= rect.x &&
        item.y - item.radius <= maxY &&
        item.y + item.radius >= rect.y
      ) {
        result.push(item);
      }
    }
    result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return result;
  }

  clear(): void {
    this.buckets.clear();
    this.items.clear();
  }

  private spanOf(item: T): { minCx: number; maxCx: number; minCy: number; maxCy: number } {
    return {
      minCx: Math.floor((item.x - item.radius) / this.cellSize),
      maxCx: Math.floor((item.x + item.radius) / this.cellSize),
      minCy: Math.floor((item.y - item.radius) / this.cellSize),
      maxCy: Math.floor((item.y + item.radius) / this.cellSize),
    };
  }

  private addToBuckets(item: T): void {
    const span = this.spanOf(item);
    for (let cx = span.minCx; cx <= span.maxCx; cx++) {
      for (let cy = span.minCy; cy <= span.maxCy; cy++) {
        const key = `${cx}:${cy}`;
        const bucket = this.buckets.get(key);
        if (bucket === undefined) {
          this.buckets.set(key, new Set([item]));
        } else {
          bucket.add(item);
        }
      }
    }
  }

  private removeFromBuckets(
    item: T,
    span: { minCx: number; maxCx: number; minCy: number; maxCy: number } = this.spanOf(item),
  ): void {
    for (let cx = span.minCx; cx <= span.maxCx; cx++) {
      for (let cy = span.minCy; cy <= span.maxCy; cy++) {
        const key = `${cx}:${cy}`;
        const bucket = this.buckets.get(key);
        if (bucket === undefined) continue;
        bucket.delete(item);
        if (bucket.size === 0) this.buckets.delete(key);
      }
    }
  }
}
