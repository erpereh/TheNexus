import { DEPTH_SCALE } from './iso';
import type { Cell } from './grid';

/**
 * Painter's-algorithm depth keys for the 2.5D world (plan: locked formulas).
 *
 * depth = (farCorner x+y) * DEPTH_SCALE + layerBias + elevation * 64
 *
 * DEPTH_SCALE (4096) strictly exceeds bias + elevation encoding (max bias 7 +
 * 63*64 = 4039), so one grid row always dominates all layer/elevation
 * differences on previous rows. Equal keys break by `id` ascending; the sort
 * itself is stable (ES2019+ Array.prototype.sort).
 */

export const DEPTH_LAYERS = [
  'floor',
  'decals',
  'walls',
  'low-props',
  'characters',
  'stations',
  'foreground',
  'overlays',
] as const;

export type DepthLayer = (typeof DEPTH_LAYERS)[number];

export const DEPTH_LAYER_BIAS: Readonly<Record<DepthLayer, number>> = {
  floor: 0,
  decals: 1,
  walls: 2,
  'low-props': 3,
  characters: 4,
  stations: 5,
  foreground: 6,
  overlays: 7,
};

/** Screen-depth units per elevation step. */
export const DEPTH_ELEVATION_STEP = 64;
/** Largest elevation that cannot collide with the next depth row. */
export const MAX_ELEVATION = 63;

export interface DepthEntry {
  id: string;
  layer: DepthLayer;
  /**
   * Cells the visual occupies. Multi-cell props (e.g. stations) sort by their
   * far corner: max(x + y) over all occupied cells.
   */
  occupiedCells: readonly Cell[];
  elevation?: number;
}

/** Depth key per the locked formula; empty occupancy sorts at the origin row. */
export function depthKeyOf(entry: DepthEntry): number {
  let far = Number.NEGATIVE_INFINITY;
  for (const cell of entry.occupiedCells) {
    const d = cell.x + cell.y;
    if (d > far) far = d;
  }
  if (far === Number.NEGATIVE_INFINITY) far = 0;
  return (
    far * DEPTH_SCALE +
    DEPTH_LAYER_BIAS[entry.layer] +
    (entry.elevation ?? 0) * DEPTH_ELEVATION_STEP
  );
}

/**
 * Deterministic back-to-front ordering: key ascending, then id ascending.
 * Returns a new array; the input is not mutated.
 */
export function sortByDepth<T extends DepthEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const ka = depthKeyOf(a);
    const kb = depthKeyOf(b);
    if (ka !== kb) return ka - kb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
