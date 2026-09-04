import { describe, expect, it } from 'vitest';
import { buildHouse, ROOM_LABELS, THENEXUS_HOUSE } from './project-house';

describe('Thenexus project house', () => {
  it('keeps every room rectangular and axis-aligned inside the footprint', () => {
    const built = buildHouse(THENEXUS_HOUSE);
    for (const room of built.rooms) {
      expect(room.rect.width).toBeGreaterThanOrEqual(6);
      expect(room.rect.height).toBeGreaterThanOrEqual(5);
      expect(room.rect.x).toBeGreaterThanOrEqual(0);
      expect(room.rect.y).toBeGreaterThanOrEqual(0);
      expect(room.rect.x + room.rect.width).toBeLessThanOrEqual(THENEXUS_HOUSE.gridWidth);
      expect(room.rect.y + room.rect.height).toBeLessThanOrEqual(THENEXUS_HOUSE.gridHeight);
      // Interior cells exactly cover the rect (no diamond/rotated shapes).
      expect(room.cells.length).toBe(room.rect.width * room.rect.height);
      for (const cell of room.cells) {
        const furnished = isStationCell(built, cell) || isPropCell(built, cell);
        expect(built.grid.isWalkable(cell.x, cell.y) || furnished).toBe(true);
      }
    }
  });

  it('forms one connected building: every room interior is reachable on foot', () => {
    const built = buildHouse(THENEXUS_HOUSE);
    const start = built.spawnCells[0];
    expect(start).toBeDefined();
    if (start === undefined) return;
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const queue = [{ ...start }];
    while (queue.length > 0) {
      const cell = queue.pop() as { x: number; y: number };
      for (const d of [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]) {
        const next = { x: cell.x + d.x, y: cell.y + d.y };
        const key = `${next.x},${next.y}`;
        if (seen.has(key) || !built.grid.isWalkable(next.x, next.y)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    for (const room of built.rooms) {
      const reached = room.cells.filter(
        (cell) => seen.has(`${cell.x},${cell.y}`) || isStationCell(built, cell),
      );
      expect(
        reached.length,
        `room ${room.roomInstanceId} is cut off from the house`,
      ).toBeGreaterThan(0);
    }
  });

  it('carves every spec opening as walkable (doors align with navigation)', () => {
    const built = buildHouse(THENEXUS_HOUSE);
    for (const opening of THENEXUS_HOUSE.openings) {
      expect(
        built.grid.isWalkable(opening.x, opening.y),
        `opening (${opening.x},${opening.y}) is blocked`,
      ).toBe(true);
    }
  });

  it('keeps garden dressing blocked and the entrance path walkable', () => {
    const built = buildHouse(THENEXUS_HOUSE);
    expect(built.garden).not.toBeNull();
    const garden = built.garden;
    if (garden === null) return;
    for (let y = garden.pond.y; y < garden.pond.y + garden.pond.height; y++) {
      for (let x = garden.pond.x; x < garden.pond.x + garden.pond.width; x++) {
        expect(built.grid.isBlocked(x, y)).toBe(true);
      }
    }
    for (const cell of [...garden.trees, ...garden.lanterns]) {
      expect(built.grid.isBlocked(cell.x, cell.y)).toBe(true);
    }
    // Entrance threshold + stone path stay walkable into the archive.
    expect(built.grid.isWalkable(22, 30)).toBe(true);
    expect(built.grid.isWalkable(22, 34)).toBe(true);
  });

  it('labels every semantic room for the floor renderer', () => {
    const built = buildHouse(THENEXUS_HOUSE);
    for (const room of built.rooms) {
      expect(room.label?.title).toBeTruthy();
      expect(room.label?.subtitle).toBeTruthy();
      expect(room.label?.title).toBe(ROOM_LABELS[room.roomType]?.title);
    }
  });

  it('exposes the garden to the renderer layout view', () => {
    const built = buildHouse(THENEXUS_HOUSE);
    expect(built.shipView.garden).toBeDefined();
    expect(built.shipView.garden?.trees.length).toBeGreaterThan(0);
  });

  it('blocks prop furniture, excludes it from spawns, and exposes it to the renderer', () => {
    const built = buildHouse(THENEXUS_HOUSE);
    const props = built.shipView.props ?? [];
    expect(props.length).toBeGreaterThan(10);
    const spawnSet = new Set(built.spawnCells.map((c) => `${c.x},${c.y}`));
    for (const prop of props) {
      expect(built.grid.isBlocked(prop.cell.x, prop.cell.y)).toBe(true);
      expect(spawnSet.has(`${prop.cell.x},${prop.cell.y}`)).toBe(false);
    }
  });
});

function isStationCell(
  built: ReturnType<typeof buildHouse>,
  cell: { x: number; y: number },
): boolean {
  return built.stations.some((station) =>
    station.footprint.some((foot) => foot.x === cell.x && foot.y === cell.y),
  );
}

function isPropCell(built: ReturnType<typeof buildHouse>, cell: { x: number; y: number }): boolean {
  return (built.shipView.props ?? []).some(
    (prop) => prop.cell.x === cell.x && prop.cell.y === cell.y,
  );
}
