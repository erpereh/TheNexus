import { Container, Graphics, Text } from 'pixi.js';
import type { RoomType } from '@thenexus/contracts';
import { depthKeyOf } from '../core/depth-sort';
import { TOP_TILE_PX } from '../core/ortho';
import type { Cell } from '../core/grid';
import type { HousePropView, ShipLayoutView, ShipRoomView } from '../core/ship-view';

/**
 * Static Project House graphics, baked once per `setLayout`: garden ground
 * (grass, pond, stone path, trees, lanterns), warm wood room floors with
 * tatami/rug inlays, dark wall bands with noren door curtains, and floating
 * room-label pills. Strict top-down 2D — every rect stays axis-aligned.
 *
 * Everything static lands in a handful of `Graphics` objects (one draw call
 * each); only station/character layers animate. Labels are live `Text`
 * nodes so the desktop shell can re-localize them without re-baking.
 */

const T = TOP_TILE_PX;

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

export interface RoomLabelNode {
  roomInstanceId: string;
  container: Container;
  bg: Graphics;
  title: Text;
  subtitle: Text;
}

export interface BakedShip {
  container: Container;
  labels: RoomLabelNode[];
}

export function layoutLabel(
  roomInstanceId: string,
  node: RoomLabelNode,
  title: string,
  subtitle: string,
): void {
  node.roomInstanceId = roomInstanceId;
  node.title.text = title;
  node.subtitle.text = subtitle;
  const w = Math.max(node.title.width, node.subtitle.width) + 28;
  const h = node.title.height + node.subtitle.height + 18;
  node.bg.clear();
  node.bg.roundRect(-w / 2, -h / 2, w, h, 8);
  node.bg.fill({ color: 0x1a1e30, alpha: 0.85 });
  node.bg.roundRect(-w / 2, -h / 2, w, h, 8);
  node.bg.stroke({ width: 1.5, color: 0x8a7a5c, alpha: 0.9 });
  node.title.position.set(0, -h / 2 + 9 + node.title.height / 2);
  node.subtitle.position.set(0, -h / 2 + 9 + node.title.height + 4 + node.subtitle.height / 2);
}

/** Bakes garden, floors, walls, doors and labels for a house layout. */
export function bakeShipStructure(layout: ShipLayoutView): BakedShip {
  const container = new Container();
  container.label = 'house-structure';
  container.cullableChildren = false;

  const wallSet = new Set(layout.walls.map((c) => `${c.x},${c.y}`));
  const roomOf = new Map<string, ShipRoomView>();
  for (const room of layout.rooms) {
    for (const cell of room.cells) roomOf.set(`${cell.x},${cell.y}`, room);
  }

  const ground = new Graphics();
  ground.label = 'ground';
  bakeGardenGround(ground, layout);
  ground.zIndex = -2;
  container.addChild(ground);

  const floors = new Graphics();
  floors.label = 'floors';
  if (layout.floors !== undefined) {
    for (const rect of layout.floors) bakeWoodRect(floors, rect);
  }
  for (const room of layout.rooms) bakeRoomFloor(floors, room);
  floors.zIndex = -1;
  container.addChild(floors);

  const walls = new Graphics();
  walls.label = 'walls';
  const propSet = new Set((layout.props ?? []).map((p) => `${p.cell.x},${p.cell.y}`));
  bakeWalls(
    walls,
    layout.walls.filter((c) => !propSet.has(`${c.x},${c.y}`)),
    wallSet,
  );
  bakeProps(walls, layout.props ?? []);
  const wallSample = layout.walls[0] as Cell | undefined;
  walls.zIndex =
    wallSample === undefined
      ? depthKeyOf({ id: 'walls', layer: 'walls', occupiedCells: [] })
      : depthKeyOf({ id: 'walls', layer: 'walls', occupiedCells: [wallSample] });
  container.addChild(walls);

  const doors = new Graphics();
  doors.label = 'doors';
  bakeDoors(doors, layout, wallSet, roomOf);
  doors.zIndex = 1;
  container.addChild(doors);

  const labels: RoomLabelNode[] = [];
  const stationSet = new Set(
    layout.stations.flatMap((s) => s.footprint.map((c) => `${c.x},${c.y}`)),
  );
  for (const room of layout.rooms) {
    const node = makeRoomLabel(room);
    // Decals layer at a station-free band anchor: under characters, above
    // floors, and never stamped over furniture.
    const anchor = labelAnchor(room, stationSet);
    node.container.position.set(anchor.x, anchor.y);
    node.container.zIndex = depthKeyOf({
      id: `label:${room.roomInstanceId}`,
      layer: 'decals',
      occupiedCells: [{ x: room.rect.x, y: room.rect.y }],
    });
    container.addChild(node.container);
    labels.push(node);
  }
  return { container, labels };
}

/**
 * Label anchor: center of the longest station-free row run inside the
 * room (ties break toward the room middle), so floor pills never stamp
 * over desks, servers or sofas. Deterministic per layout.
 */
function labelAnchor(room: ShipRoomView, stationSet: Set<string>): { x: number; y: number } {
  const { x, y, width, height } = room.rect;
  const occupied = new Set<number>();
  for (const cell of room.cells) {
    if (stationSet.has(`${cell.x},${cell.y}`)) occupied.add(cell.y);
  }
  const runs: { from: number; to: number }[] = [];
  let start: number | null = null;
  for (let row = y; row < y + height; row++) {
    if (!occupied.has(row)) {
      if (start === null) start = row;
    } else if (start !== null) {
      runs.push({ from: start, to: row - 1 });
      start = null;
    }
  }
  if (start !== null) runs.push({ from: start, to: y + height - 1 });
  const middle = y + height / 2;
  let best = runs[0] ?? { from: y, to: y + height - 1 };
  for (const run of runs) {
    const len = run.to - run.from;
    const bestLen = best.to - best.from;
    const center = (run.from + run.to + 1) / 2;
    const bestCenter = (best.from + best.to + 1) / 2;
    if (
      len > bestLen ||
      (len === bestLen && Math.abs(center - middle) < Math.abs(bestCenter - middle))
    ) {
      best = run;
    }
  }
  return {
    x: (x + width / 2) * T,
    y: ((best.from + best.to + 1) / 2) * T,
  };
}

function makeRoomLabel(room: ShipRoomView): RoomLabelNode {
  const container = new Container();
  container.label = `label:${room.roomInstanceId}`;
  const bg = new Graphics();
  const title = new Text({
    text: room.label?.title ?? room.roomType,
    style: {
      fontFamily: 'system-ui, "Segoe UI", sans-serif',
      fontSize: 13,
      fontWeight: '700',
      fill: 0xf5efe0,
      align: 'center',
    },
  });
  title.anchor.set(0.5, 0.5);
  const subtitle = new Text({
    text: room.label?.subtitle ?? '',
    style: {
      fontFamily: 'system-ui, "Segoe UI", sans-serif',
      fontSize: 10,
      fill: 0xcfc6ae,
      align: 'center',
    },
  });
  subtitle.anchor.set(0.5, 0.5);
  container.addChild(bg, title, subtitle);
  const node: RoomLabelNode = {
    roomInstanceId: room.roomInstanceId,
    container,
    bg,
    title,
    subtitle,
  };
  layoutLabel(
    room.roomInstanceId,
    node,
    room.label?.title ?? room.roomType,
    room.label?.subtitle ?? '',
  );
  return node;
}

// ---------------------------------------------------------------------------
// Garden
// ---------------------------------------------------------------------------

function bakeGardenGround(g: Graphics, layout: ShipLayoutView): void {
  const W = layout.gridWidth * T;
  const H = layout.gridHeight * T;
  const margin = 4 * T;
  // Grass base with deterministic two-tone checker + speckles.
  g.rect(-margin, -margin, W + margin * 2, H + margin * 2).fill({ color: 0x5f9e4e, alpha: 1 });
  const rng = lcg(20260904);
  const cols = layout.gridWidth + 8;
  const rows = layout.gridHeight + 8;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rng();
      if (r < 0.28) {
        g.rect((x - 4) * T, (y - 4) * T, T, T).fill({ color: 0x579247, alpha: 1 });
      } else if (r > 0.94) {
        g.circle((x - 4) * T + rng() * T, (y - 4) * T + rng() * T, 2.2).fill({
          color: 0x4c8540,
          alpha: 0.8,
        });
      }
    }
  }
  // Mown edge around the house footprint: slightly lighter lawn.
  g.rect(0, 0, W, H).fill({ color: 0x69aa56, alpha: 0.35 });

  const garden = layout.garden;
  if (garden?.deck !== undefined) {
    const d = garden.deck;
    g.rect(d.x * T, d.y * T, d.width * T, d.height * T).fill({ color: 0x9a6f42, alpha: 1 });
    for (let i = 0; i < d.width; i++) {
      g.rect((d.x + i) * T + 1, d.y * T + 1, 2, d.height * T - 2).fill({
        color: 0x7d5732,
        alpha: 1,
      });
    }
  }
  if (garden?.path !== undefined) {
    const p = garden.path;
    const prng = lcg(77);
    for (let y = p.y; y < p.y + p.height; y++) {
      for (let x = p.x; x < p.x + p.width; x++) {
        const jx = (prng() - 0.5) * 6;
        const jy = (prng() - 0.5) * 6;
        g.roundRect(x * T + 3 + jx, y * T + 4 + jy, T - 6, T - 8, 6).fill({
          color: 0xb9b3a4,
          alpha: 1,
        });
        g.roundRect(x * T + 3 + jx, y * T + 4 + jy, T - 6, T - 8, 6).stroke({
          width: 1.5,
          color: 0x8f897a,
          alpha: 1,
        });
      }
    }
  }
  if (garden !== undefined) {
    // Pond: stone rim, still water, lily pads.
    const p = garden.pond;
    g.roundRect(p.x * T - 4, p.y * T - 4, p.width * T + 8, p.height * T + 8, 10).fill({
      color: 0x8f8b7e,
      alpha: 1,
    });
    g.roundRect(p.x * T, p.y * T, p.width * T, p.height * T, 8).fill({
      color: 0x2f6b8a,
      alpha: 1,
    });
    g.roundRect(p.x * T + 5, p.y * T + 5, p.width * T - 10, p.height * T - 10, 6).fill({
      color: 0x3f8aa8,
      alpha: 1,
    });
    const lrng = lcg(913);
    for (let i = 0; i < 5; i++) {
      const lx = p.x * T + 12 + lrng() * (p.width * T - 24);
      const ly = p.y * T + 12 + lrng() * (p.height * T - 24);
      g.circle(lx, ly, 5 + lrng() * 3).fill({ color: 0x5fae5f, alpha: 1 });
      if (lrng() > 0.5) g.circle(lx + 2, ly - 2, 2).fill({ color: 0xf2c7dd, alpha: 1 });
    }
    // Trees: trunk + layered canopy; the last tree blooms pink (sakura).
    garden.trees.forEach((cell, index) => {
      const cx = (cell.x + 0.5) * T;
      const cy = (cell.y + 0.5) * T;
      const blossom = index === garden.trees.length - 1;
      g.circle(cx, cy + 6, 4).fill({ color: 0x6b4a2f, alpha: 1 });
      const canopy: [number, number, number, number][] = blossom
        ? [
            [0xf2a7c3, 0, -4, 15],
            [0xe98bb0, -9, 2, 10],
            [0xf7c3d8, 9, 1, 10],
          ]
        : [
            [0x3e7a35, 0, -4, 14],
            [0x4c8f40, -9, 2, 9],
            [0x5da24c, 9, 1, 9],
          ];
      for (const [color, dx, dy, r] of canopy) {
        g.circle(cx + dx, cy + dy, r).fill({ color, alpha: 1 });
      }
    });
    // Stone lanterns: pedestal + warm glowing window + halo.
    for (const cell of garden.lanterns) {
      const cx = (cell.x + 0.5) * T;
      const cy = (cell.y + 0.5) * T;
      g.circle(cx, cy, 11).fill({ color: 0xffe9b0, alpha: 0.18 });
      g.rect(cx - 5, cy + 2, 10, 8).fill({ color: 0x9aa0ad, alpha: 1 });
      g.rect(cx - 6, cy - 8, 12, 10).fill({ color: 0x878d9a, alpha: 1 });
      g.rect(cx - 3, cy - 6, 6, 6).fill({ color: 0xffca7a, alpha: 1 });
      g.rect(cx - 8, cy - 11, 16, 4).fill({ color: 0x6f7582, alpha: 1 });
    }
  }
}

// ---------------------------------------------------------------------------
// Room floors
// ---------------------------------------------------------------------------

const WOOD_BASE = 0xc49a68;
const WOOD_LINE = 0xa87f52;

function bakeWoodRect(
  g: Graphics,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const px = rect.x * T;
  const py = rect.y * T;
  const w = rect.width * T;
  const h = rect.height * T;
  g.rect(px, py, w, h).fill({ color: WOOD_BASE, alpha: 1 });
  for (let row = 0; row < rect.height * 2; row++) {
    const ry = py + row * (T / 2);
    if (row % 2 === 1) g.rect(px, ry, w, T / 2).fill({ color: shade(WOOD_BASE, 0.96), alpha: 1 });
    g.rect(px, ry, w, 1.5).fill({ color: WOOD_LINE, alpha: 0.8 });
  }
}

function bakeRoomFloor(g: Graphics, room: ShipRoomView): void {
  const { x, y, width, height } = room.rect;
  const px = x * T;
  const py = y * T;
  const w = width * T;
  const h = height * T;
  // Warm wood base.
  g.rect(px, py, w, h).fill({ color: WOOD_BASE, alpha: 1 });
  // Plank rows: alternating subtle shades + seams.
  for (let row = 0; row < height * 2; row++) {
    const ry = py + row * (T / 2);
    if (row % 2 === 1) g.rect(px, ry, w, T / 2).fill({ color: shade(WOOD_BASE, 0.96), alpha: 1 });
    g.rect(px, ry, w, 1.5).fill({ color: WOOD_LINE, alpha: 0.8 });
    // Staggered butt joints.
    const joints = row % 2 === 0 ? [0.33, 0.72] : [0.18, 0.55, 0.88];
    for (const j of joints) {
      g.rect(px + w * j, ry, 1.5, T / 2).fill({ color: WOOD_LINE, alpha: 0.7 });
    }
  }
  // Room-type inlays.
  switch (room.roomType as RoomType) {
    case 'lounge':
    case 'library':
      bakeTatami(g, px + 10, py + 10, w - 20, h - 20);
      break;
    default:
      break;
  }
  switch (room.roomType as RoomType) {
    case 'command':
      bakeRug(g, px + w * 0.16, py + h * 0.2, w * 0.68, h * 0.6, 0x5a6e9e, room.accent);
      break;
    case 'lounge':
      bakeRug(g, px + w * 0.2, py + h * 0.42, w * 0.6, h * 0.42, 0x8a5f6b, room.accent);
      bakeLowTable(g, px + w / 2, py + h * 0.63);
      break;
    case 'observatory':
      bakeRug(g, px + w * 0.55, py + h * 0.12, w * 0.36, h * 0.4, 0x5e7f8a, room.accent);
      break;
    case 'library':
      bakeShelfStrip(g, px + 6, py + 4, w - 12);
      break;
    case 'archive':
      bakeShelfStrip(g, px + 6, py + 4, w - 12);
      break;
    default:
      break;
  }
}

function bakeTatami(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.roundRect(x, y, w, h, 6).fill({ color: 0xd9d0a3, alpha: 1 });
  g.roundRect(x, y, w, h, 6).stroke({ width: 3, color: 0x5c6e4e, alpha: 1 });
  // Straw weave: fine horizontal lines + half-mat seam.
  for (let ly = y + 6; ly < y + h - 4; ly += 6) {
    g.rect(x + 4, ly, w - 8, 1).fill({ color: 0xc4b985, alpha: 0.9 });
  }
  g.rect(x + w / 2, y + 4, 2, h - 8).fill({ color: 0x5c6e4e, alpha: 0.8 });
}

function bakeRug(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number,
  trim: number,
): void {
  g.roundRect(x, y, w, h, 8).fill({ color: base, alpha: 0.92 });
  g.roundRect(x, y, w, h, 8).stroke({ width: 2.5, color: trim, alpha: 0.9 });
  g.roundRect(x + 7, y + 7, w - 14, h - 14, 5).stroke({ width: 1.5, color: 0xf5efe0, alpha: 0.55 });
}

function bakeLowTable(g: Graphics, cx: number, cy: number): void {
  g.roundRect(cx - 26, cy - 12, 52, 24, 4).fill({ color: 0x7d5732, alpha: 1 });
  g.roundRect(cx - 26, cy - 12, 52, 24, 4).stroke({ width: 2, color: 0x5d3f22, alpha: 1 });
  // Tea set: two cups + pot dots.
  g.circle(cx - 12, cy, 4).fill({ color: 0xf5efe0, alpha: 1 });
  g.circle(cx + 12, cy, 4).fill({ color: 0xf5efe0, alpha: 1 });
  g.circle(cx, cy - 2, 5).fill({ color: 0x3f8aa8, alpha: 1 });
}

function bakeShelfStrip(g: Graphics, x: number, y: number, w: number): void {
  g.roundRect(x, y, w, 14, 2).fill({ color: 0x6e4e2e, alpha: 1 });
  const rng = lcg(Math.floor(x + y));
  let bx = x + 3;
  while (bx < x + w - 6) {
    const bw = 4 + rng() * 5;
    const palette = [0xc96f5a, 0x5a8ac9, 0x6fae5f, 0xc9a44e, 0x9a6fc9];
    const color = palette[Math.floor(rng() * palette.length)] as number;
    g.rect(bx, y + 2, bw, 10).fill({ color, alpha: 1 });
    bx += bw + 1.5;
  }
}

// ---------------------------------------------------------------------------
// Walls + doors
// ---------------------------------------------------------------------------

function bakeWalls(g: Graphics, walls: readonly Cell[], wallSet: Set<string>): void {
  for (const cell of walls) {
    const px = cell.x * T;
    const py = cell.y * T;
    g.rect(px, py, T, T).fill({ color: 0x232839, alpha: 1 });
    // Inner highlight on edges facing walkable floor (reads as wall base).
    if (!wallSet.has(`${cell.x},${cell.y - 1}`)) {
      g.rect(px, py, T, 2.5).fill({ color: 0x4a5478, alpha: 1 });
    }
    if (!wallSet.has(`${cell.x},${cell.y + 1}`)) {
      g.rect(px, py + T - 3, T, 3).fill({ color: 0x8a5f3c, alpha: 0.9 });
    }
  }
}

/**
 * Blocked decorative furniture: potted plants, bookcase shelves, warm
 * floor lamps and storage chests. Drawn on their (blocked) cells instead
 * of wall bands, so the walkability grid and the visuals always agree.
 */
function bakeProps(g: Graphics, props: readonly HousePropView[]): void {
  for (const prop of props) {
    const px = prop.cell.x * T;
    const py = prop.cell.y * T;
    const cx = px + T / 2;
    const cy = py + T / 2;
    // Wood floor peek around the furniture (cells are interior, not wall).
    g.rect(px, py, T, T).fill({ color: WOOD_BASE, alpha: 1 });
    switch (prop.kind) {
      case 'plant': {
        g.ellipse(cx, py + T - 4, 11, 4).fill({ color: 0x000000, alpha: 0.22 });
        g.roundRect(cx - 7, cy + 1, 14, 11, 3).fill({ color: 0x8a5f3c, alpha: 1 });
        g.roundRect(cx - 7, cy + 1, 14, 11, 3).stroke({ width: 1.5, color: 0x5d3f22, alpha: 1 });
        g.circle(cx - 5, cy - 4, 6).fill({ color: 0x3e7a35, alpha: 1 });
        g.circle(cx + 5, cy - 5, 7).fill({ color: 0x4c8f40, alpha: 1 });
        g.circle(cx, cy - 9, 5).fill({ color: 0x5da24c, alpha: 1 });
        break;
      }
      case 'shelf': {
        g.roundRect(px + 2, py + 1, T - 4, T - 2, 2).fill({ color: 0x6e4e2e, alpha: 1 });
        const rng = lcg(prop.cell.x * 131 + prop.cell.y * 17 + 5);
        for (const sy of [py + 3, py + 12, py + 21]) {
          let bx = px + 5;
          while (bx < px + T - 8) {
            const bw = 3 + rng() * 4;
            const palette = [0xc96f5a, 0x5a8ac9, 0x6fae5f, 0xc9a44e, 0x9a6fc9];
            g.rect(bx, sy, bw, 7).fill({
              color: palette[Math.floor(rng() * palette.length)] as number,
              alpha: 1,
            });
            bx += bw + 1.2;
          }
        }
        break;
      }
      case 'lamp': {
        g.ellipse(cx, py + T - 4, 10, 4).fill({ color: 0xffe9b0, alpha: 0.25 });
        g.rect(cx - 2, cy - 2, 4, 12).fill({ color: 0x4a3a28, alpha: 1 });
        g.roundRect(cx - 8, cy - 14, 16, 13, 4).fill({ color: 0xf5e6c4, alpha: 1 });
        g.roundRect(cx - 8, cy - 14, 16, 13, 4).stroke({ width: 1.5, color: 0x8a5f3c, alpha: 1 });
        g.circle(cx, cy - 7, 4).fill({ color: 0xffca7a, alpha: 0.95 });
        break;
      }
      case 'chest': {
        g.ellipse(cx, py + T - 4, 12, 4).fill({ color: 0x000000, alpha: 0.22 });
        g.roundRect(px + 3, cy - 4, T - 6, 15, 3).fill({ color: 0x7d5732, alpha: 1 });
        g.roundRect(px + 3, cy - 4, T - 6, 15, 3).stroke({ width: 1.5, color: 0x5d3f22, alpha: 1 });
        g.rect(px + 3, cy + 1, T - 6, 2).fill({ color: 0x5d3f22, alpha: 1 });
        g.rect(cx - 2, cy - 1, 4, 5).fill({ color: 0xd9b36a, alpha: 1 });
        break;
      }
    }
  }
}

/**
 * Door gaps: ring cells around each room rect that are neither wall nor
 * another room interior. Each gets a wood threshold plus a noren curtain
 * across the passage (the fastest "Japanese house" read at this scale).
 */
function bakeDoors(
  g: Graphics,
  layout: ShipLayoutView,
  wallSet: Set<string>,
  roomOf: Map<string, ShipRoomView>,
): void {
  const seen = new Set<string>();
  for (const room of layout.rooms) {
    const interior = new Set(room.cells.map((c) => `${c.x},${c.y}`));
    const { x, y, width, height } = room.rect;
    const ring: Cell[] = [];
    for (let cx = x - 1; cx <= x + width; cx++) {
      ring.push({ x: cx, y: y - 1 });
      ring.push({ x: cx, y: y + height });
    }
    for (let cy = y; cy < y + height; cy++) {
      ring.push({ x: x - 1, y: cy });
      ring.push({ x: x + width, y: cy });
    }
    for (const cell of ring) {
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key) || wallSet.has(key) || roomOf.has(key)) continue;
      seen.add(key);
      // Only gaps inside the house lattice can be doors.
      if (cell.x < 0 || cell.y < 0 || cell.x >= layout.gridWidth || cell.y >= layout.gridHeight) {
        continue;
      }
      // A genuine threshold touches the room interior orthogonally; this
      // rejects blocked garden corners that merely graze the ring.
      const touchesInterior =
        interior.has(`${cell.x + 1},${cell.y}`) ||
        interior.has(`${cell.x - 1},${cell.y}`) ||
        interior.has(`${cell.x},${cell.y + 1}`) ||
        interior.has(`${cell.x},${cell.y - 1}`);
      if (!touchesInterior) continue;
      drawDoorway(g, cell, wallSet);
    }
  }
}

function drawDoorway(g: Graphics, cell: Cell, wallSet: Set<string>): void {
  const px = cell.x * T;
  const py = cell.y * T;
  const northSouthWalls =
    wallSet.has(`${cell.x - 1},${cell.y}`) && wallSet.has(`${cell.x + 1},${cell.y}`);
  // Threshold: pale wood.
  g.rect(px + 2, py + 2, T - 4, T - 4).fill({ color: 0xe0c491, alpha: 1 });
  if (northSouthWalls) {
    // Passage runs north-south: noren curtain hangs across (top edge).
    g.rect(px + 2, py, T - 4, 5).fill({ color: 0x4a3a28, alpha: 1 });
    const thirds = [0.18, 0.5, 0.82];
    for (const f of thirds) {
      g.rect(px + 2 + (T - 4) * f - 4, py + 5, 8, 12).fill({ color: 0x2e4a7a, alpha: 1 });
    }
    g.rect(px + 2, py + 13, T - 4, 2).fill({ color: 0xf5efe0, alpha: 0.9 });
  } else {
    // Passage runs east-west: curtain across the left edge + posts.
    g.rect(px, py + 2, 5, T - 4).fill({ color: 0x4a3a28, alpha: 1 });
    const thirds = [0.18, 0.5, 0.82];
    for (const f of thirds) {
      g.rect(px + 5, py + 2 + (T - 4) * f - 4, 12, 8).fill({ color: 0x2e4a7a, alpha: 1 });
    }
    g.rect(px + 13, py + 2, 2, T - 4).fill({ color: 0xf5efe0, alpha: 0.9 });
  }
}
