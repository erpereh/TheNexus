import { Container, Graphics } from 'pixi.js';
import type { PackAnimationSlot } from '@thenexus/contracts';
import type { Facing } from '../core/character';
import { depthKeyOf } from '../core/depth-sort';
import type { Cell } from '../core/grid';

/**
 * Original chibi crew characters for the top-down Project House: big hair,
 * small shoulders, face direction from the sim `Facing`, activity props
 * (laptop, book, test flask, plan board, speech bubble) and shape-coded
 * status ornaments so waiting / error / completed read without color alone.
 * No sprite sheets yet — the Asset Studio milestone swaps these procedural
 * bodies for pack art behind the same `CharacterNode` interface.
 */

export type CharacterStatus = 'active' | 'waiting' | 'error' | 'completed';

export interface CharacterFrame {
  slot: PackAnimationSlot;
  mirrored: boolean;
  status: CharacterStatus;
  moving: boolean;
  selected: boolean;
  /** Accent tint 0xRRGGBB for hood/trim (stable per character). */
  accent: number;
  /** True for Guest Agent fallback characters (hollow ring marker). */
  isGuest: boolean;
  /** Sim facing; drives the face offset (top-down readability). */
  facing: Facing;
}

export interface CharacterNode {
  container: Container;
  /** Feet position in top-down world pixels (pre-camera transform). */
  setFeet(x: number, y: number): void;
  setDepth(cell: Cell): void;
  update(frame: CharacterFrame, timeMs: number): void;
  destroy(): void;
}

/** Deterministic per-id accent picker (visual only). */
export function accentForId(id: string, accents: readonly number[]): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i) as number;
    hash = Math.imul(hash, 16777619);
  }
  const list = accents.length > 0 ? accents : [0x7c5cff];
  return list[Math.abs(hash) % list.length] as number;
}

/** Deterministic per-id hair color (original palette, visual only). */
export function hairForId(id: string): number {
  const palette = [0x2b2b3a, 0x5aa9ff, 0xff9ecf, 0xffab5e, 0xe8e8f2, 0x7ddf9a, 0x8a5fbf] as const;
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (Math.imul(hash, 31) + (id.charCodeAt(i) as number)) | 0;
  return palette[Math.abs(hash) % palette.length] as number;
}

interface MotionStyle {
  bobAmp: number;
  bobRate: number;
  hop: boolean;
  shake: boolean;
  still: boolean;
}

function motionForSlot(slot: PackAnimationSlot, status: CharacterStatus): MotionStyle {
  if (status === 'error') return { bobAmp: 0, bobRate: 0, hop: false, shake: true, still: false };
  if (status === 'completed')
    return { bobAmp: 2, bobRate: 6, hop: true, shake: false, still: false };
  if (status === 'waiting') return { bobAmp: 0, bobRate: 0, hop: false, shake: false, still: true };
  switch (slot) {
    case 'walk':
      return { bobAmp: 2.5, bobRate: 11, hop: false, shake: false, still: false };
    case 'coding':
      return { bobAmp: 1.2, bobRate: 9, hop: false, shake: false, still: false };
    case 'testing':
      return { bobAmp: 1.8, bobRate: 7, hop: false, shake: false, still: false };
    case 'talking':
      return { bobAmp: 1.2, bobRate: 5, hop: false, shake: false, still: false };
    case 'researching':
      return { bobAmp: 1.4, bobRate: 3, hop: false, shake: false, still: false };
    case 'planning':
      return { bobAmp: 1, bobRate: 2.4, hop: false, shake: false, still: false };
    case 'celebrating':
      return { bobAmp: 2, bobRate: 6, hop: true, shake: false, still: false };
    case 'error':
      return { bobAmp: 0, bobRate: 0, hop: false, shake: true, still: false };
    default:
      return { bobAmp: 1, bobRate: 2, hop: false, shake: false, still: false };
  }
}

export function createCharacterNode(id: string): CharacterNode {
  const container = new Container();
  container.label = `character:${id}`;
  container.cullable = true;

  const shadow = new Graphics();
  const body = new Graphics();
  const ornament = new Graphics();
  const ring = new Graphics();
  container.addChild(shadow, body, ornament, ring);

  shadow.ellipse(0, 0, 10, 4).fill({ color: 0x000000, alpha: 0.3 });

  let ornamentKey: string | null = null;
  let bodyKey = '';

  const buildBody = (accent: number, hair: number, facing: Facing, isGuest: boolean): void => {
    body.clear();
    const robe = isGuest ? 0x4a5170 : 0x33406e;
    // Shoulders (small, below the big head).
    body.roundRect(-8, -10, 16, 10, 4).fill({ color: robe, alpha: 1 });
    body.rect(-8, -8, 16, 2).fill({ color: accent, alpha: 0.85 });
    // Big chibi head: hair mass + face shifted toward the facing.
    const faceDx = facing === 'E' ? 2.5 : facing === 'W' ? -2.5 : 0;
    const faceDy = facing === 'S' ? 2 : facing === 'N' ? -2.5 : 0;
    body.circle(0, -17, 8.5).fill({ color: hair, alpha: 1 });
    if (facing !== 'N') {
      body.circle(faceDx, -17 + faceDy, 5.8).fill({ color: 0xffd9b8, alpha: 1 });
      // Eyes look where the character looks.
      body.circle(faceDx - 2 + faceDx * 0.3, -17 + faceDy, 0.9).fill({ color: 0x232839, alpha: 1 });
      body.circle(faceDx + 2 + faceDx * 0.3, -17 + faceDy, 0.9).fill({ color: 0x232839, alpha: 1 });
    } else {
      // Back of the head: hair swirl.
      body.circle(0, -17, 3).fill({ color: shade(hair, 0.7), alpha: 1 });
    }
    // Hair fringe + side locks frame the face.
    body.circle(-6, -21, 3).fill({ color: hair, alpha: 1 });
    body.circle(6, -21, 3).fill({ color: hair, alpha: 1 });
    body.circle(0, -25, 3.4).fill({ color: hair, alpha: 1 });
    body.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
  };

  const drawOrnament = (
    status: CharacterStatus,
    slot: PackAnimationSlot,
    facing: Facing,
    accent: number,
  ): void => {
    ornament.clear();
    const y = -36;
    if (status === 'error') {
      ornament.setStrokeStyle({ width: 3, color: 0xff5470, alpha: 1 });
      ornament
        .moveTo(-6, y - 6)
        .lineTo(6, y + 6)
        .stroke();
      ornament
        .moveTo(6, y - 6)
        .lineTo(-6, y + 6)
        .stroke();
    } else if (status === 'waiting') {
      ornament.setStrokeStyle({ width: 3, color: 0xffc857, alpha: 1 });
      ornament
        .moveTo(-4, y - 6)
        .lineTo(-4, y + 6)
        .stroke();
      ornament
        .moveTo(4, y - 6)
        .lineTo(4, y + 6)
        .stroke();
    } else if (status === 'completed') {
      ornament
        .moveTo(0, y - 9)
        .lineTo(2.5, y - 2.5)
        .lineTo(9, y)
        .lineTo(2.5, y + 2.5)
        .lineTo(0, y + 9)
        .lineTo(-2.5, y + 2.5)
        .lineTo(-9, y)
        .lineTo(-2.5, y - 2.5)
        .closePath()
        .fill({ color: 0x5dffa9, alpha: 1 });
    } else if (slot === 'talking') {
      ornament.circle(6, y, 6).fill({ color: 0xf5efe0, alpha: 0.95 });
      ornament.circle(3.5, y + 5, 2.4).fill({ color: 0xf5efe0, alpha: 0.9 });
      ornament.circle(7, y - 1, 1.4).fill({ color: accent, alpha: 1 });
      ornament.circle(4.5, y - 1, 1.4).fill({ color: accent, alpha: 1 });
    } else {
      // Activity prop held in front (toward the facing).
      const px = facing === 'E' ? 9 : facing === 'W' ? -9 : 0;
      const py = facing === 'S' ? -8 : -14;
      if (slot === 'coding') {
        ornament.roundRect(px - 6, py - 4, 12, 8, 1.5).fill({ color: 0x1c2333, alpha: 1 });
        ornament.rect(px - 4, py - 2, 8, 3).fill({ color: 0x6fc3ff, alpha: 0.9 });
      } else if (slot === 'researching') {
        ornament.rect(px - 6, py - 4, 12, 8).fill({ color: 0xf5efe0, alpha: 1 });
        ornament.rect(px - 5, py - 2, 4.5, 4).fill({ color: accent, alpha: 0.7 });
        ornament.rect(px + 0.5, py - 2, 4.5, 4).fill({ color: 0xb9b3a4, alpha: 0.9 });
      } else if (slot === 'testing') {
        ornament.circle(px, py, 4.5).fill({ color: 0x3f8aa8, alpha: 1 });
        ornament.circle(px, py - 1, 2.5).fill({ color: 0x6fc3ff, alpha: 1 });
        ornament.rect(px - 1.5, py - 8, 3, 4).fill({ color: 0xb9b3a4, alpha: 1 });
      } else if (slot === 'planning') {
        ornament.rect(px - 6, py - 6, 12, 9).fill({ color: 0xf5efe0, alpha: 1 });
        ornament.rect(px - 4, py - 4, 3, 3).fill({ color: 0xff9ecf, alpha: 1 });
        ornament.rect(px, py - 4, 3, 3).fill({ color: 0x9ed8ff, alpha: 1 });
      }
    }
    ornament.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
  };

  const drawRing = (selected: boolean, isGuest: boolean, accent: number): void => {
    ring.clear();
    if (selected) {
      ring.ellipse(0, 0, 15, 6.5).stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
    } else if (isGuest) {
      ring.ellipse(0, 0, 13, 5.5).stroke({ width: 1.5, color: accent, alpha: 0.7 });
    }
  };

  const hair = hairForId(id);
  let lastRingKey = '';

  return {
    container,
    setFeet(x: number, y: number): void {
      container.position.set(x, y);
    },
    setDepth(cell: Cell): void {
      container.zIndex = depthKeyOf({ id, layer: 'characters', occupiedCells: [cell] });
    },
    update(frame: CharacterFrame, timeMs: number): void {
      container.scale.x = frame.mirrored ? -1 : 1;
      const key = `${frame.accent}:${frame.facing}:${frame.isGuest ? 'guest' : 'crew'}`;
      if (key !== bodyKey) {
        bodyKey = key;
        buildBody(frame.accent, hair, frame.facing, frame.isGuest);
      }
      const oKey = `${frame.status}:${frame.slot}:${frame.facing}`;
      if (oKey !== ornamentKey) {
        ornamentKey = oKey;
        drawOrnament(frame.status, frame.slot, frame.facing, frame.accent);
      }
      const rKey = `${frame.selected ? 'sel' : 'nosel'}:${frame.isGuest ? 'guest' : 'crew'}`;
      if (rKey !== lastRingKey) {
        lastRingKey = rKey;
        drawRing(frame.selected, frame.isGuest, frame.accent);
      }
      const motion = motionForSlot(frame.slot, frame.status);
      const t = timeMs / 1000;
      let dy = 0;
      let dx = 0;
      if (motion.shake) {
        dx = Math.sin(t * 40) * 2;
      } else if (!motion.still) {
        dy = -Math.abs(Math.sin(t * motion.bobRate)) * motion.bobAmp;
        if (motion.hop) dy -= Math.max(0, Math.sin(t * 3.2)) * 6;
      }
      body.position.set(dx, dy);
      ornament.position.set(dx, motion.hop ? dy * 0.5 : 0);
    },
    destroy(): void {
      container.destroy({ children: true });
    },
  };
}

function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}
