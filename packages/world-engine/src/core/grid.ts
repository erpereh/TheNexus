/**
 * Tile grid model: a fixed rectangular lattice of cells with walkability
 * flags. Pure data plus pure queries; the navigation, simulation and camera
 * modules all speak this vocabulary. No rendering, no wall-clock.
 */

/** One grid cell. Integer coordinates; x grows screen-right/down-right. */
export interface Cell {
  x: number;
  y: number;
}

/** Axis-aligned rectangle of cells (width/height in cells, not corners). */
export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TileGrid {
  readonly width: number;
  readonly height: number;
  private readonly blocked: Uint8Array;

  constructor(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error('grid dimensions must be positive');
    }
    this.width = width;
    this.height = height;
    this.blocked = new Uint8Array(width * height);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Row-major cell index; only meaningful for in-bounds cells. */
  index(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * Walkability query. Cells outside the lattice are always "blocked" so
   * navigation and simulation can treat out-of-bounds uniformly.
   */
  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.blocked[this.index(x, y)] !== 0;
  }

  isWalkable(x: number, y: number): boolean {
    return !this.isBlocked(x, y);
  }

  /** Out-of-bounds writes are ignored; callers validate coordinates first. */
  setBlocked(x: number, y: number, blocked: boolean): void {
    if (!this.inBounds(x, y)) return;
    this.blocked[this.index(x, y)] = blocked ? 1 : 0;
  }

  blockedCount(): number {
    let count = 0;
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i] !== 0) count += 1;
    }
    return count;
  }

  clone(): TileGrid {
    const copy = new TileGrid(this.width, this.height);
    copy.blocked.set(this.blocked);
    return copy;
  }
}
