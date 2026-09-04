import type { RoomType, SemanticActivity, StationType } from '@thenexus/contracts';
import type { GridRect } from './grid';
import type { Cell } from './grid';

/**
 * Renderer input views (pixi-free). Produced by `@thenexus/runtime` from the
 * deterministic demo ship; consumed by `WorldRenderer`. World-engine core
 * stays layout-free — all geometry enters through these views.
 */

/** One walkable room region with its semantic type and display tint. */
export interface ShipRoomView {
  roomInstanceId: string;
  roomType: RoomType;
  /** Walkable interior cells (walls/voids excluded). */
  cells: readonly Cell[];
  rect: GridRect;
  /** Base floor tint as 0xRRGGBB (resolved from the theme by the producer). */
  tint: number;
  /** Accent tint as 0xRRGGBB for borders/runes/glyphs. */
  accent: number;
  /**
   * Human-readable room label for the top-down house renderer (e.g.
   * "Planning Room" / "Ideas → Plans"). Optional: the renderer falls back
   * to the room type, and the desktop shell may override per locale through
   * `WorldRenderer.setRoomLabels`.
   */
  label?: { title: string; subtitle: string };
}

/** One interactive station with its blocked footprint and approach anchor. */
export interface ShipStationView {
  stationInstanceId: string;
  stationType: StationType;
  roomInstanceId: string;
  /** Blocked cells the station furniture occupies. */
  footprint: readonly Cell[];
  /** Station glow tint as 0xRRGGBB. */
  glow: number;
}

/** Complete static ship geometry for one renderer layout. */
export interface ShipLayoutView {
  rooms: readonly ShipRoomView[];
  stations: readonly ShipStationView[];
  /** Blocked cells rendered as extruded wall blocks. */
  walls: readonly Cell[];
  gridWidth: number;
  gridHeight: number;
  /** Union bounds of all rooms; drives camera framing/clamping. */
  bounds: GridRect;
  /**
   * Extra wood-floor rects (hallways, corridors) that are walkable but
   * belong to no room. Optional: the renderer draws room floors otherwise.
   */
  floors?: GridRect[];
  /**
   * Japanese garden dressing around a Project House (pond, trees, stone
   * lanterns). Optional: renderers ignore it when absent, and every garden
   * cell is blocked (or an explicit walkable path) so navigation and spawn
   * selection never disagree with what is drawn.
   */
  garden?: HouseGardenView;
  /**
   * Blocked decorative furniture cells (plants, shelves, lamps, chests).
   * Optional: blocked in the grid, excluded from spawns, drawn as
   * furniture instead of wall bands so characters never clip through them.
   */
  props?: readonly HousePropView[];
}

/** One blocked decorative furniture cell inside a room. */
export interface HousePropView {
  cell: Cell;
  kind: 'plant' | 'shelf' | 'lamp' | 'chest';
}

/** World-space garden dressing for a Project House (all cells blocked). */
export interface HouseGardenView {
  /** Still-water pond rect (blocked cells, drawn as water). */
  pond: GridRect;
  /** Canopy anchor cells (blocked): flowering trees. */
  trees: readonly Cell[];
  /** Stone lantern cells (blocked, warm glow at render time). */
  lanterns: readonly Cell[];
  /** Walkable stone-path area (e.g. entrance walk); drawn as stepping stones. */
  path?: GridRect;
  /** Wooden entrance deck (genkan) drawn under the south threshold. */
  deck?: GridRect;
}

/** Per-character presentation joined to `WorldSnapshot` by character id. */
export interface CharacterPresentation {
  id: string;
  /** Short HUD label (crew display name or guest tag). */
  label: string;
  activity: SemanticActivity;
  /**
   * Free-form mapping animation intent (resolves via `resolveSlotForIntent`;
   * falls back to the activity slot). Kept alongside `activity` so the
   * debugger trace and the played animation can never silently diverge.
   */
  animationIntent: string;
  /** Mapping status visibility for this character. */
  statusDisplay: 'always' | 'overview' | 'hidden';
  effectIntent: string | null;
  /** True while the sim reports the character as blocked/waiting. */
  waiting: boolean;
  /** True for Guest Agent fallback characters. */
  isGuest: boolean;
}
