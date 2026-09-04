import { describe, expect, it } from 'vitest';
import {
  PACK_DIRECTIONS,
  type PackAnimationSlot,
  type PackDirectionAnimation,
} from '@thenexus/contracts';
import {
  AnimationStateMachine,
  frameIndexAt,
  resolveAnimation,
  type AnimationTable,
} from './animation-state';

function anim(overrides: Partial<PackDirectionAnimation> = {}): PackDirectionAnimation {
  return {
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 4,
    fps: 4,
    loop: true,
    anchor: { x: 0.5, y: 1 },
    ...overrides,
  };
}

function tableWith(animations: AnimationTable): AnimationTable {
  return animations;
}

const fullIdleWalk: AnimationTable = {
  idle: {
    NE: anim({ fps: 1 }),
    NW: anim({ fps: 1 }),
    SE: anim({ fps: 1 }),
    SW: anim({ fps: 1 }),
  },
  walk: {
    NE: anim(),
    NW: anim(),
    SE: anim(),
    SW: anim(),
  },
};

describe('resolveAnimation fallback chain', () => {
  it('returns the direct direction animation when present', () => {
    const table = tableWith({
      ...fullIdleWalk,
      coding: { SE: anim({ fps: 6 }) },
    });
    const resolved = resolveAnimation(table, 'coding', 'SE');
    expect(resolved).not.toBeNull();
    expect(resolved?.slot).toBe('coding');
    expect(resolved?.direction).toBe('SE');
    expect(resolved?.mirrored).toBe(false);
    expect(resolved?.animation.fps).toBe(6);
  });

  it('falls back to fallback.direction mirrored when the requested direction is missing', () => {
    const table = tableWith({
      ...fullIdleWalk,
      coding: {
        SE: anim({ fps: 6 }),
        SW: anim({ fps: 6, fallback: { direction: 'SE', mirrored: true } }),
      },
    });
    const resolved = resolveAnimation(table, 'coding', 'NE');
    expect(resolved).not.toBeNull();
    expect(resolved?.slot).toBe('coding');
    expect(resolved?.direction).toBe('SE');
    expect(resolved?.mirrored).toBe(true);
  });

  it('honors the string fallback form ("idle"/"walk")', () => {
    const table = tableWith({
      ...fullIdleWalk,
      coding: { SW: anim({ fallback: 'idle' }) },
    });
    const resolved = resolveAnimation(table, 'coding', 'NW');
    expect(resolved?.slot).toBe('idle');
    expect(resolved?.mirrored).toBe(false);
  });

  it('walks missing slot -> idle -> walk and returns null only when nothing exists', () => {
    const onlyWalkNE: AnimationTable = { walk: { NE: anim() } };
    const resolved = resolveAnimation(onlyWalkNE, 'testing', 'NE');
    expect(resolved?.slot).toBe('walk');
    // idle present for NE: preferred over walk
    expect(resolveAnimation(fullIdleWalk, 'testing', 'NE')?.slot).toBe('idle');
    // nothing at all
    expect(resolveAnimation({}, 'testing', 'NE')).toBeNull();
    // direction missing in both idle and walk
    const partial: AnimationTable = {
      idle: { NE: anim() },
      walk: { NW: anim() },
    };
    expect(resolveAnimation(partial, 'testing', 'SW')).toBeNull();
  });

  it('keeps every canonical direction resolvable when idle and walk are complete', () => {
    for (const direction of PACK_DIRECTIONS) {
      const resolved = resolveAnimation(fullIdleWalk, 'sitting', direction);
      expect(resolved?.slot).toBe('idle');
    }
  });
});

describe('frameIndexAt', () => {
  it('advances by floor(timeMs / 1000 * fps) and wraps when looping', () => {
    const loop = anim({ fps: 2, frameCount: 3, loop: true });
    expect(frameIndexAt(loop, 0)).toBe(0);
    expect(frameIndexAt(loop, 499)).toBe(0);
    expect(frameIndexAt(loop, 500)).toBe(1);
    expect(frameIndexAt(loop, 999)).toBe(1);
    expect(frameIndexAt(loop, 1000)).toBe(2);
    expect(frameIndexAt(loop, 1499)).toBe(2);
    expect(frameIndexAt(loop, 1500)).toBe(0); // wrapped
    expect(frameIndexAt(loop, 3000)).toBe(0);
  });

  it('clamps at the last frame when not looping', () => {
    const hold = anim({ fps: 2, frameCount: 3, loop: false });
    expect(frameIndexAt(hold, 1000)).toBe(2);
    expect(frameIndexAt(hold, 1500)).toBe(2);
    expect(frameIndexAt(hold, 60_000)).toBe(2);
  });

  it('guards degenerate geometry and negative time', () => {
    expect(frameIndexAt(anim({ frameCount: 0 }), 100)).toBe(0);
    expect(frameIndexAt(anim({ fps: 0 }), 100)).toBe(0);
    expect(frameIndexAt(anim({ fps: 2, frameCount: 3 }), -50)).toBe(0);
  });
});

describe('AnimationStateMachine', () => {
  it('plays walk while moving and the intent slot while standing', () => {
    const sm = new AnimationStateMachine(fullIdleWalk);
    sm.setIntent('coding');
    sm.setFacing('S');
    let frame = sm.advance(16);
    expect(frame.slot).toBe('coding');
    expect(frame.direction).toBe('SW'); // facing S -> pack direction SW
    sm.setMoving(true);
    frame = sm.advance(16);
    expect(frame.slot).toBe('walk');
    expect(frame.direction).toBe('SW');
    sm.setMoving(false);
    frame = sm.advance(16);
    expect(frame.slot).toBe('coding');
  });

  it('maps the four cardinal facings onto the four pack directions', () => {
    const sm = new AnimationStateMachine(fullIdleWalk);
    sm.setFacing('N');
    expect(sm.advance(0).direction).toBe('NE');
    sm.setFacing('E');
    expect(sm.advance(0).direction).toBe('SE');
    sm.setFacing('S');
    expect(sm.advance(0).direction).toBe('SW');
    sm.setFacing('W');
    expect(sm.advance(0).direction).toBe('NW');
  });

  it('resets elapsed time when the slot or direction changes', () => {
    const sm = new AnimationStateMachine({
      coding: { SE: anim({ fps: 1, frameCount: 10 }) },
      walk: { SE: anim({ fps: 1, frameCount: 10 }) },
    });
    sm.setIntent('coding');
    sm.setFacing('S');
    sm.advance(1000);
    expect(sm.advance(0).frameIndex).toBe(1);
    sm.setIntent('walk'); // slot change -> elapsed restarts
    expect(sm.advance(0).frameIndex).toBe(0);
    sm.advance(2000);
    expect(sm.advance(0).frameIndex).toBe(2);
    sm.setFacing('E'); // SE -> SW change: walk.SW missing -> falls back anyway
    expect(sm.advance(0).frameIndex).toBe(0);
  });

  it('reports slot and direction even when no pack animation resolves', () => {
    const sm = new AnimationStateMachine({});
    sm.setIntent('planning');
    const frame = sm.advance(16);
    expect(frame.slot).toBe('planning');
    expect(frame.direction).toBe('SW');
    expect(frame.animation).toBeNull();
    expect(frame.mirrored).toBe(false);
  });

  it('defaults to idle intent and south facing', () => {
    const sm = new AnimationStateMachine(fullIdleWalk);
    const frame = sm.advance(0);
    expect(frame.slot).toBe<PackAnimationSlot>('idle');
    expect(frame.direction).toBe('SW');
  });
});
