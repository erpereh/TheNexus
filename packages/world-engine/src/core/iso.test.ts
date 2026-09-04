import { describe, expect, it } from 'vitest';
import {
  DEPTH_SCALE,
  HALF_H,
  HALF_W,
  TILE_H,
  TILE_W,
  gridToScreen,
  screenToGrid,
  screenToWorld,
  worldToScreen,
} from './iso';

describe('iso projection', () => {
  it('exposes the locked tile constants', () => {
    expect(TILE_W).toBe(64);
    expect(TILE_H).toBe(32);
    expect(HALF_W).toBe(32);
    expect(HALF_H).toBe(16);
    expect(DEPTH_SCALE).toBe(4096);
  });

  it('maps the grid origin to the screen origin', () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('keeps the classic 2:1 tile ratio on every axis-aligned step', () => {
    const east = gridToScreen(1, 0);
    expect(east.x).toBe(HALF_W);
    expect(east.x).toBe(2 * east.y);
    const south = gridToScreen(0, 1);
    expect(-south.x).toBe(2 * south.y);
  });

  it('round-trips every integer cell of a 32x32 grid through screen space', () => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const screen = gridToScreen(x, y);
        const grid = screenToGrid(screen.x, screen.y);
        expect(grid.x).toBe(x);
        expect(grid.y).toBe(y);
      }
    }
  });

  it('worldToScreen centers the camera and applies zoom', () => {
    const camera = { center: { x: 4, y: 4 }, zoom: 1 };
    const viewport = { width: 800, height: 600 };
    const centerScreen = worldToScreen({ x: 4, y: 4 }, camera, viewport);
    expect(centerScreen.x).toBe(400);
    expect(centerScreen.y).toBe(300);
    const zoomed = worldToScreen({ x: 5, y: 4 }, { center: { x: 4, y: 4 }, zoom: 2 }, viewport);
    // one cell east = (HALF_W, HALF_H) screen units; doubled by zoom
    expect(zoomed.x).toBe(400 + 2 * HALF_W);
    expect(zoomed.y).toBe(300 + 2 * HALF_H);
  });

  it('screenToWorld inverts worldToScreen at zoom 1 and 2', () => {
    const viewport = { width: 1024, height: 768 };
    const points = [
      { x: 0, y: 0 },
      { x: 5.5, y: 2.5 },
      { x: -3.25, y: 8.75 },
      { x: 31, y: 31 },
    ];
    for (const zoom of [1, 2]) {
      const camera = { center: { x: 7.5, y: 3.25 }, zoom };
      for (const point of points) {
        const screen = worldToScreen(point, camera, viewport);
        const world = screenToWorld(screen, camera, viewport);
        expect(world.x).toBeCloseTo(point.x, 9);
        expect(world.y).toBeCloseTo(point.y, 9);
      }
    }
  });
});
