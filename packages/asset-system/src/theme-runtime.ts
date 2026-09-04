import type { ThemeManifest, ThemeSkin } from '@thenexus/contracts';

export interface ThemeRuntime {
  themeId(): string;
  roomSkin(roomType: string): ThemeSkin | undefined;
  stationSkin(stationType: string): ThemeSkin | undefined;
  token(name: string): string | undefined;
}

/**
 * Theme resolution with a deterministic fallback chain: the active theme
 * is queried first; missing skins/tokens fall through the provided
 * fallback themes in order. Switching themes can therefore never change
 * semantic mapping — lookups are keyed by semantic id only.
 */
export function createThemeRuntime(
  active: ThemeManifest,
  fallbacks: readonly ThemeManifest[],
): ThemeRuntime {
  const chain = [active, ...fallbacks];

  const skinLookup = (key: 'roomSkins' | 'stationSkins', id: string): ThemeSkin | undefined => {
    for (const theme of chain) {
      const skins = theme[key] as Record<string, ThemeSkin>;
      const skin = skins[id];
      if (skin !== undefined) return skin;
    }
    return undefined;
  };

  return {
    themeId: () => active.themeId,
    roomSkin: (roomType) => skinLookup('roomSkins', roomType),
    stationSkin: (stationType) => skinLookup('stationSkins', stationType),
    token: (name) => {
      for (const theme of chain) {
        const value = theme.tokens[name];
        if (value !== undefined) return value;
      }
      return undefined;
    },
  };
}
