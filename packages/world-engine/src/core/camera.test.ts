import { describe, expect, it } from 'vitest';
import { Camera, ZOOM_MAX, ZOOM_MIN } from './camera';
import { gridToScreen, screenToWorld, worldToScreen, type GridPoint } from './iso';

const viewport = { width: 800, height: 600 };

/** Screen-space AABB of a grid rect under a camera (min/max over corners). */
function screenBounds(rect: { x: number; y: number; width: number; height: number }, cam: Camera) {
  const corners: GridPoint[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
  const points = corners.map((c) => worldToScreen(c, cam, viewport));
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

describe('Camera', () => {
  it('zoomAt anchors the world point under the cursor', () => {
    const cam = new Camera({ x: 10, y: 10 }, 1);
    const cursor = worldToScreen({ x: 10.5, y: 10.25 }, cam, viewport);
    cam.zoomAt(cursor, 2, viewport);
    expect(cam.zoom).toBe(2);
    const world = screenToWorld(cursor, cam, viewport);
    expect(world.x).toBeCloseTo(10.5, 9);
    expect(world.y).toBeCloseTo(10.25, 9);
  });

  it('clamps zoom into [0.5, 3] on construction and zooming', () => {
    expect(new Camera({ x: 0, y: 0 }, 99).zoom).toBe(ZOOM_MAX);
    expect(new Camera({ x: 0, y: 0 }, 0.001).zoom).toBe(ZOOM_MIN);
    const cam = new Camera({ x: 0, y: 0 }, 1);
    cam.zoomAt({ x: 0, y: 0 }, 50, viewport);
    expect(cam.zoom).toBe(ZOOM_MAX);
    cam.zoomAt({ x: 0, y: 0 }, -5, viewport);
    expect(cam.zoom).toBe(ZOOM_MIN);
  });

  it('panning can never push the ship fully off-screen', () => {
    const bounds = { x: 0, y: 0, width: 10, height: 10 };
    const assertShipVisible = (cam: Camera) => {
      const b = screenBounds(bounds, cam);
      expect(b.minX).toBeLessThan(viewport.width);
      expect(b.maxX).toBeGreaterThan(0);
      expect(b.minY).toBeLessThan(viewport.height);
      expect(b.maxY).toBeGreaterThan(0);
    };
    const right = new Camera({ x: 5, y: 5 }, 1);
    right.setShipBounds(bounds);
    right.panBy(1_000_000, 0, viewport);
    assertShipVisible(right);
    const down = new Camera({ x: 5, y: 5 }, 1);
    down.setShipBounds(bounds);
    down.panBy(0, 1_000_000, viewport);
    assertShipVisible(down);
    const topLeft = new Camera({ x: 5, y: 5 }, 1);
    topLeft.setShipBounds(bounds);
    topLeft.panBy(-1_000_000, -1_000_000, viewport);
    assertShipVisible(topLeft);
    // zooming out at the clamped edge must not break the guarantee either
    right.zoomAt({ x: 0, y: 0 }, ZOOM_MAX, viewport);
    assertShipVisible(right);
  });

  it('exponential follow is frame-rate independent', () => {
    const target = { x: 20, y: 4 };
    const perFrame = new Camera({ x: 0, y: 0 }, 1);
    for (let i = 0; i < 60; i++) perFrame.followTo(target, 1000 / 60);
    const single = new Camera({ x: 0, y: 0 }, 1);
    single.followTo(target, 1000);
    expect(perFrame.center.x).toBeCloseTo(single.center.x, 9);
    expect(perFrame.center.y).toBeCloseTo(single.center.y, 9);
    expect(single.center.x).toBeCloseTo(20 * (1 - Math.exp(-8)), 9);
    expect(single.center.y).toBeCloseTo(4 * (1 - Math.exp(-8)), 9);
    const stationary = new Camera({ x: 1, y: 1 }, 1);
    stationary.followTo({ x: 9, y: 9 }, 0);
    expect(stationary.center).toEqual({
      x: 1,
      y: 1,
    });
  });

  it('frameCells fits the room bounding box and centers it', () => {
    const cells: GridPoint[] = [];
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 9; x++) cells.push({ x, y });
    }
    const cam = new Camera({ x: 0, y: 0 }, 1);
    cam.frameCells(cells, viewport);
    expect(cam.zoom).toBeCloseTo(2.5, 9);
    expect(cam.center.x).toBeCloseTo(5.5, 9);
    expect(cam.center.y).toBeCloseTo(3.5, 9);
    for (const cell of cells) {
      const s = worldToScreen(cell, cam, viewport);
      expect(s.x).toBeGreaterThanOrEqual(-0.001);
      expect(s.x).toBeLessThanOrEqual(viewport.width + 0.001);
      expect(s.y).toBeGreaterThanOrEqual(-0.001);
      expect(s.y).toBeLessThanOrEqual(viewport.height + 0.001);
    }
  });

  it('frameCells keeps zoom for degenerate inputs and clamps huge rooms', () => {
    const cam = new Camera({ x: 3, y: 3 }, 1.5);
    cam.frameCells([], viewport);
    expect(cam.zoom).toBe(1.5);
    cam.frameCells([{ x: 3, y: 3 }], viewport);
    expect(cam.zoom).toBe(1.5); // zero-area bbox: center only
    expect(cam.center.x).toBeCloseTo(3, 9);
    expect(cam.center.y).toBeCloseTo(3, 9);
    cam.frameCells(
      [
        { x: 0, y: 0 },
        { x: 200, y: 200 },
      ],
      viewport,
    );
    expect(cam.zoom).toBe(ZOOM_MIN); // cannot fit: clamped, best effort
  });
});

describe('camera helpers', () => {
  it('gridToScreen stays available for ship bounds math', () => {
    expect(gridToScreen(1, 0)).toEqual({ x: 32, y: 16 });
  });
});
