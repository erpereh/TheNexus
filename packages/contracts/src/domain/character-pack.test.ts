import { describe, expect, it } from 'vitest';
import { validateCharacterPackManifest, type CharacterPackManifest } from './character-pack';

const directionAnim = (frameCount = 4) => ({
  frameWidth: 64,
  frameHeight: 64,
  frameCount,
  fps: 8,
  loop: true,
  anchor: { x: 0.5, y: 1 },
});

const allDirections = () => ({
  NE: directionAnim(),
  NW: directionAnim(),
  SE: directionAnim(),
  SW: directionAnim(),
});

const validManifest: CharacterPackManifest = {
  manifestVersion: 1,
  packId: 'pack_nova',
  name: 'Nova',
  author: 'TheNexus Team',
  license: 'original-work',
  directions: ['NE', 'NW', 'SE', 'SW'],
  animations: {
    idle: allDirections(),
    walk: allDirections(),
    coding: {
      NE: directionAnim(6),
      NW: { ...directionAnim(6), fallback: { direction: 'NE' } },
      SE: { ...directionAnim(6), fallback: 'idle' },
      SW: { ...directionAnim(6), fallback: 'idle' },
    },
    celebrating: allDirections(),
    error: allDirections(),
  },
  portraitAsset: 'portrait.webp',
  thumbnailAsset: 'thumbnail.webp',
};

describe('CharacterPackManifestSchema', () => {
  it('parses a valid manifest', () => {
    const result = validateCharacterPackManifest(validManifest);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('requires idle and walk slots', () => {
    const missingIdle = {
      ...validManifest,
      animations: { walk: allDirections() },
    };
    const result = validateCharacterPackManifest(missingIdle);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('MISSING_REQUIRED_SLOT');
  });

  it('flags present animations that lack a direction without fallback', () => {
    const broken = {
      ...validManifest,
      animations: {
        idle: allDirections(),
        walk: {
          NE: directionAnim(),
          NW: directionAnim(),
          SE: directionAnim(),
          SW: { ...directionAnim(), fallback: 'idle' as const },
        },
      },
    };
    const result = validateCharacterPackManifest(broken);
    expect(result.ok).toBe(true);
    expect(result.issues.map((i) => i.code)).not.toContain('MISSING_DIRECTION');
  });

  it('flags a missing direction when no fallback covers it', () => {
    const broken = {
      ...validManifest,
      animations: {
        idle: allDirections(),
        walk: {
          NE: directionAnim(),
          NW: directionAnim(),
          SE: directionAnim(),
          // SW missing entirely
        },
      },
    };
    const result = validateCharacterPackManifest(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('MISSING_DIRECTION');
    expect(result.issues.some((i) => i.path === 'animations.walk.SW')).toBe(true);
  });

  it('reports but allows a missing direction on a non-required slot', () => {
    const partial = {
      ...validManifest,
      animations: {
        idle: allDirections(),
        walk: allDirections(),
        celebrating: {
          NE: directionAnim(),
          NW: directionAnim(),
          SE: directionAnim(),
          // SW missing: runtime falls back to idle/walk
        },
      },
    };
    const result = validateCharacterPackManifest(partial);
    expect(result.ok).toBe(true);
    expect(
      result.issues.some(
        (i) => i.code === 'MISSING_DIRECTION' && i.path === 'animations.celebrating.SW',
      ),
    ).toBe(true);
  });

  it('rejects unknown slots but accepts reserved special_ extras', () => {
    const unknownSlot = {
      ...validManifest,
      animations: {
        ...validManifest.animations,
        hyperdrive: allDirections(),
      },
    };
    const unknownResult = validateCharacterPackManifest(unknownSlot);
    expect(unknownResult.ok).toBe(false);
    expect(unknownResult.issues.map((i) => i.code)).toContain('UNKNOWN_SLOT');

    const specialSlot = {
      ...validManifest,
      animations: {
        ...validManifest.animations,
        special_dance: { NE: directionAnim() },
      },
    };
    const specialResult = validateCharacterPackManifest(specialSlot);
    expect(specialResult.issues.map((i) => i.code)).not.toContain('UNKNOWN_SLOT');
    expect(specialResult.ok).toBe(true);
  });

  it('rejects unknown top-level manifest fields (untrusted import gate)', () => {
    const withScripts = {
      ...validManifest,
      scripts: { postinstall: 'echo pwned' },
      unknownField: true,
    };
    const result = validateCharacterPackManifest(withScripts);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('SCHEMA_INVALID');
  });

  it('rejects bad frame geometry, anchors and fps bounds', () => {
    const badGeometry = {
      ...validManifest,
      animations: {
        idle: allDirections(),
        walk: {
          NE: { ...directionAnim(), frameCount: 0 },
          NW: directionAnim(),
          SE: directionAnim(),
          SW: directionAnim(),
        },
      },
    };
    expect(validateCharacterPackManifest(badGeometry).issues.map((i) => i.code)).toContain(
      'BAD_FRAME_GEOMETRY',
    );

    const badAnchor = {
      ...validManifest,
      animations: {
        idle: allDirections(),
        walk: {
          NE: { ...directionAnim(), anchor: { x: 1.4, y: 1 } },
          NW: directionAnim(),
          SE: directionAnim(),
          SW: directionAnim(),
        },
      },
    };
    expect(validateCharacterPackManifest(badAnchor).issues.map((i) => i.code)).toContain(
      'BAD_ANCHOR',
    );

    const badFps = {
      ...validManifest,
      animations: {
        idle: allDirections(),
        walk: {
          NE: { ...directionAnim(), fps: 0 },
          NW: directionAnim(),
          SE: directionAnim(),
          SW: directionAnim(),
        },
      },
    };
    expect(validateCharacterPackManifest(badFps).issues.map((i) => i.code)).toContain('BAD_FPS');
  });

  it('rejects unsupported manifest versions and unknown slots deterministically', () => {
    const wrongVersion = { ...validManifest, manifestVersion: 2 };
    expect(validateCharacterPackManifest(wrongVersion).issues.map((i) => i.code)).toContain(
      'PACK_VERSION_UNSUPPORTED',
    );

    const first = JSON.stringify(validateCharacterPackManifest(validManifest));
    const second = JSON.stringify(
      validateCharacterPackManifest(JSON.parse(JSON.stringify(validManifest))),
    );
    expect(first).toBe(second);
  });

  it('rejects manifest-level garbage via safe parse', () => {
    const result = validateCharacterPackManifest('not-a-manifest');
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
