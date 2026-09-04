import type { GridPoint, ScreenPoint, CameraView, Viewport } from './iso';

/**
 * Strict top-down 2D orthographic projection for the Project House renderer.
 *
 * The camera looks vertically downward: world X maps horizontally to screen
 * X and world Y maps vertically to screen Y. Rectangular rooms in world
 * space appear rectangular on screen — no rotation, no diamond transform.
 *
 * One grid cell is a `TOP_TILE_PX` square at zoom 1. Pure arithmetic only:
 * no pixi.js, no DOM, no wall-clock sources. Every function is deterministic
 * and side-effect free so the render layer and headless tests share the
 * exact same projection.
 *
 * The legacy isometric projection in `iso.ts` is intentionally preserved
 * untouched for historical tests; the production/demo renderer for the
 * Project House milestone MUST use this module instead.
 */

/** Screen pixels per grid cell edge at zoom 1. */
export const TOP_TILE_PX = 32;

/** Forward projection: sx = x * TOP_TILE_PX; sy = y * TOP_TILE_PX. */
export function tileToScreen(x: number, y: number): ScreenPoint {
  return { x: x * TOP_TILE_PX, y: y * TOP_TILE_PX };
}

/** Inverse projection: gx = sx / TOP_TILE_PX; gy = sy / TOP_TILE_PX. */
export function screenToTile(sx: number, sy: number): GridPoint {
  return { x: sx / TOP_TILE_PX, y: sy / TOP_TILE_PX };
}

/**
 * World (grid-space) point to viewport pixel:
 * ((p.x - cam.x) * T * zoom + vw/2, (p.y - cam.y) * T * zoom + vh/2).
 */
export function worldToScreenTop(
  p: GridPoint,
  camera: CameraView,
  viewport: Viewport,
): ScreenPoint {
  return {
    x: (p.x - camera.center.x) * TOP_TILE_PX * camera.zoom + viewport.width / 2,
    y: (p.y - camera.center.y) * TOP_TILE_PX * camera.zoom + viewport.height / 2,
  };
}

/** Viewport pixel back to world (grid-space) point; exact inverse. */
export function screenToWorldTop(
  p: ScreenPoint,
  camera: CameraView,
  viewport: Viewport,
): GridPoint {
  return {
    x: (p.x - viewport.width / 2) / (TOP_TILE_PX * camera.zoom) + camera.center.x,
    y: (p.y - viewport.height / 2) / (TOP_TILE_PX * camera.zoom) + camera.center.y,
  };
}

/** Pixel rect of one grid cell in world (pre-camera) space. */
export function cellRectPx(x: number, y: number): { x: number; y: number; w: number; h: number } {
  return { x: x * TOP_TILE_PX, y: y * TOP_TILE_PX, w: TOP_TILE_PX, h: TOP_TILE_PX };
}

/** Center of a cell in world (pre-camera) space (cell-center convention). */
export function cellCenterTop(x: number, y: number): ScreenPoint {
  return { x: (x + 0.5) * TOP_TILE_PX, y: (y + 0.5) * TOP_TILE_PX };
}
