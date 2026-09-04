import type { RoomType, StationType, ThemeManifest } from '@thenexus/contracts';
import { createThemeRuntime, DEFAULT_THEME } from '@thenexus/asset-system';
import type { MappingShipLayout } from '@thenexus/mapping';
import { roomPalette, stationPalette, TileGrid } from '@thenexus/world-engine/core';
import type {
  Cell,
  GridRect,
  HouseGardenView,
  HousePropView,
  ShipLayoutView,
  ShipRoomView,
  ShipStationView,
} from '@thenexus/world-engine/core';

/**
 * Reusable Project House representation (one software project = one house).
 *
 * A house is data: rectangular rooms, rectangular corridors, single-cell
 * door/path openings carved out of an otherwise solid lattice, station
 * footprints that block movement, and blocked garden dressing. `buildHouse`
 * turns any spec into grid + renderer/mapping views deterministically (no
 * RNG anywhere), so future projects — and the future House/World Editor —
 * can instantiate their own houses without touching renderer internals.
 *
 * The default `THENEXUS_HOUSE` spec below is the production TheNexus home:
 * a contemporary Japanese studio house (warm wood, shoji-inspired walls,
 * garden with pond and cherry blossom) whose rooms carry the same semantic
 * room/station types as the mapping engine, so the provider-neutral
 * pipeline (simulator → bridge → mapping → crew → navigation → WorldSim)
 * routes agents to house rooms unchanged.
 */

export interface HouseStationSpec {
  stationType: StationType;
  footprint: readonly Cell[];
}

export interface HouseRoomSpec {
  /** Stable key, e.g. `planning`. Drives `room_<roomType>` instance ids. */
  key: string;
  roomType: RoomType;
  /** Interior rect (walls excluded; exactly these cells are carved). */
  rect: GridRect;
  /** Station furniture placed inside `rect` (footprints become blocked). */
  stations: readonly HouseStationSpec[];
  /** Display label drawn on the floor (defaults to `ROOM_LABELS`). */
  label?: { title: string; subtitle: string };
}

export interface HouseSpec {
  /** Display name of the project that owns this house. */
  name: string;
  gridWidth: number;
  gridHeight: number;
  rooms: readonly HouseRoomSpec[];
  /** Walkable connector rects (hallways), carved like rooms. */
  corridors: readonly GridRect[];
  /**
   * Single walkable cells carved through walls: door gaps, side passages,
   * entrance thresholds, outdoor paths. Every room must be reachable from
   * every other room through rooms/corridors/openings only.
   */
  openings: readonly Cell[];
  garden: {
    pond: GridRect;
    trees: readonly Cell[];
    lanterns: readonly Cell[];
    /** Walkable stone-path area carved through the garden. */
    path?: GridRect;
    /** Wooden entrance deck drawn under the south threshold. */
    deck?: GridRect;
  };
  /**
   * Blocked decorative furniture (plants, shelves, lamps, chests) on room
   * corners/edges. Blocked in the grid and excluded from spawns so
   * characters never clip through what is drawn.
   */
  props?: readonly HousePropView[];
}

/** Default English room labels (desktop overrides per locale at runtime). */
export const ROOM_LABELS: Readonly<Record<string, { title: string; subtitle: string }>> = {
  command: { title: 'Planning Room', subtitle: 'Ideas → Plans' },
  engineering: { title: 'Development Room', subtitle: 'Code → Create' },
  observatory: { title: 'Research Room', subtitle: 'Explore → Learn' },
  laboratory: { title: 'Testing Room', subtitle: 'Test → Improve' },
  communications: { title: 'Communications Room', subtitle: 'Talk → Coordinate' },
  archive: { title: 'Archive Room', subtitle: 'Store → Remember' },
  library: { title: 'Library', subtitle: 'Read → Discover' },
  lounge: { title: 'Lounge', subtitle: 'Rest → Recharge' },
  generic_workstation: { title: 'Studio', subtitle: 'Make → Share' },
};

/**
 * The default TheNexus project house on a 48×36 lattice.
 *
 * Three connected rows on one rectangular footprint plus a south garden:
 *
 * ```text
 * y2          outer north wall
 * y3..8       Planning | Development | Research  (wall col x12, x27)
 * y9          wall + door gaps
 * y10..11     hallway H1 (x3..41)
 * y12         wall + door gaps
 * y13..19     Testing | Lounge | Communications  (wall col x12, x27)
 * y20         wall + door gaps
 * y21..22     hallway H2 (x3..41)
 * y23         wall + door gaps
 * y24..29     Library | Archive  (wall col x15)
 * y30         outer south wall + entrance door (x22)
 * y31..35     garden: stone path (x21..23), pond, trees, lanterns
 * ```
 *
 * Outer west wall x2, outer east wall x42 (rows A/B). All rooms reach each
 * other through doors/hallways; the Lounge sits at the circulation center.
 */
export const THENEXUS_HOUSE: HouseSpec = {
  name: 'TheNexus',
  gridWidth: 48,
  gridHeight: 36,
  rooms: [
    {
      key: 'planning',
      roomType: 'command',
      rect: { x: 3, y: 3, width: 9, height: 6 },
      stations: [
        {
          stationType: 'planning_holo',
          footprint: [
            { x: 6, y: 4 },
            { x: 7, y: 4 },
          ],
        },
        { stationType: 'core_console', footprint: [{ x: 10, y: 7 }] },
      ],
    },
    {
      key: 'development',
      roomType: 'engineering',
      rect: { x: 13, y: 3, width: 14, height: 6 },
      stations: [
        { stationType: 'coding_workstation', footprint: [{ x: 16, y: 4 }] },
        { stationType: 'coding_workstation', footprint: [{ x: 21, y: 4 }] },
        { stationType: 'generic_workstation', footprint: [{ x: 24, y: 7 }] },
      ],
    },
    {
      key: 'research',
      roomType: 'observatory',
      rect: { x: 28, y: 3, width: 14, height: 6 },
      stations: [
        { stationType: 'research_scope', footprint: [{ x: 34, y: 4 }] },
        { stationType: 'generic_workstation', footprint: [{ x: 38, y: 7 }] },
      ],
    },
    {
      key: 'testing',
      roomType: 'laboratory',
      rect: { x: 3, y: 13, width: 9, height: 7 },
      stations: [
        {
          stationType: 'test_bench',
          footprint: [
            { x: 6, y: 15 },
            { x: 7, y: 15 },
          ],
        },
      ],
    },
    {
      key: 'lounge',
      roomType: 'lounge',
      rect: { x: 13, y: 13, width: 14, height: 7 },
      stations: [
        { stationType: 'lounge_seat', footprint: [{ x: 16, y: 15 }] },
        { stationType: 'lounge_seat', footprint: [{ x: 22, y: 15 }] },
        { stationType: 'lounge_seat', footprint: [{ x: 19, y: 17 }] },
        { stationType: 'generic_workstation', footprint: [{ x: 24, y: 18 }] },
      ],
    },
    {
      key: 'communications',
      roomType: 'communications',
      rect: { x: 28, y: 13, width: 14, height: 7 },
      stations: [
        { stationType: 'comm_console', footprint: [{ x: 32, y: 15 }] },
        { stationType: 'comm_console', footprint: [{ x: 36, y: 17 }] },
      ],
    },
    {
      key: 'library',
      roomType: 'library',
      rect: { x: 3, y: 24, width: 12, height: 6 },
      stations: [
        { stationType: 'reading_desk', footprint: [{ x: 6, y: 26 }] },
        { stationType: 'reading_desk', footprint: [{ x: 11, y: 27 }] },
      ],
    },
    {
      key: 'archive',
      roomType: 'archive',
      rect: { x: 16, y: 24, width: 13, height: 6 },
      stations: [{ stationType: 'archive_terminal', footprint: [{ x: 22, y: 26 }] }],
    },
  ],
  corridors: [
    { x: 3, y: 10, width: 39, height: 2 },
    { x: 3, y: 21, width: 39, height: 2 },
  ],
  openings: [
    // Row A south doors (wall y9) into H1.
    { x: 7, y: 9 },
    { x: 17, y: 9 },
    { x: 22, y: 9 },
    { x: 32, y: 9 },
    { x: 37, y: 9 },
    // H1 into row B (wall y12).
    { x: 7, y: 12 },
    { x: 17, y: 12 },
    { x: 22, y: 12 },
    { x: 32, y: 12 },
    { x: 37, y: 12 },
    // Side passages between neighboring rooms (walls x12 / x27).
    { x: 12, y: 5 },
    { x: 27, y: 5 },
    { x: 12, y: 16 },
    { x: 27, y: 16 },
    // Row B south doors (wall y20) into H2.
    { x: 7, y: 20 },
    { x: 16, y: 20 },
    { x: 22, y: 20 },
    { x: 34, y: 20 },
    // H2 into row C (wall y23).
    { x: 8, y: 23 },
    { x: 12, y: 23 },
    { x: 21, y: 23 },
    { x: 25, y: 23 },
    // Library <-> archive side passage (wall x15).
    { x: 15, y: 26 },
    // South entrance (wall y30) + garden stone path.
    { x: 22, y: 30 },
    { x: 21, y: 31 },
    { x: 22, y: 31 },
    { x: 23, y: 31 },
    { x: 21, y: 32 },
    { x: 22, y: 32 },
    { x: 23, y: 32 },
    { x: 21, y: 33 },
    { x: 22, y: 33 },
    { x: 23, y: 33 },
    { x: 21, y: 34 },
    { x: 22, y: 34 },
    { x: 23, y: 34 },
    { x: 21, y: 35 },
    { x: 22, y: 35 },
    { x: 23, y: 35 },
  ],
  garden: {
    pond: { x: 36, y: 31, width: 5, height: 4 },
    trees: [
      { x: 5, y: 32 },
      { x: 10, y: 33 },
      { x: 33, y: 33 },
      { x: 33, y: 26 },
      { x: 38, y: 27 },
      { x: 44, y: 32 },
    ],
    lanterns: [
      { x: 19, y: 32 },
      { x: 25, y: 32 },
      { x: 34, y: 30 },
      { x: 31, y: 28 },
    ],
    path: { x: 21, y: 31, width: 3, height: 5 },
    deck: { x: 20, y: 30, width: 6, height: 1 },
  },
  props: [
    { cell: { x: 3, y: 3 }, kind: 'shelf' },
    { cell: { x: 11, y: 3 }, kind: 'plant' },
    { cell: { x: 3, y: 8 }, kind: 'lamp' },
    { cell: { x: 13, y: 3 }, kind: 'shelf' },
    { cell: { x: 26, y: 3 }, kind: 'plant' },
    { cell: { x: 13, y: 8 }, kind: 'lamp' },
    { cell: { x: 28, y: 3 }, kind: 'shelf' },
    { cell: { x: 41, y: 3 }, kind: 'plant' },
    { cell: { x: 28, y: 8 }, kind: 'lamp' },
    { cell: { x: 3, y: 13 }, kind: 'shelf' },
    { cell: { x: 3, y: 19 }, kind: 'lamp' },
    { cell: { x: 11, y: 19 }, kind: 'plant' },
    { cell: { x: 13, y: 13 }, kind: 'plant' },
    { cell: { x: 26, y: 19 }, kind: 'lamp' },
    { cell: { x: 41, y: 13 }, kind: 'shelf' },
    { cell: { x: 28, y: 13 }, kind: 'plant' },
    { cell: { x: 41, y: 19 }, kind: 'lamp' },
    { cell: { x: 3, y: 29 }, kind: 'plant' },
    { cell: { x: 14, y: 24 }, kind: 'lamp' },
    { cell: { x: 28, y: 24 }, kind: 'shelf' },
    { cell: { x: 16, y: 29 }, kind: 'plant' },
    { cell: { x: 24, y: 29 }, kind: 'chest' },
  ],
};

export interface BuiltHouse {
  grid: TileGrid;
  rooms: readonly ShipRoomView[];
  stations: readonly ShipStationView[];
  /** Blocked cells rendered as walls (blocked + adjacent to walkable). */
  walls: readonly Cell[];
  /** Row-major walkable spawn cells (stations excluded, garden blocked out). */
  spawnCells: readonly Cell[];
  /** View consumed by `MappingEngine.resolve`. */
  mappingLayout: MappingShipLayout;
  /** View consumed by `WorldRenderer.setLayout`. */
  shipView: ShipLayoutView;
  bounds: GridRect;
  garden: HouseGardenView | null;
}

/** Builds any house spec into grid + renderer/mapping views (deterministic). */
export function buildHouse(spec: HouseSpec, theme: ThemeManifest = DEFAULT_THEME): BuiltHouse {
  const runtime = createThemeRuntime(theme, [DEFAULT_THEME]);
  const grid = new TileGrid(spec.gridWidth, spec.gridHeight);
  for (let y = 0; y < spec.gridHeight; y++) {
    for (let x = 0; x < spec.gridWidth; x++) grid.setBlocked(x, y, true);
  }
  const carve = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < spec.gridWidth && y < spec.gridHeight) grid.setBlocked(x, y, false);
  };
  const carveRect = (rect: GridRect): void => {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) carve(x, y);
    }
  };
  for (const room of spec.rooms) carveRect(room.rect);
  for (const corridor of spec.corridors) carveRect(corridor);
  for (const opening of spec.openings) carve(opening.x, opening.y);
  // Station furniture blocks its footprint.
  for (const room of spec.rooms) {
    for (const station of room.stations) {
      for (const cell of station.footprint) grid.setBlocked(cell.x, cell.y, true);
    }
  }
  // Decorative prop furniture blocks its cell (drawn as furniture, never
  // walked through, never used as a spawn).
  const propList: HousePropView[] = (spec.props ?? []).map((prop) => ({
    cell: { ...prop.cell },
    kind: prop.kind,
  }));
  for (const prop of propList) grid.setBlocked(prop.cell.x, prop.cell.y, true);
  // Garden dressing stays blocked (pond, trees, lanterns never walkable).
  if (spec.garden !== undefined) {
    carveRect(spec.garden.pond);
    for (const cell of [...spec.garden.trees, ...spec.garden.lanterns]) carve(cell.x, cell.y);
    for (let y = spec.garden.pond.y; y < spec.garden.pond.y + spec.garden.pond.height; y++) {
      for (let x = spec.garden.pond.x; x < spec.garden.pond.x + spec.garden.pond.width; x++) {
        grid.setBlocked(x, y, true);
      }
    }
    for (const cell of [...spec.garden.trees, ...spec.garden.lanterns]) {
      grid.setBlocked(cell.x, cell.y, true);
    }
  }

  const rooms: ShipRoomView[] = spec.rooms.map((room) => {
    const palette = roomPalette(runtime, room.roomType);
    const cells: Cell[] = [];
    for (let y = room.rect.y; y < room.rect.y + room.rect.height; y++) {
      for (let x = room.rect.x; x < room.rect.x + room.rect.width; x++) {
        cells.push({ x, y });
      }
    }
    const fallback = ROOM_LABELS[room.roomType] ?? { title: room.key, subtitle: '' };
    return {
      roomInstanceId: `room_${room.roomType}`,
      roomType: room.roomType,
      cells,
      rect: { ...room.rect },
      tint: palette.base,
      accent: palette.accent,
      label: room.label ?? { ...fallback },
    };
  });

  const stations: ShipStationView[] = [];
  for (const room of spec.rooms) {
    room.stations.forEach((station, index) => {
      const palette = stationPalette(runtime, station.stationType);
      stations.push({
        stationInstanceId: `station_${room.roomType}_${station.stationType}_${index + 1}`,
        stationType: station.stationType,
        roomInstanceId: `room_${room.roomType}`,
        footprint: station.footprint.map((cell) => ({ ...cell })),
        glow: palette.glow,
      });
    });
  }

  // Walls: blocked cells touching walkable space (4-neighborhood).
  const walls: Cell[] = [];
  const deltas = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  for (let y = 0; y < spec.gridHeight; y++) {
    for (let x = 0; x < spec.gridWidth; x++) {
      if (!grid.isBlocked(x, y)) continue;
      const touchesWalkable = deltas.some((d) => grid.isWalkable(x + d.x, y + d.y));
      if (touchesWalkable) walls.push({ x, y });
    }
  }

  // Spawn cells: walkable, non-station, non-prop, row-major.
  const stationSet = new Set(stations.flatMap((s) => s.footprint.map((c) => `${c.x},${c.y}`)));
  const propSet = new Set(propList.map((p) => `${p.cell.x},${p.cell.y}`));
  const spawnCells: Cell[] = [];
  for (let y = 0; y < spec.gridHeight; y++) {
    for (let x = 0; x < spec.gridWidth; x++) {
      if (grid.isWalkable(x, y) && !stationSet.has(`${x},${y}`) && !propSet.has(`${x},${y}`))
        spawnCells.push({ x, y });
    }
  }

  const mappingLayout: MappingShipLayout = {
    rooms: rooms.map((room) => ({
      roomInstanceId: room.roomInstanceId,
      roomType: room.roomType,
      center: {
        col: room.rect.x + Math.floor(room.rect.width / 2),
        row: room.rect.y + Math.floor(room.rect.height / 2),
      },
    })),
    stations: stations.map((station) => {
      const anchor = station.footprint[0] as Cell;
      return {
        stationInstanceId: station.stationInstanceId,
        stationType: station.stationType,
        roomInstanceId: station.roomInstanceId,
        cell: { col: anchor.x, row: anchor.y },
        available: true,
      };
    }),
  };

  const garden: HouseGardenView | null =
    spec.garden === undefined
      ? null
      : {
          pond: { ...spec.garden.pond },
          trees: spec.garden.trees.map((c) => ({ ...c })),
          lanterns: spec.garden.lanterns.map((c) => ({ ...c })),
          ...(spec.garden.path === undefined ? {} : { path: { ...spec.garden.path } }),
          ...(spec.garden.deck === undefined ? {} : { deck: { ...spec.garden.deck } }),
        };
  const bounds: GridRect = { x: 0, y: 0, width: spec.gridWidth, height: spec.gridHeight };
  const shipView: ShipLayoutView = {
    rooms,
    stations,
    walls,
    gridWidth: spec.gridWidth,
    gridHeight: spec.gridHeight,
    bounds,
    floors: spec.corridors.map((rect) => ({ ...rect })),
    props: propList,
    ...(garden === null ? {} : { garden }),
  };
  return { grid, rooms, stations, walls, spawnCells, mappingLayout, shipView, bounds, garden };
}
