import { Container, Graphics } from 'pixi.js';
import type { RoomType } from '@thenexus/contracts';
import { depthKeyOf } from '../core/depth-sort';
import { gridToScreen } from '../core/iso';
import type { Cell } from '../core/grid';
import type { ShipLayoutView, ShipRoomView } from '../core/ship-view';

/**
 * Static ship-structure graphics: per-cell floor diamonds with subtle
 * checker inlay, extruded wall blocks on blocked cells, iso room borders
 * with corner crystals, and a line-art glyph per semantic room type.
 *
 * Everything here is baked once per `setLayout` into a few `Graphics`
 * objects (one draw call each); only station/character layers animate.
 */

/** Wall block height in screen pixels. */
export const WALL_HEIGHT_PX = 20;

/** Screen corners of a cell diamond, clockwise from the top corner. */
function cellDiamond(x: number, y: number): { x: number; y: number }[] {
  return [
    gridToScreen(x + 0.5, y),
    gridToScreen(x + 1, y + 0.5),
    gridToScreen(x + 0.5, y + 1),
    gridToScreen(x, y + 0.5),
  ];
}

function traceDiamond(g: Graphics, x: number, y: number): void {
  const [a, b, c, d] = cellDiamond(x, y) as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).lineTo(d.x, d.y).closePath();
}

/** Small line-art glyph identifying the room's semantic purpose. */
function drawRoomGlyph(g: Graphics, roomType: RoomType, cx: number, cy: number, s: number): void {
  switch (roomType) {
    case 'command': // four-point star
      g.moveTo(cx, cy - s)
        .lineTo(cx + s * 0.28, cy - s * 0.28)
        .lineTo(cx + s, cy)
        .lineTo(cx + s * 0.28, cy + s * 0.28)
        .lineTo(cx, cy + s)
        .lineTo(cx - s * 0.28, cy + s * 0.28)
        .lineTo(cx - s, cy)
        .lineTo(cx - s * 0.28, cy - s * 0.28)
        .closePath();
      break;
    case 'engineering': // hexagon nut
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + Math.cos(a) * s;
        const py = cy + Math.sin(a) * s;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath().circle(cx, cy, s * 0.35);
      break;
    case 'laboratory': // flask triangle + neck
      g.moveTo(cx - s * 0.7, cy + s * 0.7)
        .lineTo(cx + s * 0.7, cy + s * 0.7)
        .lineTo(cx + s * 0.2, cy - s * 0.2)
        .lineTo(cx + s * 0.2, cy - s * 0.7)
        .lineTo(cx - s * 0.2, cy - s * 0.7)
        .lineTo(cx - s * 0.2, cy - s * 0.2)
        .closePath();
      break;
    case 'library': // open book
      g.moveTo(cx - s, cy - s * 0.5)
        .lineTo(cx, cy - s * 0.2)
        .lineTo(cx + s, cy - s * 0.5)
        .lineTo(cx + s, cy + s * 0.5)
        .lineTo(cx, cy + s * 0.8)
        .lineTo(cx - s, cy + s * 0.5)
        .closePath()
        .moveTo(cx, cy - s * 0.2)
        .lineTo(cx, cy + s * 0.8);
      break;
    case 'observatory': // lens + crosshair
      g.circle(cx, cy, s * 0.7)
        .moveTo(cx - s, cy)
        .lineTo(cx + s, cy)
        .moveTo(cx, cy - s)
        .lineTo(cx, cy + s);
      break;
    case 'communications': // broadcast arcs
      g.circle(cx, cy, s * 0.25);
      for (const r of [0.55, 0.85]) {
        g.arc(cx, cy, s * r, -Math.PI * 0.35, Math.PI * 0.35).stroke();
        g.arc(cx, cy, s * r, Math.PI * 0.65, Math.PI * 1.35).stroke();
      }
      break;
    case 'archive': // stacked slabs
      for (let i = -1; i <= 1; i++) {
        g.rect(cx - s * 0.8, cy + i * s * 0.55 - s * 0.16, s * 1.6, s * 0.32);
      }
      break;
    case 'lounge': // crescent
      g.arc(cx, cy, s * 0.8, Math.PI * 0.3, Math.PI * 1.7).stroke();
      g.circle(cx + s * 0.35, cy - s * 0.25, s * 0.18);
      break;
    case 'generic_workstation': // plain diamond marker
      g.moveTo(cx, cy - s * 0.7)
        .lineTo(cx + s * 0.7, cy)
        .lineTo(cx, cy + s * 0.7)
        .lineTo(cx - s * 0.7, cy)
        .closePath();
      break;
  }
}

export interface BakedShip {
  container: Container;
}

function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

/** Bakes floors, walls, borders and glyphs for a layout. */
export function bakeShipStructure(layout: ShipLayoutView): BakedShip {
  const container = new Container();
  container.label = 'ship-structure';
  container.cullableChildren = false;

  // Ground plane (flat decals under every entity): drawn before all z-keys.
  const floors = new Graphics();
  floors.label = 'floors';
  const trim = new Graphics();
  trim.label = 'trim';
  for (const room of layout.rooms) {
    bakeRoomFloors(floors, room);
  }
  for (const room of layout.rooms) {
    bakeRoomTrim(trim, room);
  }
  floors.zIndex = -1;
  trim.zIndex = 0;
  container.addChild(floors);
  container.addChild(trim);

  // Walls need per-row z-keys so characters interleave correctly with blocks.
  for (const row of groupWallsByRow(layout.walls)) {
    const walls = new Graphics();
    walls.label = `walls-row-${row.key}`;
    bakeWallRow(walls, row.cells);
    const sample = row.cells[0] as Cell;
    walls.zIndex = depthKeyOf({
      id: `walls-row-${row.key}`,
      layer: 'walls',
      occupiedCells: [sample],
    });
    container.addChild(walls);
  }
  return { container };
}

function bakeRoomFloors(floors: Graphics, room: ShipRoomView): void {
  const inlay = shade(room.tint, 1.12);
  room.cells.forEach((cell, i) => {
    traceDiamond(floors, cell.x, cell.y);
    // Subtle checker inlay so large floors read as panels, not flat color.
    floors.fill({ color: i % 2 === 0 ? room.tint : inlay, alpha: 1 });
  });
}

/** Groups wall cells by screen row (x + y) for per-row z-ordering. */
function groupWallsByRow(wallCells: readonly Cell[]): { key: number; cells: Cell[] }[] {
  const rows = new Map<number, Cell[]>();
  for (const cell of wallCells) {
    const key = cell.x + cell.y;
    const row = rows.get(key);
    if (row === undefined) rows.set(key, [{ ...cell }]);
    else row.push({ ...cell });
  }
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, cells]) => ({
      key,
      cells: cells.sort((a, b) => a.x - b.x || a.y - b.y),
    }));
}

function bakeWallRow(walls: Graphics, cells: readonly Cell[]): void {
  for (const cell of cells) {
    const [top, right, bottom, left] = cellDiamond(cell.x, cell.y) as [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
    ];
    const base = 0x2a3568;
    // Left + right faces (extruded downward on screen).
    walls
      .moveTo(left.x, left.y)
      .lineTo(bottom.x, bottom.y)
      .lineTo(bottom.x, bottom.y + WALL_HEIGHT_PX)
      .lineTo(left.x, left.y + WALL_HEIGHT_PX)
      .closePath()
      .fill({ color: shade(base, 0.7), alpha: 1 });
    walls
      .moveTo(bottom.x, bottom.y)
      .lineTo(right.x, right.y)
      .lineTo(right.x, right.y + WALL_HEIGHT_PX)
      .lineTo(bottom.x, bottom.y + WALL_HEIGHT_PX)
      .closePath()
      .fill({ color: shade(base, 0.55), alpha: 1 });
    // Top face + rune-lit rim.
    traceDiamond(walls, cell.x, cell.y);
    walls.fill({ color: shade(base, 1.25), alpha: 1 });
    walls.circle(top.x, top.y, 2).fill({ color: 0x54e0ff, alpha: 0.9 });
  }
}

function bakeRoomTrim(trim: Graphics, room: ShipRoomView): void {
  const { rect } = room;
  const corners = [
    gridToScreen(rect.x, rect.y),
    gridToScreen(rect.x + rect.width, rect.y),
    gridToScreen(rect.x + rect.width, rect.y + rect.height),
    gridToScreen(rect.x, rect.y + rect.height),
  ];
  const [a, b, c, d] = corners as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  trim
    .moveTo(a.x, a.y)
    .lineTo(b.x, b.y)
    .lineTo(c.x, c.y)
    .lineTo(d.x, d.y)
    .closePath()
    .stroke({ width: 2, color: room.accent, alpha: 0.85 });
  // Corner crystals.
  for (const p of corners) {
    trim
      .moveTo(p.x, p.y - 5)
      .lineTo(p.x + 4, p.y)
      .lineTo(p.x, p.y + 5)
      .lineTo(p.x - 4, p.y)
      .closePath()
      .fill({ color: room.accent, alpha: 0.95 });
  }
  // Centered semantic glyph.
  const center = gridToScreen(rect.x + rect.width / 2, rect.y + rect.height / 2);
  trim.setStrokeStyle({ width: 2, color: room.accent, alpha: 0.9 });
  drawRoomGlyph(trim, room.roomType, center.x, center.y, 14);
  trim.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
}
