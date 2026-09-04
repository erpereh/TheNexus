import { describe, expect, it } from 'vitest';
import { parseTheme, type ThemeManifest } from '@thenexus/contracts';
import { DEFAULT_THEME } from './data/default-theme';
import { createThemeRuntime } from './theme-runtime';

describe('DEFAULT_THEME', () => {
  it('parses against the canonical theme manifest schema', () => {
    const parsed = parseTheme(DEFAULT_THEME);
    expect(parsed.ok).toBe(true);
  });

  it('skins every semantic room and station type (no uncovered semantics)', () => {
    expect(Object.keys(DEFAULT_THEME.roomSkins)).toHaveLength(9);
    expect(Object.keys(DEFAULT_THEME.stationSkins)).toHaveLength(10);
  });

  it('carries no activity semantics (theme is presentation only)', () => {
    expect(DEFAULT_THEME).not.toHaveProperty('activity');
    expect(JSON.stringify(DEFAULT_THEME)).not.toContain('activityMapping');
  });
});

describe('createThemeRuntime', () => {
  const runtime = createThemeRuntime(DEFAULT_THEME, []);

  it('resolves a room skin for a semantic room type', () => {
    const skin = runtime.roomSkin('laboratory');
    expect(skin?.nameKey).toBe('room.laboratory');
  });

  it('resolves a station skin for a semantic station type', () => {
    const skin = runtime.stationSkin('test_bench');
    expect(skin?.nameKey).toBe('station.testBench');
  });

  it('returns null (not a crash) for semantics the theme lacks', () => {
    const sparse: ThemeManifest = {
      ...DEFAULT_THEME,
      roomSkins: {},
      stationSkins: {},
    };
    const sparseRuntime = createThemeRuntime(sparse, []);
    expect(sparseRuntime.roomSkin('laboratory')).toBeUndefined();
  });

  it('falls back through a fallback chain when the primary theme lacks a skin', () => {
    const sparse: ThemeManifest = {
      manifestVersion: 1,
      themeId: 'theme_minimal',
      name: 'Minimal',
      tokens: {},
      roomSkins: {},
      stationSkins: {},
    };
    const runtime = createThemeRuntime(sparse, [DEFAULT_THEME]);
    expect(runtime.roomSkin('laboratory')?.nameKey).toBe('room.laboratory');
    // And the fallback does not change any semantic mapping:
    expect(runtime.themeId()).toBe('theme_minimal');
  });

  it('switching theme preserves semantics (same skin lookups keyed semantically)', () => {
    const switched = createThemeRuntime(DEFAULT_THEME, []);
    const before = switched.stationSkin('test_bench')?.nameKey;
    const sparseRuntime = createThemeRuntime(
      { ...DEFAULT_THEME, themeId: 'theme_other', stationSkins: {} },
      [DEFAULT_THEME],
    );
    expect(sparseRuntime.stationSkin('test_bench')?.nameKey).toBe(before);
    expect(sparseRuntime.themeId()).toBe('theme_other');
  });
});
