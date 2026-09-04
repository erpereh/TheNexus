import { z } from 'zod';
import { ThemeIdSchema } from './ids';
import { RoomTypeSchema, StationTypeSchema } from './semantics';

export const THEME_MANIFEST_VERSION = 1;

/**
 * A theme is a pure presentation layer. The strict schema structurally
 * prevents themes from defining activity/semantic mapping fields: themes
 * change how the world looks, never what observed activity means.
 */
export const ThemeSkinSchema = z.object({
  /** i18n key for the localized display name. */
  nameKey: z.string().min(1),
  palette: z.record(z.string(), z.string()),
  assetRefs: z.record(z.string(), z.string()).optional(),
});

export type ThemeSkin = z.infer<typeof ThemeSkinSchema>;

export const ThemeManifestSchema = z
  .object({
    manifestVersion: z.literal(THEME_MANIFEST_VERSION),
    themeId: ThemeIdSchema,
    name: z.string().min(1),
    tokens: z.record(z.string(), z.string()),
    roomSkins: z.partialRecord(RoomTypeSchema, ThemeSkinSchema),
    stationSkins: z.partialRecord(StationTypeSchema, ThemeSkinSchema),
    audioProfile: z.string().min(1).optional(),
    backgroundAsset: z.string().min(1).optional(),
  })
  .strict();

export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;

export type ThemeParseResult =
  | { ok: true; theme: ThemeManifest }
  | {
      ok: false;
      error: { code: 'UNSUPPORTED_VERSION' | 'INVALID_THEME'; message: string };
    };

/**
 * Safe parser for untrusted theme imports (game/03 treats themes as
 * importable content). Never throws: garbage becomes a structured error.
 */
export function parseTheme(input: unknown): ThemeParseResult {
  const claimedVersion =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as { manifestVersion?: unknown }).manifestVersion
      : undefined;
  if (claimedVersion !== undefined && claimedVersion !== THEME_MANIFEST_VERSION) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `theme manifestVersion must be ${THEME_MANIFEST_VERSION}`,
      },
    };
  }
  const result = ThemeManifestSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_THEME',
        message: result.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; '),
      },
    };
  }
  return { ok: true, theme: result.data };
}
