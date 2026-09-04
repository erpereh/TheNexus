// @thenexus/world-engine core — deterministic headless simulation.
// Provider-neutral, DOM-free and pixi-free. Safe to import from Node,
// vitest and any provider-neutral package (e.g. `@thenexus/runtime`).

export {
  TILE_W,
  TILE_H,
  HALF_W,
  HALF_H,
  DEPTH_SCALE,
  gridToScreen,
  screenToGrid,
  worldToScreen,
  screenToWorld,
  type GridPoint,
  type ScreenPoint,
  type CameraView,
  type Viewport,
} from './core/iso';
export { TileGrid, type Cell, type GridRect } from './core/grid';
export {
  TOP_TILE_PX,
  tileToScreen,
  screenToTile,
  worldToScreenTop,
  screenToWorldTop,
  cellRectPx,
  cellCenterTop,
} from './core/ortho';
export {
  createCharacter,
  facingFromDelta,
  pathRemaining,
  stepCharacter,
  type CharacterState,
  type CharacterStepContext,
  type CharacterStepResult,
  type Facing,
} from './core/character';
export {
  DEPTH_LAYERS,
  DEPTH_LAYER_BIAS,
  DEPTH_ELEVATION_STEP,
  MAX_ELEVATION,
  depthKeyOf,
  sortByDepth,
  type DepthEntry,
  type DepthLayer,
} from './core/depth-sort';
export {
  EventLog,
  type ArrivedEvent,
  type CharacterSpawnedEvent,
  type MovementBlockedEvent,
  type PathAssignedEvent,
  type WorldEvent,
  type WorldEventKind,
} from './core/events';
export {
  NAV_COST_STRAIGHT,
  NAV_COST_DIAGONAL,
  NEIGHBOR_OFFSETS,
  approachCells,
  findPath,
  findPathToTarget,
  inBounds,
  octileHeuristic,
  revalidatePath,
  type NavigationDiagnostic,
  type NavigationGrid,
  type NavigationPath,
} from './core/navigation';
export {
  Camera,
  FOLLOW_RATE_PER_SECOND,
  SHIP_VISIBILITY_MARGIN_PX,
  ZOOM_MAX,
  ZOOM_MIN,
} from './core/camera';
export {
  WorldSim,
  TICK_MS,
  type CharacterSnapshot,
  type CharacterSpec,
  type WorldSnapshot,
} from './core/world-sim';
export { ACTIVITY_TO_SLOT, resolveSlotForIntent, slotForActivity } from './core/activity-map';
export {
  AnimationStateMachine,
  FACING_TO_PACK_DIRECTION,
  frameIndexAt,
  resolveAnimation,
  sheetFrameIndex,
  type AnimationFrameState,
  type AnimationTable,
  type ResolvedAnimation,
} from './core/animation-state';
export { SpatialIndex, type SpatialItem, type SpatialRect } from './core/spatial-index';
export { PerfMonitor, RingBuffer, percentile, type PerfMark } from './core/perf';
export { cssToHex, roomPalette, stationPalette, themeColor } from './core/theme-colors';
export type {
  CharacterPresentation,
  HouseGardenView,
  HousePropView,
  ShipLayoutView,
  ShipRoomView,
  ShipStationView,
} from './core/ship-view';
