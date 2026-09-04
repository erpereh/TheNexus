import { describe, expect, it } from 'vitest';
import {
  TOP_TILE_PX,
  cellCenterTop,
  cellRectPx,
  screenToTile,
  screenToWorldTop,
  tileToScreen,
  worldToScreenTop,
} from './ortho';

const viewport = { width: 1280, height: 800 };

describe('top-down orthographic projection', () => {
  it('maps world X to screen X and world Y to screen Y with no rotation', () => {
    expect(tileToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(tileToScreen(1, 0)).toEqual({ x: TOP_TILE_PX, y: 0 });
    expect(tileToScreen(0, 1)).toEqual({ x: 0, y: TOP_TILE_PX });
    expect(tileToScreen(2.5, -1)).toEqual({ x: 2.5 * TOP_TILE_PX, y: -TOP_TILE_PX });
  });

  it('inverts exactly (screenToTile ∘ tileToScreen is identity)', () => {
    for (const [x, y] of [
      [0, 0],
      [3.25, 7.5],
      [-4, 12],
      [47.999, 35.001],
    ] as const) {
      const s = tileToScreen(x, y);
      const g = screenToTile(s.x, s.y);
      expect(g.x).toBeCloseTo(x, 12);
      expect(g.y).toBeCloseTo(y, 12);
    }
  });

  it('keeps horizontal walls horizontal and vertical walls vertical', () => {
    const a = tileToScreen(3, 5);
    const b = tileToScreen(9, 5);
    expect(a.y).toBe(b.y); // horizontal stays horizontal
    const c = tileToScreen(4, 2);
    const d = tileToScreen(4, 8);
    expect(c.x).toBe(d.x); // vertical stays vertical
  });

  it('renders rectangular rooms as screen rectangles (axis-aligned)', () => {
    const corners = [
      tileToScreen(3, 3),
      tileToScreen(12, 3),
      tileToScreen(12, 9),
      tileToScreen(3, 9),
    ];
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    expect(Math.min(...xs)).toBe(3 * TOP_TILE_PX);
    expect(Math.max(...xs)).toBe(12 * TOP_TILE_PX);
    expect(Math.min(...ys)).toBe(3 * TOP_TILE_PX);
    expect(Math.max(...ys)).toBe(9 * TOP_TILE_PX);
    // Opposite edges stay parallel to the screen axes.
    expect(corners[0]?.y).toBe(corners[1]?.y);
    expect(corners[0]?.x).toBe(corners[3]?.x);
  });

  it('worldToScreenTop centers the camera and applies zoom', () => {
    const camera = { center: { x: 10, y: 10 }, zoom: 1 };
    const center = worldToScreenTop({ x: 10, y: 10 }, camera, viewport);
    expect(center.x).toBeCloseTo(viewport.width / 2, 9);
    expect(center.y).toBeCloseTo(viewport.height / 2, 9);
    const zoomed = worldToScreenTop(
      { x: 11, y: 10 },
      { center: { x: 10, y: 10 }, zoom: 2 },
      viewport,
    );
    expect(zoomed.x).toBeCloseTo(viewport.width / 2 + TOP_TILE_PX * 2, 9);
    expect(zoomed.y).toBeCloseTo(viewport.height / 2, 9);
  });

  it('screenToWorldTop is the exact inverse of worldToScreenTop', () => {
    const camera = { center: { x: 22.5, y: 17.25 }, zoom: 1.75 };
    for (const p of [
      { x: 0, y: 0 },
      { x: 1280, y: 800 },
      { x: 311, y: 587 },
    ]) {
      const w = screenToWorldTop(p, camera, viewport);
      const back = worldToScreenTop(w, camera, viewport);
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it('exposes cell rects and centers on the cell-center convention', () => {
    expect(cellRectPx(2, 3)).toEqual({ x: 64, y: 96, w: 32, h: 32 });
    expect(cellCenterTop(2, 3)).toEqual({ x: 80, y: 112 });
  });
});
