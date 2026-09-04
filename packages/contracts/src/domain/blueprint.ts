import { z } from 'zod';
import { BlueprintIdSchema } from './ids';
import { RoomTypeSchema, StationTypeSchema } from './semantics';

export const BLUEPRINT_FORMAT_VERSION = 1;

export const BlueprintObjectSchema = z.object({
  stationType: StationTypeSchema,
  gridX: z.number().int().nonnegative(),
  gridY: z.number().int().nonnegative(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  /** Small decorative free offset; not collision-critical. */
  freeOffset: z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1) }).optional(),
});

export type BlueprintObject = z.infer<typeof BlueprintObjectSchema>;

export const BlueprintSchema = z
  .object({
    formatVersion: z.literal(BLUEPRINT_FORMAT_VERSION),
    blueprintId: BlueprintIdSchema,
    name: z.string().min(1),
    roomType: RoomTypeSchema,
    footprint: z.object({
      width: z.number().int().min(1).max(64),
      height: z.number().int().min(1).max(64),
    }),
    objects: z.array(BlueprintObjectSchema),
    themeOverrides: z.record(z.string(), z.string()).optional(),
    requiredAssetRefs: z.array(z.string().min(1)),
  })
  .refine(
    (blueprint) =>
      blueprint.objects.every(
        (object) =>
          object.gridX < blueprint.footprint.width && object.gridY < blueprint.footprint.height,
      ),
    { message: 'object placed outside blueprint footprint' },
  );

export type Blueprint = z.infer<typeof BlueprintSchema>;

export type BlueprintParseResult =
  | { ok: true; blueprint: Blueprint }
  | { ok: false; error: { code: 'UNSUPPORTED_VERSION' | 'INVALID_BLUEPRINT'; message: string } };

/**
 * Safe parser for untrusted blueprint imports. Never throws: any garbage
 * input becomes a structured error so a malformed file can never crash
 * the app (docs/architecture/04-storage-privacy-security.md).
 */
export function parseBlueprint(input: unknown): BlueprintParseResult {
  const claimedVersion =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as { formatVersion?: unknown }).formatVersion
      : undefined;
  if (claimedVersion !== undefined && claimedVersion !== BLUEPRINT_FORMAT_VERSION) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `blueprint formatVersion must be ${BLUEPRINT_FORMAT_VERSION}`,
      },
    };
  }
  const result = BlueprintSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_BLUEPRINT',
        message: result.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; '),
      },
    };
  }
  return { ok: true, blueprint: result.data };
}
