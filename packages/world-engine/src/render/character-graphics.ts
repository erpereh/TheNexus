import { Container, Graphics } from 'pixi.js';
import type { PackAnimationSlot } from '@thenexus/contracts';
import { depthKeyOf } from '../core/depth-sort';
import type { Cell } from '../core/grid';

/**
 * Original procedural crew characters: hooded robed silhouettes with a sash
 * and chest crystal, plus shape-coded status ornaments so waiting / error /
 * completed read without color alone (X-mark + shake, pause-bars + stillness,
 * star-burst + hop). No sprite sheets yet — the Asset Studio milestone swaps
 * these procedural bodies for pack art behind the same `CharacterNode`
 * interface and motion contract.
 */

export type CharacterStatus = 'active' | 'waiting' | 'error' | 'completed';

export interface CharacterFrame {
  slot: PackAnimationSlot;
  mirrored: boolean;
  status: CharacterStatus;
  moving: boolean;
  selected: boolean;
  /** Accent tint 0xRRGGBB for sash/crystal (stable per character). */
  accent: number;
  /** True for Guest Agent fallback characters (hollow ring marker). */
  isGuest: boolean;
}

export interface CharacterNode {
  container: Container;
  /** Feet position in iso screen space (pre-camera transform). */
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
      return { bobAmp: 3, bobRate: 11, hop: false, shake: false, still: false };
    case 'coding':
      return { bobAmp: 1.6, bobRate: 9, hop: false, shake: false, still: false };
    case 'testing':
      return { bobAmp: 2.2, bobRate: 7, hop: false, shake: false, still: false };
    case 'talking':
      return { bobAmp: 1.4, bobRate: 5, hop: false, shake: false, still: false };
    case 'researching':
      return { bobAmp: 1.8, bobRate: 3, hop: false, shake: false, still: false };
    case 'planning':
      return { bobAmp: 1.2, bobRate: 2.4, hop: false, shake: false, still: false };
    case 'celebrating':
      return { bobAmp: 2, bobRate: 6, hop: true, shake: false, still: false };
    case 'error':
      return { bobAmp: 0, bobRate: 0, hop: false, shake: true, still: false };
    default:
      return { bobAmp: 1.2, bobRate: 2, hop: false, shake: false, still: false };
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

  // Soft ground shadow (feet-anchored, never mirrored visibly).
  shadow.ellipse(0, 0, 12, 5).fill({ color: 0x000000, alpha: 0.35 });

  let ornamentKey: string | null = null;
  let bodyKey = '';

  const buildBody = (accent: number, isGuest: boolean): void => {
    body.clear();
    const robe = isGuest ? 0x3a4066 : 0x2b3160;
    // Cloak: tapered trapezoid from shoulders to hem.
    body
      .moveTo(-7, -30)
      .lineTo(7, -30)
      .lineTo(11, 0)
      .lineTo(-11, 0)
      .closePath()
      .fill({ color: robe, alpha: 1 });
    // Sash: diagonal accent band.
    body.setStrokeStyle({ width: 3, color: accent, alpha: 0.95 });
    body.moveTo(-8, -12).lineTo(8, -24).stroke();
    // Hood + face shadow.
    body.circle(0, -36, 8).fill({ color: robe, alpha: 1 });
    body.circle(0, -35, 5).fill({ color: 0x10142e, alpha: 1 });
    // Hood peak.
    body.moveTo(-8, -36).lineTo(0, -48).lineTo(8, -36).closePath().fill({ color: robe, alpha: 1 });
    // Chest crystal.
    body
      .moveTo(0, -26)
      .lineTo(4, -21)
      .lineTo(0, -16)
      .lineTo(-4, -21)
      .closePath()
      .fill({ color: accent, alpha: 0.95 });
    body.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
  };

  const drawOrnament = (status: CharacterStatus, slot: PackAnimationSlot, accent: number): void => {
    ornament.clear();
    const y = -58;
    if (status === 'error') {
      // X-mark: two crossed bars.
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
      // Pause bars: two vertical ticks.
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
      // Star-burst: small 4-point star.
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
      // Speech diamonds: paired lozenges.
      ornament
        .moveTo(-8, y)
        .lineTo(-4, y - 4)
        .lineTo(0, y)
        .lineTo(-4, y + 4)
        .closePath()
        .fill({ color: accent, alpha: 0.95 });
      ornament
        .moveTo(1, y + 2)
        .lineTo(4, y - 1)
        .lineTo(7, y + 2)
        .lineTo(4, y + 5)
        .closePath()
        .fill({ color: accent, alpha: 0.6 });
    } else if (slot === 'coding' || slot === 'testing' || slot === 'researching') {
      // Focus tick: single rune diamond above the hood.
      ornament
        .moveTo(0, y - 4)
        .lineTo(4, y)
        .lineTo(0, y + 4)
        .lineTo(-4, y)
        .closePath()
        .fill({ color: accent, alpha: 0.9 });
    }
    ornament.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
  };

  const drawRing = (selected: boolean, isGuest: boolean, accent: number): void => {
    ring.clear();
    if (selected) {
      ring.ellipse(0, 0, 16, 7).stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
    } else if (isGuest) {
      // Guests carry a hollow ring so fallback identity reads at a glance.
      ring.ellipse(0, 0, 14, 6).stroke({ width: 1.5, color: accent, alpha: 0.7 });
    }
  };

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
      const key = `${frame.accent}:${frame.isGuest ? 'guest' : 'crew'}`;
      if (key !== bodyKey) {
        bodyKey = key;
        buildBody(frame.accent, frame.isGuest);
      }
      const oKey = `${frame.status}:${frame.slot}`;
      if (oKey !== ornamentKey) {
        ornamentKey = oKey;
        drawOrnament(frame.status, frame.slot, frame.accent);
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
        if (motion.hop) dy -= Math.max(0, Math.sin(t * 3.2)) * 8;
      }
      body.position.set(dx, dy);
      ornament.position.set(dx, motion.hop ? dy * 0.5 : 0);
    },
    destroy(): void {
      container.destroy({ children: true });
    },
  };
}
