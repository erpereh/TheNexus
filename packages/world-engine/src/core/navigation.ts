import type { Cell } from './grid';

/**
 * Deterministic 8-directional A* over a walkability grid.
 *
 * - Integer costs: straight 1000, diagonal 1414 (approx sqrt(2)*1000), so
 *   path costs are exact integers and comparable across runs.
 * - No corner cutting: a diagonal step requires BOTH orthogonal neighbors to
 *   be walkable.
 * - Heap keyed (f, h, insertionCounter) plus a fixed neighbor expansion order
 *   (N, NE, E, SE, S, SW, W, NW) makes every result byte-identical for equal
 *   inputs - no Math.random, no wall-clock, no object-key iteration order
 *   dependence.
 * - Goals are *sets* of approach cells (e.g. walkable cells around a station).
 *   The first goal popped from the heap has minimal f (h = 0 at goals), so
 *   the cheapest approach cell wins; ties break by push order.
 */

export const NAV_COST_STRAIGHT = 1000;
export const NAV_COST_DIAGONAL = 1414;

export type NavigationDiagnostic =
  'OK' | 'UNREACHABLE_TARGET' | 'NO_APPROACH_CELL' | 'OUT_OF_BOUNDS';

export interface NavigationPath {
  status: NavigationDiagnostic;
  /** Cells from start (inclusive) to goal (inclusive). Empty unless OK. */
  path: readonly Cell[];
  /** Total integer path cost; 0 unless status is OK. */
  cost: number;
}

/** Structural walkability grid; satisfied by `TileGrid`. */
export interface NavigationGrid {
  readonly width: number;
  readonly height: number;
  /** Must return true for out-of-bounds cells (never walkable). */
  isBlocked(x: number, y: number): boolean;
}

/** Fixed neighbor expansion order: N, NE, E, SE, S, SW, W, NW. */
export const NEIGHBOR_OFFSETS: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

/** Octile distance in integer movement cost; admissible and consistent. */
export function octileHeuristic(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = Math.abs(fromX - toX);
  const dy = Math.abs(fromY - toY);
  const min = Math.min(dx, dy);
  const max = Math.max(dx, dy);
  return NAV_COST_STRAIGHT * (max - min) + NAV_COST_DIAGONAL * min;
}

export function inBounds(grid: NavigationGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

/**
 * Walkable cells adjacent to (but never part of) the given blocked targets,
 * enumerated in NEIGHBOR_OFFSETS order per target, deduplicated.
 */
export function approachCells(grid: NavigationGrid, targets: readonly Cell[]): Cell[] {
  const seen = new Set<number>();
  const result: Cell[] = [];
  for (const target of targets) {
    for (const offset of NEIGHBOR_OFFSETS) {
      const nx = target.x + offset.x;
      const ny = target.y + offset.y;
      if (!inBounds(grid, nx, ny)) continue;
      const idx = ny * grid.width + nx;
      if (seen.has(idx)) continue;
      if (grid.isBlocked(nx, ny)) continue;
      seen.add(idx);
      result.push({ x: nx, y: ny });
    }
  }
  return result;
}

interface HeapNode {
  f: number;
  h: number;
  counter: number;
  index: number;
}

/** Binary min-heap ordered by (f, h, counter) lexicographically. */
class MinHeap {
  private readonly nodes: HeapNode[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: HeapNode): void {
    this.nodes.push(node);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.before(node, this.nodes[parent] as HeapNode)) {
        this.nodes[i] = this.nodes[parent] as HeapNode;
        this.nodes[parent] = node;
        i = parent;
      } else {
        break;
      }
    }
  }

  pop(): HeapNode | undefined {
    const top = this.nodes[0];
    const last = this.nodes.pop();
    if (this.nodes.length > 0 && last !== undefined) {
      this.nodes[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let best = i;
        if (
          left < this.nodes.length &&
          this.before(this.nodes[left] as HeapNode, this.nodes[best] as HeapNode)
        ) {
          best = left;
        }
        if (
          right < this.nodes.length &&
          this.before(this.nodes[right] as HeapNode, this.nodes[best] as HeapNode)
        ) {
          best = right;
        }
        if (best === i) break;
        const tmp = this.nodes[i] as HeapNode;
        this.nodes[i] = this.nodes[best] as HeapNode;
        this.nodes[best] = tmp;
        i = best;
      }
    }
    return top;
  }

  private before(a: HeapNode, b: HeapNode): boolean {
    if (a.f !== b.f) return a.f < b.f;
    if (a.h !== b.h) return a.h < b.h;
    return a.counter < b.counter;
  }
}

/** Minimum octile distance to any goal - consistent for multi-goal A*. */
function heuristicToGoals(x: number, y: number, goals: readonly Cell[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const goal of goals) {
    const h = octileHeuristic(x, y, goal.x, goal.y);
    if (h < best) best = h;
  }
  return best;
}

function failure(status: NavigationDiagnostic): NavigationPath {
  return { status, path: [], cost: 0 };
}

/**
 * A* from `start` to the cheapest reachable cell in `goals`.
 * - start or every goal out of bounds -> OUT_OF_BOUNDS
 * - empty goal set, or every in-bounds goal blocked / unreachable
 *   -> UNREACHABLE_TARGET (an empty set has no target to reach)
 */
export function findPath(
  grid: NavigationGrid,
  start: Cell,
  goals: readonly Cell[],
): NavigationPath {
  if (!inBounds(grid, start.x, start.y)) return failure('OUT_OF_BOUNDS');
  const inBoundsGoals = goals.filter((g) => inBounds(grid, g.x, g.y));
  if (inBoundsGoals.length === 0) {
    return failure(goals.length === 0 ? 'UNREACHABLE_TARGET' : 'OUT_OF_BOUNDS');
  }
  const reachableGoals = inBoundsGoals.filter((g) => !grid.isBlocked(g.x, g.y));
  if (reachableGoals.length === 0) return failure('UNREACHABLE_TARGET');

  const width = grid.width;
  const size = width * grid.height;
  const startIndex = start.y * width + start.x;
  const goalIndexes = new Set<number>(reachableGoals.map((g) => g.y * width + g.x));

  const gScore = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);

  const heap = new MinHeap();
  let counter = 0;
  const startH = heuristicToGoals(start.x, start.y, reachableGoals);
  gScore[startIndex] = 0;
  heap.push({ f: startH, h: startH, counter: counter++, index: startIndex });

  while (heap.size > 0) {
    const node = heap.pop();
    if (node === undefined) break;
    const index = node.index;
    if (closed[index] !== 0) continue;
    closed[index] = 1;
    if (goalIndexes.has(index)) {
      const path: Cell[] = [];
      let cursor = index;
      while (cursor !== -1) {
        const cx = cursor % width;
        const cy = (cursor - cx) / width;
        path.push({ x: cx, y: cy });
        cursor = cameFrom[cursor] as number;
      }
      path.reverse();
      return { status: 'OK', path, cost: gScore[index] as number };
    }
    const cx = index % width;
    const cy = (index - cx) / width;
    const g = gScore[index] as number;
    for (const offset of NEIGHBOR_OFFSETS) {
      const nx = cx + offset.x;
      const ny = cy + offset.y;
      if (!inBounds(grid, nx, ny) || grid.isBlocked(nx, ny)) continue;
      const diagonal = offset.x !== 0 && offset.y !== 0;
      if (diagonal) {
        // no corner cutting: both orthogonal neighbors must be walkable
        if (grid.isBlocked(cx + offset.x, cy)) continue;
        if (grid.isBlocked(cx, cy + offset.y)) continue;
      }
      const nIndex = ny * width + nx;
      if (closed[nIndex] !== 0) continue;
      const step = diagonal ? NAV_COST_DIAGONAL : NAV_COST_STRAIGHT;
      const nextG = g + step;
      if (nextG < (gScore[nIndex] as number)) {
        gScore[nIndex] = nextG;
        cameFrom[nIndex] = index;
        const h = heuristicToGoals(nx, ny, reachableGoals);
        heap.push({ f: nextG + h, h, counter: counter++, index: nIndex });
      }
    }
  }
  return failure('UNREACHABLE_TARGET');
}

/**
 * Paths to a *blocked* target (e.g. a station): walks to the cheapest
 * approach cell around the targets. NO_APPROACH_CELL when the targets have
 * no walkable adjacent cell at all.
 */
export function findPathToTarget(
  grid: NavigationGrid,
  start: Cell,
  targets: readonly Cell[],
): NavigationPath {
  const approach = approachCells(grid, targets);
  if (approach.length === 0) return failure('NO_APPROACH_CELL');
  return findPath(grid, start, approach);
}

/**
 * Drops every path cell after `fromIndex` that has become blocked. The cell
 * at `fromIndex` (the character's current cell) is always kept so it can
 * still route out of a newly walled-in position. Returns a new array.
 */
export function revalidatePath(grid: NavigationGrid, path: readonly Cell[], fromIndex = 0): Cell[] {
  const kept: Cell[] = [];
  const lastIndex = Math.min(fromIndex, path.length - 1);
  for (let i = 0; i <= lastIndex; i++) {
    const cell = path[i];
    if (cell !== undefined) kept.push(cell);
  }
  for (let i = lastIndex + 1; i < path.length; i++) {
    const cell = path[i];
    if (cell === undefined) break;
    if (grid.isBlocked(cell.x, cell.y)) break;
    kept.push(cell);
  }
  return kept;
}
