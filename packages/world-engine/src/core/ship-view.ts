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
