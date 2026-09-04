/**
 * Isometric projection math for the 2.5D world (design spec sections 7-8).
 *
 * Pure arithmetic only: no pixi.js, no DOM, no wall-clock sources. Every
 * function is deterministic and side-effect free so the render layer and the
 * headless tests share the exact same projection.
 */

/** Full tile width on screen, in pixels. */
export const TILE_W = 64;
/** Full tile height on screen, in pixels (classic 2:1 isometric ratio). */
export const TILE_H = 32;
/** Horizontal half-tile: screen offset per unit of grid x (and -y). */
export const HALF_W = TILE_W / 2;
/** Vertical half-tile: screen offset per unit of (x + y). */
export const HALF_H = TILE_H / 2;
/**
 * Screen-depth units per grid row (x + y). Must strictly exceed the largest
 * layer bias + elevation encoding so a single row step always sorts in front
 * of everything on previous rows.
 */
export const DEPTH_SCALE = 4096;

/** A point in continuous grid space (x/y may be fractional). */
export interface GridPoint {
  x: number;
  y: number;
}

/** A point in screen space (pixels). */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Structural camera view; satisfied by the full `Camera` class. */
export interface CameraView {
  center: GridPoint;
  zoom: number;
}

/** Structural viewport size in pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** Forward projection: sx = (x - y) * HALF_W; sy = (x + y) * HALF_H. */
export function gridToScreen(x: number, y: number): ScreenPoint {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

/** Inverse projection: gx = (sx / HALF_W + sy / HALF_H) / 2; gy = (sy / HALF_H - sx / HALF_W) / 2. */
export function screenToGrid(sx: number, sy: number): GridPoint {
  return {
    x: (sx / HALF_W + sy / HALF_H) / 2,
    y: (sy / HALF_H - sx / HALF_W) / 2,
  };
}

/**
 * World (grid-space) point to viewport pixel:
 * ((sx - camSX) * zoom + vw/2, (sy - camSY) * zoom + vh/2) with
 * camSX/Y = gridToScreen(camera.center).
 */
export function worldToScreen(p: GridPoint, camera: CameraView, viewport: Viewport): ScreenPoint {
  const cam = gridToScreen(camera.center.x, camera.center.y);
  const pt = gridToScreen(p.x, p.y);
  return {
    x: (pt.x - cam.x) * camera.zoom + viewport.width / 2,
    y: (pt.y - cam.y) * camera.zoom + viewport.height / 2,
  };
}

/** Viewport pixel back to world (grid-space) point; exact inverse of `worldToScreen`. */
export function screenToWorld(p: ScreenPoint, camera: CameraView, viewport: Viewport): GridPoint {
  const cam = gridToScreen(camera.center.x, camera.center.y);
  const sx = (p.x - viewport.width / 2) / camera.zoom + cam.x;
  const sy = (p.y - viewport.height / 2) / camera.zoom + cam.y;
  return screenToGrid(sx, sy);
}
