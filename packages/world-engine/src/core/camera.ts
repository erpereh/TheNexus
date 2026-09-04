import { gridToScreen, screenToGrid, screenToWorld } from './iso';
import type { GridPoint, ScreenPoint, Viewport } from './iso';
import type { GridRect } from './grid';

/**
 * Deterministic isometric camera: zoom clamping, cursor-anchored zooming,
 * exponential follow smoothing, bbox framing and a "ship never fully leaves
 * the viewport" guarantee. Pure math over grid-space centers; the render
 * layer reads center/zoom and projects through `worldToScreen`.
 */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

/** Follow rate of the exponential smoother, per second (plan: e^-8 dt). */
export const FOLLOW_RATE_PER_SECOND = 8;

/**
 * Screen-space pixels of the ship that must stay inside the viewport. The
 * clamp keeps exactly this many pixels of overlap, so "fully off-screen" is
 * impossible while still allowing the ship to rest at the very edge.
 */
export const SHIP_VISIBILITY_MARGIN_PX = 1;

function clampZoom(zoom: number): number {
  if (Number.isNaN(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

export class Camera {
  center: GridPoint;
  zoom: number;
  private shipBounds: GridRect | null = null;

  constructor(center: GridPoint = { x: 0, y: 0 }, zoom = 1) {
    this.center = { x: center.x, y: center.y };
    this.zoom = clampZoom(zoom);
  }

  /** Structural snapshot for `worldToScreen`/`screenToWorld`. */
  view(): { center: GridPoint; zoom: number } {
    return { center: { x: this.center.x, y: this.center.y }, zoom: this.zoom };
  }

  /**
   * Declares the region that must never fully leave the viewport. `rect` is
   * in grid cells (e.g. the union of all room bounding boxes).
   */
  setShipBounds(rect: GridRect): void {
    this.shipBounds = { ...rect };
  }

  /**
   * Zooms while keeping the world point under `screenPoint` fixed: the world
   * position is sampled before the change, then the center is solved so the
   * same world position projects back onto the same pixel afterwards.
   */
  zoomAt(screenPoint: ScreenPoint, nextZoom: number, viewport: Viewport): void {
    const worldBefore = screenToWorld(screenPoint, this.view(), viewport);
    this.zoom = clampZoom(nextZoom);
    const worldScreen = gridToScreen(worldBefore.x, worldBefore.y);
    const camX = worldScreen.x - (screenPoint.x - viewport.width / 2) / this.zoom;
    const camY = worldScreen.y - (screenPoint.y - viewport.height / 2) / this.zoom;
    this.setCenterFromScreen(camX, camY);
    this.enforceShipVisible(viewport);
  }

  /**
   * Drags the world by screen-space pixels: moving the pointer right (+dx)
   * shifts the camera center left in screen space, as with grab-panning.
   */
  panBy(dxScreen: number, dyScreen: number, viewport: Viewport): void {
    const cam = gridToScreen(this.center.x, this.center.y);
    this.setCenterFromScreen(cam.x - dxScreen / this.zoom, cam.y - dyScreen / this.zoom);
    this.enforceShipVisible(viewport);
  }

  /**
   * Exponential follow: center += (target - center) * (1 - e^(-8*dt)). This
   * is the closed-form step of the ODE d(offset)/dt = -8*offset, so the
   * result after total time T is identical for any frame-rate split.
   * `dtMs` is clamped at zero; follow never runs the ship-visibility clamp
   * because it always moves toward a point inside the ship.
   */
  followTo(target: GridPoint, dtMs: number): void {
    if (!(dtMs > 0)) return;
    const t = 1 - Math.exp(-FOLLOW_RATE_PER_SECOND * (dtMs / 1000));
    this.center = {
      x: this.center.x + (target.x - this.center.x) * t,
      y: this.center.y + (target.y - this.center.y) * t,
    };
  }

  /**
   * Fits and centers the camera on the bounding box of `cells` (e.g. a room)
   * at a zoom within [ZOOM_MIN, ZOOM_MAX]. Empty input is a no-op; a
   * zero-area bbox recenters without zooming. Best effort when the room is
   * too large to fit at ZOOM_MIN.
   */
  frameCells(cells: readonly GridPoint[], viewport: Viewport): void {
    if (cells.length === 0) return;
    let minGX = Number.POSITIVE_INFINITY;
    let maxGX = Number.NEGATIVE_INFINITY;
    let minGY = Number.POSITIVE_INFINITY;
    let maxGY = Number.NEGATIVE_INFINITY;
    for (const cell of cells) {
      if (cell.x < minGX) minGX = cell.x;
      if (cell.x > maxGX) maxGX = cell.x;
      if (cell.y < minGY) minGY = cell.y;
      if (cell.y > maxGY) maxGY = cell.y;
    }
    const corners: GridPoint[] = [
      { x: minGX, y: minGY },
      { x: maxGX, y: minGY },
      { x: minGX, y: maxGY },
      { x: maxGX, y: maxGY },
    ];
    const screenCorners = corners.map((c) => gridToScreen(c.x, c.y));
    const minX = Math.min(...screenCorners.map((p) => p.x));
    const maxX = Math.max(...screenCorners.map((p) => p.x));
    const minY = Math.min(...screenCorners.map((p) => p.y));
    const maxY = Math.max(...screenCorners.map((p) => p.y));
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw > 0 && bh > 0) {
      this.zoom = clampZoom(Math.min(viewport.width / bw, viewport.height / bh));
    } else if (bw > 0) {
      this.zoom = clampZoom(viewport.width / bw);
    } else if (bh > 0) {
      this.zoom = clampZoom(viewport.height / bh);
    }
    this.setCenterFromScreen((minX + maxX) / 2, (minY + maxY) / 2);
    this.enforceShipVisible(viewport);
  }

  private setCenterFromScreen(camX: number, camY: number): void {
    const g = screenToGrid(camX, camY);
    this.center = { x: g.x, y: g.y };
  }

  /**
   * Clamps the center (in screen space) so at least SHIP_VISIBILITY_MARGIN_PX
   * of the ship AABB stays inside the viewport. For the ship screen range
   * [(minSX - camX)*z + vw/2, (maxSX - camX)*z + vw/2] staying on-screen with
   * a 1px margin solves to
   *   camX in [minSX - (vw/2 - m)/z, maxSX + (vw/2 - m)/z]
   * and symmetrically for Y. No-op without ship bounds or on tiny viewports.
   */
  private enforceShipVisible(viewport: Viewport): void {
    const bounds = this.shipBounds;
    if (bounds === null) return;
    const corners: GridPoint[] = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ];
    const screenCorners = corners.map((c) => gridToScreen(c.x, c.y));
    const minSX = Math.min(...screenCorners.map((p) => p.x));
    const maxSX = Math.max(...screenCorners.map((p) => p.x));
    const minSY = Math.min(...screenCorners.map((p) => p.y));
    const maxSY = Math.max(...screenCorners.map((p) => p.y));
    const marginX = viewport.width / 2 - SHIP_VISIBILITY_MARGIN_PX;
    const marginY = viewport.height / 2 - SHIP_VISIBILITY_MARGIN_PX;
    const cam = gridToScreen(this.center.x, this.center.y);
    if (marginX > 0) {
      cam.x = Math.min(maxSX + marginX / this.zoom, Math.max(minSX - marginX / this.zoom, cam.x));
    }
    if (marginY > 0) {
      cam.y = Math.min(maxSY + marginY / this.zoom, Math.max(minSY - marginY / this.zoom, cam.y));
    }
    this.setCenterFromScreen(cam.x, cam.y);
  }
}
