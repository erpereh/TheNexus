import { describe, expect, it } from 'vitest';
import { TileGrid, type Cell } from './grid';
import { findPath } from './navigation';
import { TICK_MS, WorldSim } from './world-sim';

function newGrid(): TileGrid {
  return new TileGrid(8, 8);
}

function visitedCells(sim: WorldSim, ticks: number): Cell[] {
  const visited: Cell[] = [];
  visited.push({ ...sim.snapshot().characters[0]?.cell } as Cell);
  for (let i = 0; i < ticks; i++) {
    sim.advance(TICK_MS);
    const cell = sim.snapshot().characters[0]?.cell;
    if (cell !== undefined) visited.push({ ...cell });
  }
  return visited;
}

describe('WorldSim', () => {
  it('follows paths without ever entering a blocked cell', () => {
    const grid = newGrid();
    grid.setBlocked(2, 0, true);
    grid.setBlocked(2, 2, true);
    const sim = new WorldSim(grid, [{ id: 'char_1', cell: { x: 0, y: 0 } }]);
    // Manual detour around the blocked cell (2,1) is NOT blocked yet...
    sim.assignPath('char_1', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
    // ...but walls appear while the character walks.
    grid.setBlocked(2, 1, true);
    const visited = visitedCells(sim, 10);
    for (const cell of visited) {
      expect(grid.isBlocked(cell.x, cell.y)).toBe(false);
    }
    expect(visited.some((c) => c.x === 2 && c.y === 1)).toBe(false);
    const blockedEvents = sim.log.all().filter((e) => e.kind === 'movement_blocked');
    expect(blockedEvents.length).toBeGreaterThan(0);
    expect(blockedEvents[0]).toMatchObject({ characterId: 'char_1', reason: 'blocked' });
  });

  it('walks a navigated route around a wall to arrival', () => {
    const grid = newGrid();
    for (let y = 0; y <= 5; y++) grid.setBlocked(4, y, true);
    const sim = new WorldSim(grid, [{ id: 'char_1', cell: { x: 0, y: 0 } }]);
    const route = findPath(grid, { x: 0, y: 0 }, [{ x: 7, y: 0 }]);
    expect(route.status).toBe('OK');
    sim.assignPath('char_1', route.path);
    sim.advance(TICK_MS * (route.path.length + 2));
    const character = sim.snapshot().characters[0];
    expect(character?.cell).toEqual({ x: 7, y: 0 });
    expect(character?.moving).toBe(false);
    const arrived = sim.log.all().filter((e) => e.kind === 'arrived');
    expect(arrived).toHaveLength(1);
    expect(arrived[0]).toMatchObject({ characterId: 'char_1', cell: { x: 7, y: 0 } });
  });

  it('emits arrived exactly once when the path completes', () => {
    const sim = new WorldSim(newGrid(), [{ id: 'char_1', cell: { x: 0, y: 0 } }]);
    sim.assignPath('char_1', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    sim.advance(TICK_MS);
    expect(sim.log.all().some((e) => e.kind === 'arrived')).toBe(false);
    sim.advance(TICK_MS);
    const arrived = sim.log.all().filter((e) => e.kind === 'arrived');
    expect(arrived).toHaveLength(1);
    expect(arrived[0]?.tick).toBe(2);
    // Additional ticks must not emit more arrivals.
    sim.advance(TICK_MS * 3);
    expect(sim.log.all().filter((e) => e.kind === 'arrived')).toHaveLength(1);
  });

  it('claims cells so characters never co-locate or swap through each other', () => {
    const sim = new WorldSim(newGrid(), [
      { id: 'char_a', cell: { x: 0, y: 0 } },
      { id: 'char_b', cell: { x: 2, y: 0 } },
    ]);
    sim.assignPath('char_a', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    sim.assignPath('char_b', [
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]);
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const snapshot = sim.snapshot();
      for (const character of snapshot.characters) {
        const key = `${character.cell.x},${character.cell.y}`;
        expect(seen.has(key)).toBe(false); // two characters never share a cell
        seen.add(key);
      }
      sim.advance(TICK_MS);
      seen.clear();
    }
    // Deadlock at the claimed meeting point: a moved in, b waits forever.
    const a = sim.snapshot().characters.find((c) => c.id === 'char_a');
    const b = sim.snapshot().characters.find((c) => c.id === 'char_b');
    expect(a?.cell).toEqual({ x: 1, y: 0 });
    expect(b?.cell).toEqual({ x: 2, y: 0 });
    expect(b?.waiting).toBe(true);
    const blocked = sim.log.all().filter((e) => e.kind === 'movement_blocked');
    expect(blocked[0]).toMatchObject({
      characterId: 'char_b',
      reason: 'occupied',
      cell: { x: 1, y: 0 },
    });
  });

  it('produces byte-identical event logs for identical tick sequences', () => {
    const run = (dtPattern: (i: number) => number): string => {
      const grid = newGrid();
      grid.setBlocked(3, 3, true);
      const sim = new WorldSim(grid, [
        { id: 'char_c', cell: { x: 0, y: 1 } },
        { id: 'char_a', cell: { x: 1, y: 6 } },
        { id: 'char_b', cell: { x: 6, y: 0 } },
      ]);
      sim.assignPath('char_c', [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
      ]);
      sim.assignPath('char_a', [
        { x: 1, y: 6 },
        { x: 2, y: 6 },
        { x: 3, y: 6 },
        { x: 4, y: 6 },
      ]);
      sim.assignPath('char_b', [
        { x: 6, y: 0 },
        { x: 5, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]);
      for (let i = 0; i < 30; i++) sim.advance(dtPattern(i));
      return JSON.stringify(sim.log.all());
    };
    const perTick = run(() => TICK_MS);
    const irregular = run((i) => (i % 3 === 0 ? TICK_MS * 4 : TICK_MS));
    expect(perTick).toBe(irregular);
    expect(perTick.length).toBeGreaterThan(0);
  });

  it('advances in fixed 100ms ticks regardless of frame dt', () => {
    const sim = new WorldSim(newGrid(), [{ id: 'char_1', cell: { x: 0, y: 0 } }]);
    expect(sim.currentTick).toBe(0);
    sim.advance(250);
    expect(sim.currentTick).toBe(2); // 50ms carried over
    sim.advance(49);
    expect(sim.currentTick).toBe(2);
    sim.advance(1);
    expect(sim.currentTick).toBe(3);
    sim.advance(0);
    sim.advance(-100);
    expect(sim.currentTick).toBe(3);
    expect(TICK_MS).toBe(100);
  });

  it('logs spawn, path assignment and movement in deterministic order', () => {
    const sim = new WorldSim(newGrid(), [{ id: 'char_1', cell: { x: 0, y: 0 } }]);
    sim.assignPath('char_1', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    sim.advance(TICK_MS);
    const kinds = sim.log.all().map((e) => `${e.seq}:${e.kind}`);
    expect(kinds).toEqual(['1:character_spawned', '2:path_assigned', '3:arrived']);
  });

  it('rejects invalid spawns and malformed paths deterministically', () => {
    const grid = newGrid();
    grid.setBlocked(1, 1, true);
    const sim = new WorldSim(grid, [{ id: 'char_1', cell: { x: 0, y: 0 } }]);
    expect(() => sim.spawn('char_2', { x: 1, y: 1 })).toThrow(/blocked/);
    expect(() => sim.spawn('char_1', { x: 2, y: 2 })).toThrow(/already exists/);
    expect(() => sim.spawn('char_2', { x: 0, y: 0 })).toThrow(/occupied/);
    expect(() =>
      sim.assignPath('char_1', [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ]),
    ).toThrow(/start/);
    expect(() => sim.assignPath('char_missing', [{ x: 0, y: 0 }])).toThrow(/unknown character/);
    // A path of only the current cell is accepted and immediately idle.
    sim.assignPath('char_1', [{ x: 0, y: 0 }]);
    expect(sim.snapshot().characters[0]?.moving).toBe(false);
  });
});
