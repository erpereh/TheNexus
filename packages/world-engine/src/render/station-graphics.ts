import { Container, Graphics } from 'pixi.js';
import { depthKeyOf } from '../core/depth-sort';
import { gridToScreen } from '../core/iso';
import type { ShipStationView } from './ship-view';

/**
 * Procedural station furniture: a dais platform plus a per-type console
 * built from original arcane-tech shapes (pedestals, holo screens, crystal
 * orbs, scopes, benches, seats). Each station owns one container with a
 * correct `zIndex` (far-corner station layer) and an `update(timeMs)` hook
 * for subtle idle motion (hologram rotation, crystal pulse).
 */

export interface StationNode {
  container: Container;
  update: (timeMs: number) => void;
}

/** Screen-space center of a cell (cell-center convention). */
function cellCenter(x: number, y: number): { x: number; y: number } {
  return gridToScreen(x + 0.5, y + 0.5);
}

function diamond(g: Graphics, cx: number, cy: number, hw: number, hh: number): void {
  g.moveTo(cx, cy - hh)
    .lineTo(cx + hw, cy)
    .lineTo(cx, cy + hh)
    .lineTo(cx - hw, cy)
    .closePath();
}

/** Footprint center in screen space (average of footprint cell centers). */
function footprintCenter(footprint: readonly { x: number; y: number }[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const cell of footprint) {
    const p = cellCenter(cell.x, cell.y);
    sx += p.x;
    sy += p.y;
  }
  const n = Math.max(1, footprint.length);
  return { x: sx / n, y: sy / n };
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

  const { x: cx, y: cy } = footprintCenter(station.footprint);
  const glow = station.glow;
  const baseColor = 0x232a55;

  // Dais platform under every station.
  diamond(base, cx, cy, 30, 15);
  base.fill({ color: baseColor, alpha: 1 });
  diamond(base, cx, cy, 30, 15);
  base.stroke({ width: 1.5, color: glow, alpha: 0.7 });

  let update: (timeMs: number) => void = () => undefined;
  switch (station.stationType) {
    case 'coding_workstation':
      drawConsoleDesk(body, cx, cy, glow);
      update = holoScreenPulse(fx, cx, cy - 26, glow);
      break;
    case 'test_bench':
      drawBench(body, cx, cy, glow);
      update = runePulse(fx, cx, cy - 8, glow);
      break;
    case 'reading_desk':
      drawDesk(body, cx, cy, glow);
      drawBook(body, cx, cy - 10, glow);
      break;
    case 'research_scope':
      update = drawScope(body, fx, cx, cy, glow);
      break;
    case 'planning_holo':
      drawPedestal(body, cx, cy, glow);
      update = holoDiamond(fx, cx, cy - 30, glow);
      break;
    case 'comm_console':
      drawConsoleDesk(body, cx, cy, glow);
      update = broadcastArcs(fx, cx, cy - 24, glow);
      break;
    case 'archive_terminal':
      drawPillar(body, cx, cy, glow);
      break;
    case 'lounge_seat':
      drawSeat(body, cx, cy, glow);
      break;
    case 'core_console':
      drawPedestal(body, cx, cy, glow);
      update = orbPulse(fx, cx, cy - 26, glow);
      break;
    case 'generic_workstation':
      drawDaisMark(body, cx, cy, glow);
      break;
  }
  return { container, update };
}

function drawConsoleDesk(g: Graphics, cx: number, cy: number, glow: number): void {
  // Desk slab (front face + top) with a glowing terminal slit.
  g.moveTo(cx - 20, cy - 4)
    .lineTo(cx + 20, cy - 4)
    .lineTo(cx + 20, cy + 6)
    .lineTo(cx - 20, cy + 6)
    .closePath()
    .fill({ color: 0x2c3468, alpha: 1 });
  g.moveTo(cx - 20, cy - 4)
    .lineTo(cx, cy - 12)
    .lineTo(cx + 20, cy - 4)
    .lineTo(cx, cy + 4)
    .closePath()
    .fill({ color: 0x3a4488, alpha: 1 });
  // Upright holo screen.
  g.rect(cx - 12, cy - 44, 24, 22).fill({ color: 0x0b1030, alpha: 0.92 });
  g.rect(cx - 12, cy - 44, 24, 22).stroke({ width: 1.5, color: glow, alpha: 0.9 });
}

function holoScreenPulse(fx: Graphics, cx: number, cy: number, glow: number): (t: number) => void {
  return (timeMs: number) => {
    const a = 0.35 + 0.25 * Math.sin(timeMs / 480);
    fx.clear();
    fx.rect(cx - 9, cy - 8 + 16, 18, 3).fill({ color: glow, alpha: a });
    fx.rect(cx - 9, cy - 3 + 16, 12, 3).fill({ color: glow, alpha: a * 0.8 });
  };
}

function drawBench(g: Graphics, cx: number, cy: number, glow: number): void {
  g.moveTo(cx - 26, cy - 6)
    .lineTo(cx + 26, cy - 6)
    .lineTo(cx + 26, cy + 2)
    .lineTo(cx - 26, cy + 2)
    .closePath()
    .fill({ color: 0x28455e, alpha: 1 });
  for (const dx of [-16, 16]) {
    g.rect(cx + dx - 2, cy + 2, 4, 10).fill({ color: 0x1a2c3d, alpha: 1 });
  }
  // Diagnostic rune strip on the bench top.
  for (let i = 0; i < 4; i++) {
    diamond(g, cx - 15 + i * 10, cy - 6, 3.4, 1.8);
    g.fill({ color: glow, alpha: 0.85 });
  }
}

function runePulse(fx: Graphics, cx: number, cy: number, glow: number): (t: number) => void {
  return (timeMs: number) => {
    const a = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(timeMs / 700));
    fx.clear();
    fx.circle(cx, cy, 4 + 2 * Math.sin(timeMs / 700)).stroke({ width: 2, color: glow, alpha: a });
  };
}

function drawDesk(g: Graphics, cx: number, cy: number, glow: number): void {
  diamond(g, cx, cy - 4, 18, 9);
  g.fill({ color: 0x3a3568, alpha: 1 });
  diamond(g, cx, cy - 4, 18, 9);
  g.stroke({ width: 1.5, color: glow, alpha: 0.8 });
}

function drawBook(g: Graphics, cx: number, cy: number, glow: number): void {
  g.moveTo(cx - 8, cy - 4)
    .lineTo(cx, cy - 1)
    .lineTo(cx + 8, cy - 4)
    .lineTo(cx + 8, cy + 3)
    .lineTo(cx, cy + 6)
    .lineTo(cx - 8, cy + 3)
    .closePath()
    .fill({ color: 0xc9a3ff, alpha: 0.95 });
  g.moveTo(cx, cy - 1)
    .lineTo(cx, cy + 6)
    .stroke({ width: 1, color: glow, alpha: 0.9 });
}

function drawScope(
  body: Graphics,
  fx: Graphics,
  cx: number,
  cy: number,
  glow: number,
): (timeMs: number) => void {
  // Tripod + angled tube pointing up-right; lens glint shimmers.
  body.setStrokeStyle({ width: 3, color: 0x22294f, alpha: 1 });
  body
    .moveTo(cx, cy)
    .lineTo(cx - 10, cy + 12)
    .stroke();
  body
    .moveTo(cx, cy)
    .lineTo(cx + 10, cy + 12)
    .stroke();
  body
    .moveTo(cx, cy)
    .lineTo(cx, cy + 12)
    .stroke();
  body.setStrokeStyle({ width: 5, color: 0x3a4488, alpha: 1 });
  body
    .moveTo(cx - 4, cy - 6)
    .lineTo(cx + 12, cy - 22)
    .stroke();
  body.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
  return (timeMs: number) => {
    fx.clear();
    const a = 0.5 + 0.4 * Math.sin(timeMs / 900);
    fx.circle(cx + 12, cy - 22, 3).fill({ color: glow, alpha: a });
  };
}

function drawPedestal(g: Graphics, cx: number, cy: number, glow: number): void {
  g.moveTo(cx - 10, cy)
    .lineTo(cx + 10, cy)
    .lineTo(cx + 6, cy - 18)
    .lineTo(cx - 6, cy - 18)
    .closePath()
    .fill({ color: 0x31346b, alpha: 1 });
  diamond(g, cx, cy - 18, 9, 4.5);
  g.stroke({ width: 1.5, color: glow, alpha: 0.9 });
}

function holoDiamond(fx: Graphics, cx: number, cy: number, glow: number): (t: number) => void {
  return (timeMs: number) => {
    fx.clear();
    const w = 8 + 2 * Math.sin(timeMs / 600);
    const h = 14 + 3 * Math.cos(timeMs / 750);
    const bob = 2 * Math.sin(timeMs / 800);
    fx.moveTo(cx, cy - h + bob)
      .lineTo(cx + w, cy + bob)
      .lineTo(cx, cy + h + bob)
      .lineTo(cx - w, cy + bob)
      .closePath()
      .stroke({ width: 1.5, color: glow, alpha: 0.85 });
  };
}

function broadcastArcs(fx: Graphics, cx: number, cy: number, glow: number): (t: number) => void {
  return (timeMs: number) => {
    fx.clear();
    fx.circle(cx, cy, 2.5).fill({ color: glow, alpha: 0.95 });
    for (let i = 0; i < 2; i++) {
      const phase = (timeMs / 900 + i * 0.5) % 1;
      const r = 5 + phase * 10;
      fx.circle(cx, cy, r).stroke({ width: 1.5, color: glow, alpha: 0.7 * (1 - phase) });
    }
  };
}

function drawPillar(g: Graphics, cx: number, cy: number, glow: number): void {
  g.rect(cx - 8, cy - 40, 16, 40).fill({ color: 0x252743, alpha: 1 });
  g.rect(cx - 8, cy - 40, 16, 40).stroke({ width: 1.5, color: glow, alpha: 0.8 });
  for (let i = 0; i < 3; i++) {
    g.rect(cx - 5, cy - 34 + i * 9, 10, 4).fill({ color: glow, alpha: 0.5 });
  }
}

function drawSeat(g: Graphics, cx: number, cy: number, glow: number): void {
  // Crescent lounge cushion.
  g.ellipse(cx, cy - 4, 16, 8).fill({ color: 0x2b2850, alpha: 1 });
  g.ellipse(cx, cy - 4, 16, 8).stroke({ width: 1.5, color: glow, alpha: 0.85 });
  g.ellipse(cx - 3, cy - 7, 8, 4).fill({ color: 0xff7eb0, alpha: 0.35 });
}

function orbPulse(fx: Graphics, cx: number, cy: number, glow: number): (t: number) => void {
  return (timeMs: number) => {
    fx.clear();
    const r = 6 + 1.5 * Math.sin(timeMs / 650);
    fx.circle(cx, cy, r + 4).stroke({ width: 1.5, color: glow, alpha: 0.35 });
    diamond(fx, cx, cy, r, r * 1.3);
    fx.fill({ color: glow, alpha: 0.9 });
  };
}

function drawDaisMark(g: Graphics, cx: number, cy: number, glow: number): void {
  diamond(g, cx, cy - 2, 10, 5);
  g.stroke({ width: 2, color: glow, alpha: 0.9 });
}
