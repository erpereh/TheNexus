import type { ThemeManifest } from '@thenexus/contracts';
import { DEFAULT_THEME } from '@thenexus/asset-system';
import type { MappingShipLayout } from '@thenexus/mapping';
import type { Cell, GridRect, TileGrid } from '@thenexus/world-engine/core';
import type { ShipLayoutView, ShipRoomView, ShipStationView } from '@thenexus/world-engine/core';
import { buildHouse, THENEXUS_HOUSE } from './project-house';

/**
 * Deterministic demo world: the default TheNexus Project House (one
 * Japanese studio house per project, 8 semantic rooms, garden with pond).
 *
 * Compatibility wrapper over `buildHouse(THENEXUS_HOUSE)` so the existing
 * `WorldSession` pipeline, tests and desktop surface keep working
 * unchanged: simulator → bus → MappingEngine → crew → A* → WorldSim.
 * No RNG anywhere — the same builder calls always produce the same house.
 */

export const DEMO_GRID_WIDTH = THENEXUS_HOUSE.gridWidth;
export const DEMO_GRID_HEIGHT = THENEXUS_HOUSE.gridHeight;

export interface DemoShip {
  grid: TileGrid;
  rooms: readonly ShipRoomView[];
  stations: readonly ShipStationView[];
  /** Blocked cells rendered as walls (blocked + adjacent to walkable). */
  walls: readonly Cell[];
  /** Row-major walkable spawn cells (stations excluded). */
  spawnCells: readonly Cell[];
  /** View consumed by `MappingEngine.resolve`. */
  mappingLayout: MappingShipLayout;
  /** View consumed by `WorldRenderer.setLayout`. */
  shipView: ShipLayoutView;
  bounds: GridRect;
}

/** Builds the demo house, resolving display tints from `theme`. */
export function buildDemoShip(theme: ThemeManifest = DEFAULT_THEME): DemoShip {
  const built = buildHouse(THENEXUS_HOUSE, theme);
  return {
    grid: built.grid,
    rooms: built.rooms,
    stations: built.stations,
    walls: built.walls,
    spawnCells: built.spawnCells,
    mappingLayout: built.mappingLayout,
    shipView: built.shipView,
    bounds: built.bounds,
  };
}
