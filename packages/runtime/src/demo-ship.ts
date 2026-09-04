import type { RoomType, StationType, ThemeManifest } from '@thenexus/contracts';
import { createThemeRuntime, DEFAULT_THEME } from '@thenexus/asset-system';
import type { MappingShipLayout } from '@thenexus/mapping';
import { roomPalette, stationPalette, TileGrid } from '@thenexus/world-engine/core';
import type { Cell, GridRect } from '@thenexus/world-engine/core';
import type { ShipLayoutView, ShipRoomView, ShipStationView } from '@thenexus/world-engine/core';

/**
 * Deterministic demo ship: 8 semantic rooms (one per `DEFAULT_MAPPING_RULES`
 * room type) plus fallback `generic_workstation` stations, carved into a
 * 40×28 lattice with wall-bounded rooms, door gaps and connecting corridors.
 * No RNG anywhere — the same builder calls always produce the same ship.
 *
 * Original geometry for the vertical slice (not a copy of any game/anime
 * map): three rows of rooms joined by two horizontal concourses and two
 * vertical passages in an arcane-terminal arrangement.
 */

export const DEMO_GRID_WIDTH = 40;
export const DEMO_GRID_HEIGHT = 28;

interface RoomSpec {
  roomType: RoomType;
  rect: GridRect;
  doors: readonly Cell[];
  stations: readonly { stationType: StationType; footprint: readonly Cell[] }[];
}

const ROOM_SPECS: readonly RoomSpec[] = [
  {
    roomType: 'command',
    rect: { x: 2, y: 2, width: 7, height: 5 },
    doors: [
      { x: 5, y: 7 },
      { x: 9, y: 4 },
    ],
    stations: [
      { stationType: 'planning_holo', footprint: [{ x: 5, y: 3 }] },
      { stationType: 'core_console', footprint: [{ x: 6, y: 5 }] },
    ],
  },
  {
    roomType: 'engineering',
    rect: { x: 13, y: 2, width: 9, height: 5 },
    doors: [
      { x: 17, y: 7 },
      { x: 12, y: 4 },
      { x: 22, y: 4 },
    ],
    stations: [
      { stationType: 'coding_workstation', footprint: [{ x: 15, y: 3 }] },
      { stationType: 'coding_workstation', footprint: [{ x: 19, y: 3 }] },
      { stationType: 'generic_workstation', footprint: [{ x: 17, y: 5 }] },
    ],
  },
  {
    roomType: 'laboratory',
    rect: { x: 26, y: 2, width: 7, height: 5 },
    doors: [
      { x: 29, y: 7 },
      { x: 25, y: 4 },
    ],
    stations: [
      {
        stationType: 'test_bench',
        footprint: [
          { x: 28, y: 3 },
          { x: 29, y: 3 },
        ],
      },
    ],
  },
  {
    roomType: 'library',
    rect: { x: 2, y: 11, width: 7, height: 5 },
    doors: [
      { x: 5, y: 10 },
      { x: 5, y: 16 },
      { x: 9, y: 13 },
    ],
    stations: [
      { stationType: 'reading_desk', footprint: [{ x: 4, y: 12 }] },
      { stationType: 'reading_desk', footprint: [{ x: 6, y: 14 }] },
    ],
  },
  {
    roomType: 'observatory',
    rect: { x: 13, y: 11, width: 9, height: 5 },
    doors: [
      { x: 17, y: 10 },
      { x: 17, y: 16 },
      { x: 12, y: 13 },
      { x: 22, y: 13 },
    ],
    stations: [{ stationType: 'research_scope', footprint: [{ x: 17, y: 12 }] }],
  },
  {
    roomType: 'communications',
    rect: { x: 26, y: 11, width: 7, height: 5 },
    doors: [
      { x: 29, y: 10 },
      { x: 29, y: 16 },
      { x: 25, y: 13 },
    ],
    stations: [
      { stationType: 'comm_console', footprint: [{ x: 28, y: 12 }] },
      { stationType: 'comm_console', footprint: [{ x: 30, y: 14 }] },
    ],
  },
  {
    roomType: 'archive',
    rect: { x: 2, y: 20, width: 7, height: 5 },
    doors: [
      { x: 5, y: 19 },
      { x: 9, y: 22 },
    ],
    stations: [{ stationType: 'archive_terminal', footprint: [{ x: 5, y: 21 }] }],
  },
  {
    roomType: 'lounge',
    rect: { x: 13, y: 20, width: 9, height: 5 },
    doors: [
      { x: 17, y: 19 },
      { x: 12, y: 22 },
      { x: 22, y: 22 },
    ],
    stations: [
      { stationType: 'lounge_seat', footprint: [{ x: 15, y: 21 }] },
      { stationType: 'lounge_seat', footprint: [{ x: 19, y: 21 }] },
      { stationType: 'lounge_seat', footprint: [{ x: 17, y: 23 }] },
      { stationType: 'generic_workstation', footprint: [{ x: 20, y: 23 }] },
    ],
  },
];

/** Horizontal concourses + vertical passages (inclusive ranges). */
const CORRIDORS: readonly GridRect[] = [
  { x: 2, y: 8, width: 31, height: 2 }, // H1: x2..32, y8..9
  { x: 2, y: 17, width: 31, height: 2 }, // H2: x2..32, y17..18
  { x: 10, y: 2, width: 2, height: 23 }, // V1: x10..11, y2..24
  { x: 23, y: 2, width: 2, height: 23 }, // V2: x23..24, y2..24
];

export interface DemoShip {
  grid: TileGrid;
  rooms: readonly ShipRoomView[];
  stations: readonly ShipStationView[];
  /** Blocked cells rendered as wall blocks (blocked + adjacent to walkable). */
  walls: readonly Cell[];
  /** Row-major walkable spawn cells (stations excluded). */
  spawnCells: readonly Cell[];
  /** View consumed by `MappingEngine.resolve`. */
  mappingLayout: MappingShipLayout;
  /** View consumed by `WorldRenderer.setLayout`. */
  shipView: ShipLayoutView;
  bounds: GridRect;
}

function stationCellsOf(spec: RoomSpec): Cell[] {
  const cells: Cell[] = [];
  for (const station of spec.stations) {
    for (const cell of station.footprint) cells.push({ ...cell });
  }
  return cells;
}

/** Builds the demo ship, resolving display tints from `theme`. */
export function buildDemoShip(theme: ThemeManifest = DEFAULT_THEME): DemoShip {
  const runtime = createThemeRuntime(theme, [DEFAULT_THEME]);
  const grid = new TileGrid(DEMO_GRID_WIDTH, DEMO_GRID_HEIGHT);
  // Start solid, carve interiors/corridors/doors.
  for (let y = 0; y < DEMO_GRID_HEIGHT; y++) {
    for (let x = 0; x < DEMO_GRID_WIDTH; x++) grid.setBlocked(x, y, true);
  }
  const carve = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < DEMO_GRID_WIDTH && y < DEMO_GRID_HEIGHT)
      grid.setBlocked(x, y, false);
  };
  for (const spec of ROOM_SPECS) {
    for (let y = spec.rect.y; y < spec.rect.y + spec.rect.height; y++) {
      for (let x = spec.rect.x; x < spec.rect.x + spec.rect.width; x++) carve(x, y);
    }
    for (const door of spec.doors) carve(door.x, door.y);
  }
  for (const corridor of CORRIDORS) {
    for (let y = corridor.y; y < corridor.y + corridor.height; y++) {
      for (let x = corridor.x; x < corridor.x + corridor.width; x++) carve(x, y);
    }
  }
  // Station furniture blocks its footprint.
  for (const spec of ROOM_SPECS) {
    for (const cell of stationCellsOf(spec)) grid.setBlocked(cell.x, cell.y, true);
  }

  const rooms: ShipRoomView[] = ROOM_SPECS.map((spec) => {
    const palette = roomPalette(runtime, spec.roomType);
    const cells: Cell[] = [];
    for (let y = spec.rect.y; y < spec.rect.y + spec.rect.height; y++) {
      for (let x = spec.rect.x; x < spec.rect.x + spec.rect.width; x++) {
        cells.push({ x, y });
      }
    }
    return {
      roomInstanceId: `room_${spec.roomType}`,
      roomType: spec.roomType,
      cells,
      rect: { ...spec.rect },
      tint: palette.base,
      accent: palette.accent,
    };
  });

  const stations: ShipStationView[] = [];
  for (const spec of ROOM_SPECS) {
    spec.stations.forEach((station, index) => {
      const palette = stationPalette(runtime, station.stationType);
      stations.push({
        stationInstanceId: `station_${spec.roomType}_${station.stationType}_${index + 1}`,
        stationType: station.stationType,
        roomInstanceId: `room_${spec.roomType}`,
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
  for (let y = 0; y < DEMO_GRID_HEIGHT; y++) {
    for (let x = 0; x < DEMO_GRID_WIDTH; x++) {
      if (!grid.isBlocked(x, y)) continue;
      const touchesWalkable = deltas.some((d) => grid.isWalkable(x + d.x, y + d.y));
      if (touchesWalkable) walls.push({ x, y });
    }
  }

  // Spawn cells: walkable, non-station, row-major (deterministic order).
  const stationSet = new Set(stations.flatMap((s) => s.footprint.map((c) => `${c.x},${c.y}`)));
  const spawnCells: Cell[] = [];
  for (let y = 0; y < DEMO_GRID_HEIGHT; y++) {
    for (let x = 0; x < DEMO_GRID_WIDTH; x++) {
      if (grid.isWalkable(x, y) && !stationSet.has(`${x},${y}`)) spawnCells.push({ x, y });
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

  const bounds: GridRect = { x: 0, y: 0, width: DEMO_GRID_WIDTH, height: DEMO_GRID_HEIGHT };
  const shipView: ShipLayoutView = {
    rooms,
    stations,
    walls,
    gridWidth: DEMO_GRID_WIDTH,
    gridHeight: DEMO_GRID_HEIGHT,
    bounds,
  };
  return { grid, rooms, stations, walls, spawnCells, mappingLayout, shipView, bounds };
}
