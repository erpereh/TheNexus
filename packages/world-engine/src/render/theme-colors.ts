import type { ThemeRuntime } from '@thenexus/asset-system';

/**
 * Theme token helpers for the render layer. Tokens are `#rrggbb`/`#rgb` CSS
 * strings; rendering needs `0xRRGGBB` numbers with deterministic fallbacks
 * so a missing token degrades to a designed default instead of black.
 */

/** Parses `#rgb`/`#rrggbb` (with or without `#`); returns `fallback` on junk. */
export function cssToHex(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[0] as string;
    const g = hex[1] as string;
    const b = hex[2] as string;
    return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return Number.parseInt(hex, 16);
  return fallback;
}

/** Token lookup with fallback. */
export function themeColor(theme: ThemeRuntime, name: string, fallback: number): number {
  return cssToHex(theme.token(name), fallback);
}

/** Room palette from the active theme with designed fallbacks. */
export function roomPalette(
  theme: ThemeRuntime,
  roomType: string,
): { base: number; accent: number; trim: number } {
  const skin = theme.roomSkin(roomType);
  return {
    base: cssToHex(skin?.palette['base'], 0x1a234d),
    accent: cssToHex(skin?.palette['accent'], 0x7c5cff),
    trim: cssToHex(skin?.palette['trim'], 0xb8a6ff),
  };
}

/** Station palette from the active theme with designed fallbacks. */
export function stationPalette(
  theme: ThemeRuntime,
  stationType: string,
): { base: number; glow: number } {
  const skin = theme.stationSkin(stationType);
  return {
    base: cssToHex(skin?.palette['base'], 0x2c3468),
    glow: cssToHex(skin?.palette['glow'], 0x54e0ff),
  };
}
