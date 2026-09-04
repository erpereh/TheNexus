import { Container, Graphics } from 'pixi.js';
import { depthKeyOf } from '../core/depth-sort';
import { TOP_TILE_PX } from '../core/ortho';
import type { ShipStationView } from '../core/ship-view';

/**
 * Top-down Japanese studio furniture: desks, monitors, bookshelves, sofas,
 * server racks, test benches and study tables drawn axis-aligned from each
 * station footprint. Original cozy-studio shapes (wood + paper + warm
 * lamplight + cool monitor glow); no sprite sheets yet — the Asset Studio
 * milestone swaps these procedural bodies for pack art behind the same
 * `StationNode` interface.
 */

const T = TOP_TILE_PX;

export interface StationNode {
  container: Container;
  update: (timeMs: number) => void;
}

/** Pixel bounds of a footprint (average center + full rect). */
function footprintPx(footprint: readonly { x: number; y: number }[]): {
  cx: number;
  cy: number;
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const cell of footprint) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x + 1);
    maxY = Math.max(maxY, cell.y + 1);
  }
  return {
    cx: ((minX + maxX) / 2) * T,
    cy: ((minY + maxY) / 2) * T,
    x: minX * T,
    y: minY * T,
    w: (maxX - minX) * T,
    h: (maxY - minY) * T,
  };
}

const WOOD = 0x8a5f3c;
const WOOD_DARK = 0x6b4426;
const PAPER = 0xf5efe0;
const SCREEN = 0x1c2333;
const SCREEN_GLOW = 0x6fc3ff;

/** Soft ground shadow under the furniture. */
function shadow(g: Graphics, cx: number, cy: number, w: number, h: number): void {
  g.ellipse(cx, cy + h / 2 - 2, w / 2 + 3, 5).fill({ color: 0x000000, alpha: 0.22 });
}

/** Tiny bonsai on a desk corner (warm green accent, blocked-cell safe). */
function bonsai(g: Graphics, x: number, y: number): void {
  g.rect(x - 3, y - 1, 6, 5).fill({ color: 0x6e4e2e, alpha: 1 });
  g.circle(x, y - 5, 5).fill({ color: 0x4c8f40, alpha: 1 });
  g.circle(x - 3, y - 3, 3).fill({ color: 0x5da24c, alpha: 1 });
}

/** Open book / paper sheets. */
function papers(g: Graphics, x: number, y: number, w = 12): void {
  g.rect(x, y, w, 8).fill({ color: PAPER, alpha: 1 });
  g.rect(x + 1, y + 2, w - 2, 1).fill({ color: 0xb9b3a4, alpha: 1 });
  g.rect(x + 1, y + 5, w - 2, 1).fill({ color: 0xb9b3a4, alpha: 1 });
}

/** Monitor with a cool glowing code screen (top-down: dark slab + glow). */
function monitor(g: Graphics, x: number, y: number, w = 22): void {
  g.roundRect(x, y, w, 12, 2).fill({ color: SCREEN, alpha: 1 });
  g.rect(x + 3, y + 3, w - 6, 4).fill({ color: SCREEN_GLOW, alpha: 0.85 });
  g.rect(x + 3, y + 8, (w - 6) * 0.6, 1.5).fill({ color: SCREEN_GLOW, alpha: 0.5 });
}

export function buildStation(station: ShipStationView): StationNode {
  const container = new Container();
  container.label = `station:${station.stationInstanceId}`;
  container.cullable = true;
  container.zIndex = depthKeyOf({
    id: station.stationInstanceId,
    layer: 'stations',
    occupiedCells: station.footprint,
  });

  const base = new Graphics();
  const body = new Graphics();
  const fx = new Graphics();
  container.addChild(base, body, fx);

  const r = footprintPx(station.footprint);
  const glow = station.glow;
  shadow(base, r.cx, r.cy, r.w, r.h);

  let update: (timeMs: number) => void = () => undefined;
  switch (station.stationType) {
    case 'coding_workstation':
      drawDesk(body, r, glow);
      monitor(body, r.cx - 11, r.y + 3);
      papers(body, r.cx - 6, r.y + r.h - 12, 10);
      bonsai(body, r.x + r.w - 7, r.y + 8);
      update = screenFlicker(fx, r.cx - 11, r.y + 3, 22, glow);
      break;
    case 'generic_workstation':
      drawDesk(body, r, glow);
      monitor(body, r.cx - 8, r.y + 5, 16);
      update = screenFlicker(fx, r.cx - 8, r.y + 5, 16, glow);
      break;
    case 'test_bench':
      drawBench(body, r, glow);
      update = ledBlink(fx, r, glow);
      break;
    case 'reading_desk':
      drawRoundTable(body, r);
      papers(body, r.cx - 7, r.cy - 4, 14);
      drawCushion(body, r.cx - r.w / 2 + 2, r.cy + r.h / 2 - 8);
      drawCushion(body, r.cx + r.w / 2 - 12, r.cy + r.h / 2 - 8);
      break;
    case 'research_scope':
      drawDesk(body, r, glow);
      drawGlobe(body, r.cx + r.w / 2 - 10, r.cy - 2);
      papers(body, r.cx - r.w / 2 + 3, r.cy - 3, 11);
      monitor(body, r.cx - r.w / 2 + 3, r.y + 3, 15);
      update = screenFlicker(fx, r.cx - r.w / 2 + 3, r.y + 3, 15, glow);
      break;
    case 'planning_holo':
      drawPlanTable(body, r, glow);
      update = stickyShimmer(fx, r, glow);
      break;
    case 'comm_console':
      drawDesk(body, r, glow);
      monitor(body, r.x + 3, r.y + 3, 13);
      monitor(body, r.x + r.w - 16, r.y + 3, 13);
      drawHeadset(body, r.cx, r.cy + 4);
      update = broadcastPulse(fx, r.cx, r.cy - 2, glow);
      break;
    case 'archive_terminal':
      drawServer(body, r, glow);
      update = ledBlink(fx, r, glow);
      break;
    case 'lounge_seat':
      drawSofa(body, r, glow);
      break;
    case 'core_console':
      drawDesk(body, r, glow);
      monitor(body, r.cx - 11, r.y + 2, 22);
      drawDial(body, r.cx, r.cy + 6, glow);
      update = screenFlicker(fx, r.cx - 11, r.y + 2, 22, glow);
      break;
  }
  return { container, update };
}

function drawDesk(
  g: Graphics,
  r: { x: number; y: number; w: number; h: number; cx: number; cy: number },
  glow: number,
): void {
  g.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 3).fill({ color: WOOD, alpha: 1 });
  g.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 3).stroke({
    width: 1.5,
    color: WOOD_DARK,
    alpha: 1,
  });
  g.rect(r.x + 3, r.y + r.h - 6, r.w - 6, 2).fill({ color: glow, alpha: 0.35 });
  // Chair tucked at the south edge.
  g.roundRect(r.cx - 7, r.y + r.h - 7, 14, 7, 3).fill({ color: 0x4a5468, alpha: 1 });
}

function drawBench(
  g: Graphics,
  r: { x: number; y: number; w: number; h: number; cx: number; cy: number },
  glow: number,
): void {
  g.roundRect(r.x, r.y + 2, r.w, r.h - 4, 3).fill({ color: 0x5e7f8a, alpha: 1 });
  g.roundRect(r.x, r.y + 2, r.w, r.h - 4, 3).stroke({ width: 1.5, color: 0x3d565e, alpha: 1 });
  // Devices under test + QA monitor.
  const n = Math.max(1, Math.floor(r.w / 22));
  for (let i = 0; i < n; i++) {
    const dx = r.x + 5 + i * ((r.w - 10) / n);
    g.roundRect(dx, r.cy - 7, 12, 12, 2).fill({ color: SCREEN, alpha: 1 });
    g.circle(dx + 3, r.cy - 4, 1.6).fill({ color: 0x5dffa9, alpha: 1 });
    g.circle(dx + 8, r.cy - 4, 1.6).fill({ color: glow, alpha: 1 });
  }
}

function drawRoundTable(g: Graphics, r: { cx: number; cy: number; w: number; h: number }): void {
  const rad = Math.min(r.w, r.h) / 2 - 1;
  g.circle(r.cx, r.cy, rad).fill({ color: WOOD, alpha: 1 });
  g.circle(r.cx, r.cy, rad).stroke({ width: 1.5, color: WOOD_DARK, alpha: 1 });
  g.circle(r.cx, r.cy, rad - 5).stroke({ width: 1, color: 0xf5efe0, alpha: 0.5 });
}

function drawCushion(g: Graphics, x: number, y: number): void {
  g.roundRect(x, y, 10, 8, 3).fill({ color: 0xb65e6e, alpha: 1 });
  g.roundRect(x, y, 10, 8, 3).stroke({ width: 1, color: 0x7d3f4b, alpha: 1 });
}

function drawGlobe(g: Graphics, x: number, y: number): void {
  g.rect(x - 1, y + 4, 14, 3).fill({ color: WOOD_DARK, alpha: 1 });
  g.circle(x + 6, y, 6).fill({ color: 0x3f8aa8, alpha: 1 });
  g.circle(x + 4, y - 2, 2.5).fill({ color: 0x5da24c, alpha: 1 });
}

function drawPlanTable(
  g: Graphics,
  r: { x: number; y: number; w: number; h: number; cx: number; cy: number },
  glow: number,
): void {
  g.roundRect(r.x, r.y + 2, r.w, r.h - 4, 5).fill({ color: 0x9a6f42, alpha: 1 });
  g.roundRect(r.x, r.y + 2, r.w, r.h - 4, 5).stroke({ width: 2, color: WOOD_DARK, alpha: 1 });
  // Planning board sheet + sticky notes.
  g.rect(r.cx - r.w / 4, r.cy - 7, r.w / 2, 14).fill({ color: PAPER, alpha: 1 });
  const notes = [0xff9ecf, 0xffe27a, 0x9ed8ff, 0xb8f0a8];
  notes.forEach((color, i) => {
    const nx = r.cx - r.w / 4 + 3 + i * ((r.w / 2 - 6) / 4);
    g.rect(nx, r.cy - 4, 6, 6).fill({ color, alpha: 1 });
  });
  g.rect(r.cx - r.w / 4, r.cy + 4, r.w / 2, 1.5).fill({ color: glow, alpha: 0.4 });
  // Cushions around the table.
  drawCushion(g, r.x + 2, r.y + r.h - 9);
  drawCushion(g, r.x + r.w - 12, r.y + r.h - 9);
}

function drawHeadset(g: Graphics, x: number, y: number): void {
  g.circle(x, y, 5).stroke({ width: 2, color: 0x2b2f45, alpha: 1 });
  g.circle(x - 5, y + 1, 2).fill({ color: 0xff9ecf, alpha: 1 });
  g.circle(x + 5, y + 1, 2).fill({ color: 0xff9ecf, alpha: 1 });
}

function drawServer(
  g: Graphics,
  r: { x: number; y: number; w: number; h: number },
  glow: number,
): void {
  g.roundRect(r.x + 1, r.y, r.w - 2, r.h, 2).fill({ color: 0x232839, alpha: 1 });
  g.roundRect(r.x + 1, r.y, r.w - 2, r.h, 2).stroke({ width: 1.5, color: glow, alpha: 0.7 });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      g.circle(r.x + 8 + col * 12, r.y + 7 + row * 7, 2).fill({ color: 0x5dffa9, alpha: 0.9 });
    }
  }
  // Archive boxes beside the rack.
  g.rect(r.x + r.w - 9, r.y + r.h - 9, 8, 8).fill({ color: 0x9a6f42, alpha: 1 });
  g.rect(r.x + r.w - 9, r.y + r.h - 12, 8, 2).fill({ color: WOOD_DARK, alpha: 1 });
}

function drawSofa(
  g: Graphics,
  r: { x: number; y: number; w: number; h: number; cx: number },
  glow: number,
): void {
  g.roundRect(r.x + 1, r.y + 2, r.w - 2, r.h - 4, 7).fill({ color: 0x4a4a5e, alpha: 1 });
  g.roundRect(r.x + 1, r.y + 2, r.w - 2, r.h - 4, 7).stroke({
    width: 1.5,
    color: 0x33333f,
    alpha: 1,
  });
  // Seat cushions + backrest.
  g.roundRect(r.x + 4, r.y + 5, r.w - 8, 8, 3).fill({ color: 0x5e5e74, alpha: 1 });
  g.rect(r.cx - 1, r.y + 6, 2, r.h - 12).fill({ color: 0x33333f, alpha: 0.8 });
  g.circle(r.x + 6, r.y + 6, 2).fill({ color: glow, alpha: 0.5 });
}

function drawDial(g: Graphics, x: number, y: number, glow: number): void {
  g.circle(x, y, 5).fill({ color: SCREEN, alpha: 1 });
  g.circle(x, y, 5).stroke({ width: 1.5, color: glow, alpha: 0.9 });
  g.rect(x - 1, y - 4, 2, 4).fill({ color: glow, alpha: 0.9 });
}

function screenFlicker(
  fx: Graphics,
  x: number,
  y: number,
  w: number,
  glow: number,
): (timeMs: number) => void {
  return (timeMs: number) => {
    const a = 0.25 + 0.2 * Math.sin(timeMs / 420 + x);
    fx.clear();
    fx.rect(x + 3, y + 3, (w - 6) * (0.4 + 0.3 * (0.5 + 0.5 * Math.sin(timeMs / 900))), 1.6).fill({
      color: glow,
      alpha: a + 0.3,
    });
  };
}

function ledBlink(
  fx: Graphics,
  r: { x: number; y: number; w: number; cy: number },
  glow: number,
): (timeMs: number) => void {
  return (timeMs: number) => {
    fx.clear();
    const on = Math.sin(timeMs / 600) > 0;
    fx.circle(r.x + r.w - 6, r.cy, 2.4).fill({ color: glow, alpha: on ? 0.95 : 0.25 });
  };
}

function stickyShimmer(
  fx: Graphics,
  r: { cx: number; cy: number },
  glow: number,
): (timeMs: number) => void {
  return (timeMs: number) => {
    fx.clear();
    const a = 0.3 + 0.25 * Math.sin(timeMs / 700);
    fx.circle(r.cx, r.cy - 10, 2.5).fill({ color: glow, alpha: a });
  };
}

function broadcastPulse(
  fx: Graphics,
  cx: number,
  cy: number,
  glow: number,
): (timeMs: number) => void {
  return (timeMs: number) => {
    fx.clear();
    for (let i = 0; i < 2; i++) {
      const phase = (timeMs / 1100 + i * 0.5) % 1;
      fx.circle(cx, cy, 4 + phase * 9).stroke({
        width: 1.2,
        color: glow,
        alpha: 0.6 * (1 - phase),
      });
    }
  };
}
