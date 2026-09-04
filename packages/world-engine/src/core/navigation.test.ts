import { describe, expect, it } from 'vitest';
import { TileGrid, type Cell } from './grid';
import {
  NAV_COST_DIAGONAL,
  NAV_COST_STRAIGHT,
  NEIGHBOR_OFFSETS,
  approachCells,
  findPath,
  findPathToTarget,
  octileHeuristic,
  revalidatePath,
} from './navigation';

function newGrid(width = 8, height = 8): TileGrid {
  return new TileGrid(width, height);
}

function blockRect(grid: TileGrid, x: number, y: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) grid.setBlocked(x + dx, y + dy, true);
  }
}

function expectNeighbors(path: readonly Cell[]): void {
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const cell = path[i];
    if (prev === undefined || cell === undefined) throw new Error('unexpected hole in path');
    const dx = Math.abs(cell.x - prev.x);
    const dy = Math.abs(cell.y - prev.y);
    expect(dx).toBeLessThanOrEqual(1);
    expect(dy).toBeLessThanOrEqual(1);
    expect(dx + dy).toBeGreaterThan(0);
  }
}

function pathCost(path: readonly Cell[]): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const cell = path[i];
    if (prev === undefined || cell === undefined) throw new Error('unexpected hole in path');
    cost += prev.x !== cell.x && prev.y !== cell.y ? NAV_COST_DIAGONAL : NAV_COST_STRAIGHT;
  }
  return cost;
}

describe('A* navigation', () => {
  it('expands neighbors in the fixed N,NE,E,SE,S,SW,W,NW order', () => {
    expect(NEIGHBOR_OFFSETS).toEqual([
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
    ]);
  });

  it('computes the octile heuristic with integer straight/diagonal costs', () => {
    expect(octileHeuristic(0, 0, 3, 3)).toBe(3 * NAV_COST_DIAGONAL);
    expect(octileHeuristic(0, 0, 3, 1)).toBe(2 * NAV_COST_STRAIGHT + NAV_COST_DIAGONAL);
    expect(octileHeuristic(2, 5, 2, 5)).toBe(0);
    expect(Number.isInteger(octileHeuristic(-3, -2, 4, 7))).toBe(true);
  });

  it('routes around blocked station cells at optimal integer cost', () => {
    const grid = newGrid();
    blockRect(grid, 4, 0, 1, 6); // wall column x=4 with a gap at y=6..7
    const result = findPath(grid, { x: 0, y: 0 }, [{ x: 7, y: 0 }]);
    expect(result.status).toBe('OK');
    // Optimal route dips through (4,6): 3 diagonals + 4 straights on the way
    // down, then 2 straights + 2 diagonals up to (7,4) and 4 straights home.
    // The naive octile shortcut into the wall tip is forbidden by the
    // no-corner-cutting rule, forcing two extra straight steps.
    expect(result.cost).toBe(9 * NAV_COST_STRAIGHT + 5 * NAV_COST_DIAGONAL);
    expect(result.path[0]).toEqual({ x: 0, y: 0 });
    expect(result.path[result.path.length - 1]).toEqual({ x: 7, y: 0 });
    expectNeighbors(result.path);
    expect(result.cost).toBe(pathCost(result.path));
    for (const cell of result.path) {
      expect(grid.isBlocked(cell.x, cell.y)).toBe(false);
    }
  });

  it('never cuts diagonal corners between two blocked orthogonal cells', () => {
    const grid = newGrid(4, 4);
    grid.setBlocked(1, 0, true);
    // Without corner-cutting the route must detour through y=1 with four
    // straight steps; a corner cutter would do two diagonals (2828).
    const result = findPath(grid, { x: 0, y: 0 }, [{ x: 2, y: 0 }]);
    expect(result.status).toBe('OK');
    expect(result.cost).toBe(4 * NAV_COST_STRAIGHT);
    for (let i = 1; i < result.path.length; i++) {
      const prev = result.path[i - 1];
      const cell = result.path[i];
      if (prev === undefined || cell === undefined) throw new Error('unexpected hole');
      if (prev.x !== cell.x && prev.y !== cell.y) {
        // diagonal step: both orthogonal cells must be walkable
        expect(grid.isBlocked(prev.x + (cell.x - prev.x), prev.y)).toBe(false);
        expect(grid.isBlocked(prev.x, prev.y + (cell.y - prev.y))).toBe(false);
      }
    }
  });

  it('selects the cheapest approach cell around a blocked target', () => {
    const grid = newGrid();
    const station = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ];
    for (const cell of station) grid.setBlocked(cell.x, cell.y, true);
    const start = { x: 0, y: 1 };
    const approach = approachCells(grid, station);
    // Nearest approach is (2,1) at two straight steps; the first enumerated
    // approach would be (3,0) at 2414 - A* must pick the cheapest.
    expect(approach[0]).toEqual({ x: 3, y: 0 });
    const result = findPath(grid, start, approach);
    expect(result.status).toBe('OK');
    expect(result.cost).toBe(2 * NAV_COST_STRAIGHT);
    expect(result.path[result.path.length - 1]).toEqual({ x: 2, y: 1 });
  });

  it('findPathToTarget reports NO_APPROACH_CELL when the target is sealed in', () => {
    const grid = newGrid();
    grid.setBlocked(5, 5, true);
    blockRect(grid, 4, 4, 3, 3); // every neighbor of (5,5) is blocked
    const result = findPathToTarget(grid, { x: 0, y: 0 }, [{ x: 5, y: 5 }]);
    expect(result.status).toBe('NO_APPROACH_CELL');
    expect(result.path).toEqual([]);
    expect(result.cost).toBe(0);
  });

  it('reports UNREACHABLE_TARGET when the goal is walled off or blocked', () => {
    const grid = newGrid();
    grid.setBlocked(5, 5, true);
    blockRect(grid, 4, 4, 3, 1);
    blockRect(grid, 4, 6, 3, 1);
    grid.setBlocked(4, 5, true);
    grid.setBlocked(6, 5, true);
    const walled = findPath(grid, { x: 0, y: 0 }, [{ x: 5, y: 5 }]);
    expect(walled.status).toBe('UNREACHABLE_TARGET');
    expect(walled.path).toEqual([]);
    expect(walled.cost).toBe(0);

    const plain = newGrid();
    plain.setBlocked(2, 2, true);
    const blockedGoal = findPath(plain, { x: 0, y: 0 }, [{ x: 2, y: 2 }]);
    expect(blockedGoal.status).toBe('UNREACHABLE_TARGET');
  });

  it('reports OUT_OF_BOUNDS for out-of-grid starts or goals', () => {
    const grid = newGrid();
    const start = findPath(grid, { x: 9, y: 3 }, [{ x: 2, y: 2 }]);
    expect(start.status).toBe('OUT_OF_BOUNDS');
    const goal = findPath(grid, { x: 0, y: 0 }, [{ x: -1, y: 2 }]);
    expect(goal.status).toBe('OUT_OF_BOUNDS');
    expect(findPath(grid, { x: 0, y: 0 }, []).status).toBe('UNREACHABLE_TARGET');
  });

  it('returns the start cell itself when it is already a goal', () => {
    const grid = newGrid();
    const result = findPath(grid, { x: 3, y: 3 }, [
      { x: 6, y: 6 },
      { x: 3, y: 3 },
    ]);
    expect(result.status).toBe('OK');
    expect(result.path).toEqual([{ x: 3, y: 3 }]);
    expect(result.cost).toBe(0);
  });

  it('produces byte-identical paths for repeated runs on equal inputs', () => {
    const build = (): TileGrid => {
      const grid = newGrid(12, 12);
      blockRect(grid, 3, 1, 1, 9);
      blockRect(grid, 7, 2, 1, 9);
      return grid;
    };
    const goals = [
      { x: 11, y: 0 },
      { x: 11, y: 11 },
      { x: 5, y: 11 },
    ];
    const run1 = findPath(build(), { x: 0, y: 0 }, goals);
    const run2 = findPath(build(), { x: 0, y: 0 }, goals);
    const run3 = findPath(build(), { x: 0, y: 0 }, goals);
    expect(run1.status).toBe('OK');
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    expect(JSON.stringify(run2)).toBe(JSON.stringify(run3));
  });

  it('revalidation keeps the safe prefix and drops cells entering new walls', () => {
    const grid = newGrid();
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(revalidatePath(grid, path, 0)).toEqual(path);
    grid.setBlocked(2, 0, true);
    expect(revalidatePath(grid, path, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    // The cell the character currently occupies is always kept so it can
    // route out even if it was newly walled in.
    grid.setBlocked(0, 0, true);
    grid.setBlocked(1, 0, true);
    expect(revalidatePath(grid, path, 0)).toEqual([{ x: 0, y: 0 }]);
    expect(revalidatePath(grid, path, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });
});
