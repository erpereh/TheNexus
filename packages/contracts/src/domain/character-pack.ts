import { z } from 'zod';
import { PackIdSchema } from './ids';

export const CHARACTER_PACK_MANIFEST_VERSION = 1;

export const PACK_DIRECTIONS = ['NE', 'NW', 'SE', 'SW'] as const;
export const PackDirectionSchema = z.enum(PACK_DIRECTIONS);
export type PackDirection = z.infer<typeof PackDirectionSchema>;

/**
 * Baseline animation slots (design spec §13). `idle` and `walk` are
 * mandatory; every other slot may declare per-direction fallbacks.
 */
export const PACK_ANIMATION_SLOTS = [
  'idle',
  'walk',
  'coding',
  'researching',
  'testing',
  'planning',
  'talking',
  'sitting',
  'sleeping',
  'celebrating',
  'error',
] as const;
export const PackAnimationSlotSchema = z.enum(PACK_ANIMATION_SLOTS);
export type PackAnimationSlot = z.infer<typeof PackAnimationSlotSchema>;

/**
 * One animation's frames for one direction, sliced from a sprite sheet.
 * Declarative only — no executable content.
 */
export const PackDirectionAnimationSchema = z
  .object({
    sheetAsset: z.string().min(1).optional(),
    frameWidth: z.number(),
    frameHeight: z.number(),
    frameCount: z.number(),
    frameIndices: z.array(z.number()).optional(),
    fps: z.number(),
    loop: z.boolean(),
    anchor: z.object({ x: z.number(), y: z.number() }),
    offset: z.object({ x: z.number(), y: z.number() }).optional(),
    scale: z.number().optional(),
    /** Substitute when this direction is missing or should mirror another. */
    fallback: z
      .union([
        z.object({ direction: PackDirectionSchema, mirrored: z.boolean().optional() }),
        z.enum(['idle', 'walk']),
      ])
      .optional(),
  })
  .strict();

export type PackDirectionAnimation = z.infer<typeof PackDirectionAnimationSchema>;

const DirectionMapSchema = z.object({
  NE: PackDirectionAnimationSchema.optional(),
  NW: PackDirectionAnimationSchema.optional(),
  SE: PackDirectionAnimationSchema.optional(),
  SW: PackDirectionAnimationSchema.optional(),
});

export const PackAnimationSchema = DirectionMapSchema;
export type PackAnimation = z.infer<typeof PackAnimationSchema>;

export const CharacterPackManifestSchema = z
  .object({
    manifestVersion: z.literal(CHARACTER_PACK_MANIFEST_VERSION),
    packId: PackIdSchema,
    name: z.string().min(1),
    author: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
    directions: z.array(PackDirectionSchema),
    animations: z.record(z.string(), DirectionMapSchema),
    portraitAsset: z.string().min(1).optional(),
    thumbnailAsset: z.string().min(1).optional(),
  })
  .strict();

export type CharacterPackManifest = z.infer<typeof CharacterPackManifestSchema>;

export interface PackIssue {
  code:
    | 'PACK_VERSION_UNSUPPORTED'
    | 'SCHEMA_INVALID'
    | 'MISSING_REQUIRED_SLOT'
    | 'MISSING_DIRECTION'
    | 'BAD_FRAME_GEOMETRY'
    | 'BAD_ANCHOR'
    | 'BAD_FPS'
    | 'UNKNOWN_SLOT';
  path: string;
  message: string;
}

export interface PackValidationResult {
  ok: boolean;
  issues: PackIssue[];
}

const REQUIRED_SLOTS: readonly PackAnimationSlot[] = ['idle', 'walk'];

/**
 * Pure manifest validation for Asset Studio import, in-app pack creation
 * and corrupted-import tests. Deterministic: same input -> same issues in
 * the same order. Structural schema problems surface as SCHEMA_INVALID /
 * PACK_VERSION_UNSUPPORTED rather than thrown errors.
 */
export function validateCharacterPackManifest(input: unknown): PackValidationResult {
  const issues: PackIssue[] = [];

  if (
    typeof input !== 'object' ||
    input === null ||
    (input as { manifestVersion?: unknown }).manifestVersion !== CHARACTER_PACK_MANIFEST_VERSION
  ) {
    issues.push({
      code: 'PACK_VERSION_UNSUPPORTED',
      path: 'manifestVersion',
      message: `manifestVersion must be ${CHARACTER_PACK_MANIFEST_VERSION}`,
    });
    return { ok: false, issues };
  }

  const parsed = CharacterPackManifestSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        code: 'SCHEMA_INVALID',
        path: issue.path.join('.'),
        message: issue.message,
      });
    }
    return { ok: false, issues };
  }

  const manifest = parsed.data;

  for (const slot of REQUIRED_SLOTS) {
    if (!(slot in manifest.animations)) {
      issues.push({
        code: 'MISSING_REQUIRED_SLOT',
        path: `animations.${slot}`,
        message: `required animation slot "${slot}" is missing`,
      });
    }
  }

  for (const [slot, directions] of Object.entries(manifest.animations)) {
    // `special_*` keys are reserved for character-specific extras
    // (design spec section 13); anything else outside the baseline
    // vocabulary is rejected.
    if (!PACK_ANIMATION_SLOTS.includes(slot as PackAnimationSlot) && !slot.startsWith('special_')) {
      issues.push({
        code: 'UNKNOWN_SLOT',
        path: `animations.${slot}`,
        message: `unknown animation slot "${slot}" is not part of the baseline vocabulary and does not use the reserved special_ prefix`,
      });
      continue;
    }
    const present = Object.keys(directions).filter(
      (d) => directions[d as PackDirection] !== undefined,
    );
    if (present.length === 0) {
      issues.push({
        code: 'MISSING_DIRECTION',
        path: `animations.${slot}`,
        message: 'animation defines no directions at all',
      });
      continue;
    }
    for (const direction of PACK_DIRECTIONS) {
      const anim = directions[direction];
      if (anim === undefined) {
        // Non-required slots may omit directions: the runtime falls back
        // to idle/walk. Flag it so authors see the gap in the Studio.
        issues.push({
          code: 'MISSING_DIRECTION',
          path: `animations.${slot}.${direction}`,
          message: `direction ${direction} missing for slot "${slot}"`,
        });
        continue;
      }
      if (anim.frameCount <= 0 || anim.frameWidth <= 0 || anim.frameHeight <= 0) {
        issues.push({
          code: 'BAD_FRAME_GEOMETRY',
          path: `animations.${slot}.${direction}`,
          message: 'frame geometry must be positive',
        });
      }
      if (anim.anchor.x < 0 || anim.anchor.x > 1 || anim.anchor.y < 0 || anim.anchor.y > 1) {
        issues.push({
          code: 'BAD_ANCHOR',
          path: `animations.${slot}.${direction}.anchor`,
          message: 'anchor must be normalized within [0,1]',
        });
      }
      if (anim.fps < 1 || anim.fps > 60) {
        issues.push({
          code: 'BAD_FPS',
          path: `animations.${slot}.${direction}.fps`,
          message: 'fps must be within [1,60]',
        });
      }
    }
  }

  // Required slots (idle/walk) must cover every direction explicitly;
  // non-required slots may omit directions (the runtime falls back to
  // idle/walk), and the MISSING_DIRECTION findings surface those gaps to
  // the Studio validator without blocking structural validity.
  const blocking = issues.filter(
    (issue) =>
      issue.code === 'PACK_VERSION_UNSUPPORTED' ||
      issue.code === 'SCHEMA_INVALID' ||
      issue.code === 'MISSING_REQUIRED_SLOT' ||
      issue.code === 'UNKNOWN_SLOT' ||
      issue.code === 'BAD_FRAME_GEOMETRY' ||
      issue.code === 'BAD_ANCHOR' ||
      issue.code === 'BAD_FPS' ||
      (issue.code === 'MISSING_DIRECTION' &&
        REQUIRED_SLOTS.some((slot) => issue.path.startsWith(`animations.${slot}`))),
  );

  return { ok: blocking.length === 0, issues };
}
