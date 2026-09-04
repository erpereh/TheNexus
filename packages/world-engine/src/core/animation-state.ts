import {
  PACK_DIRECTIONS,
  type PackAnimation,
  type PackAnimationSlot,
  type PackDirection,
  type PackDirectionAnimation,
} from '@thenexus/contracts';
import type { Facing } from './character';

/**
 * Animation resolution for character packs: mapping cardinal facings onto
 * the four diagonal pack directions, the missing-direction fallback chain,
 * and the deterministic frame-index formula.
 */

/**
 * Character facings are cardinal (N/E/S/W) while packs author NE/NW/SE/SW.
 * Each cardinal maps to its clockwise-nearest diagonal once, here, so every
 * consumer resolves identically: N->NE, E->SE, S->SW, W->NW.
 */
export const FACING_TO_PACK_DIRECTION: Readonly<Record<Facing, PackDirection>> = {
  N: 'NE',
  E: 'SE',
  S: 'SW',
  W: 'NW',
};

/** `manifest.animations` - slot name -> per-direction animations. */
export type AnimationTable = Readonly<Record<string, PackAnimation>>;

export interface ResolvedAnimation {
  animation: PackDirectionAnimation;
  /** True when the substitute is the horizontally mirrored opposite direction. */
  mirrored: boolean;
  slot: PackAnimationSlot;
  /** Direction the animation was actually taken from. */
  direction: PackDirection;
}

/**
 * Fallback chain for (slot, direction):
 *
 *  1. `table[slot][direction]` when present;
 *  2. the slot's declared substitute: the first present direction entry (in
 *     PACK_DIRECTIONS order) whose `fallback` is set. An object fallback
 *     targets another direction of the same slot (mirrored per its flag); a
 *     string fallback substitutes the whole 'idle'/'walk' slot;
 *  3. the 'idle' slot (mandatory in every valid pack) at the same direction;
 *  4. the 'walk' slot at the same direction;
 *  5. null - callers keep showing their previous frame.
 *
 * The chain is deterministic and acyclic: string fallbacks never re-enter
 * their own slot, and object fallbacks resolve at most one hop.
 */
export function resolveAnimation(
  table: AnimationTable,
  slot: PackAnimationSlot,
  direction: PackDirection,
): ResolvedAnimation | null {
  const direct = table[slot]?.[direction];
  if (direct !== undefined) {
    return { animation: direct, mirrored: false, slot, direction };
  }
  const slotEntry = table[slot];
  if (slotEntry !== undefined) {
    for (const dir of PACK_DIRECTIONS) {
      const candidate = slotEntry[dir];
      const fallback = candidate?.fallback;
      if (fallback === undefined) continue;
      if (typeof fallback === 'string') {
        if (fallback === slot) continue; // never re-enter the same slot
        const substituted = resolveAnimation(table, fallback, direction);
        if (substituted !== null) return substituted;
      } else {
        const target = table[slot]?.[fallback.direction];
        if (target !== undefined) {
          return {
            animation: target,
            mirrored: fallback.mirrored === true,
            slot,
            direction: fallback.direction,
          };
        }
      }
    }
  }
  if (slot !== 'idle') {
    const idle = resolveAnimation(table, 'idle', direction);
    if (idle !== null) return idle;
  }
  if (slot !== 'walk') {
    const walk = resolveAnimation(table, 'walk', direction);
    if (walk !== null) return walk;
  }
  return null;
}

/**
 * Frame index for a playing animation at `timeMs` (time since the animation
 * became current): floor(timeMs / 1000 * fps) wrapped modulo frameCount when
 * looping, clamped to the last frame otherwise. Degenerate geometry (no
 * frames or fps) and negative time resolve to frame 0.
 */
export function frameIndexAt(
  animation: Pick<PackDirectionAnimation, 'fps' | 'frameCount' | 'loop'>,
  timeMs: number,
): number {
  if (animation.frameCount <= 0 || animation.fps <= 0) return 0;
  const raw = Math.floor((Math.max(0, timeMs) / 1000) * animation.fps);
  return animation.loop ? raw % animation.frameCount : Math.min(raw, animation.frameCount - 1);
}

/** Maps a logical frame index onto the sprite sheet via `frameIndices`. */
export function sheetFrameIndex(animation: PackDirectionAnimation, frameIndex: number): number {
  const indices = animation.frameIndices;
  if (indices === undefined || indices.length === 0) return frameIndex;
  return indices[frameIndex] ?? indices[indices.length - 1] ?? frameIndex;
}

export interface AnimationFrameState {
  /** Slot currently requested (walk while moving, otherwise the intent). */
  slot: PackAnimationSlot;
  /** Pack direction for the current facing. */
  direction: PackDirection;
  mirrored: boolean;
  frameIndex: number;
  /** Resolved pack animation, or null when nothing in the pack applies. */
  animation: PackDirectionAnimation | null;
}

/**
 * Tracks the animation inputs of one character and derives the frame to
 * render each advance(dt). Elapsed time restarts whenever the effective
 * slot or direction changes, so a newly chosen animation starts at frame 0.
 */
export class AnimationStateMachine {
  private intent: PackAnimationSlot = 'idle';
  private facing: Facing = 'S';
  private moving = false;
  private elapsedMs = 0;
  private lastKey: string | null = null;
  private readonly table: AnimationTable;

  constructor(table: AnimationTable = {}) {
    this.table = table;
  }

  setIntent(slot: PackAnimationSlot): void {
    this.intent = slot;
  }

  setFacing(facing: Facing): void {
    this.facing = facing;
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
  }

  /** Elapses `dtMs` and returns the frame to render now. */
  advance(dtMs: number): AnimationFrameState {
    const direction = FACING_TO_PACK_DIRECTION[this.facing];
    const slot: PackAnimationSlot = this.moving ? 'walk' : this.intent;
    const key = `${slot}:${direction}`;
    if (key !== this.lastKey) {
      this.elapsedMs = 0;
      this.lastKey = key;
    }
    this.elapsedMs += Math.max(0, dtMs);
    const resolved = resolveAnimation(this.table, slot, direction);
    if (resolved === null) {
      return { slot, direction, mirrored: false, frameIndex: 0, animation: null };
    }
    return {
      slot: resolved.slot,
      direction: resolved.direction,
      mirrored: resolved.mirrored,
      frameIndex: frameIndexAt(resolved.animation, this.elapsedMs),
      animation: resolved.animation,
    };
  }
}
