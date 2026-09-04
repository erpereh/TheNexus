import { describe, expect, it } from 'vitest';
import { ThemeManifestSchema, type ThemeManifest } from './theme';
import { parseBlueprint, type Blueprint } from './blueprint';

const validTheme: ThemeManifest = {
  manifestVersion: 1,
  themeId: 'theme_space_fantasy',
  name: 'Anime Space Fantasy',
  tokens: {
    'color.primary': '#7c5cff',
    'color.background': '#0a0e22',
  },
  roomSkins: {
    laboratory: { nameKey: 'room.astralLaboratory', palette: { base: '#223' } },
    lounge: { nameKey: 'room.lounge', palette: { base: '#314' } },
  },
  stationSkins: {
    test_bench: { nameKey: 'station.crystalTestBench', palette: { base: '#548' } },
  },
  audioProfile: 'celestial-calm',
};

describe('ThemeManifestSchema', () => {
  it('parses a valid theme manifest', () => {
    const parsed = ThemeManifestSchema.parse(validTheme);
    expect(parsed.themeId).toBe('theme_space_fantasy');
    expect(parsed.roomSkins.laboratory?.nameKey).toBe('room.astralLaboratory');
  });

  it('rejects unknown room/station semantic keys', () => {
    expect(() =>
      ThemeManifestSchema.parse({
        ...validTheme,
        roomSkins: { reactor: validTheme.roomSkins.laboratory },
      }),
    ).toThrow();
    expect(() =>
      ThemeManifestSchema.parse({
        ...validTheme,
        stationSkins: { hyperdrive: validTheme.stationSkins.test_bench },
      }),
    ).toThrow();
  });

  it('structurally prevents themes from redefining activity semantics', () => {
    // Strict schema: adding an activity-semantic field must fail parsing.
    expect(() =>
      ThemeManifestSchema.parse({
        ...validTheme,
        activity: 'divine-intervention',
      }),
    ).toThrow();
    expect(() =>
      ThemeManifestSchema.parse({
        ...validTheme,
        activityMapping: { testing: 'laboratory' },
      }),
    ).toThrow();
  });

  it('rejects wrong id prefixes and versions', () => {
    expect(() => ThemeManifestSchema.parse({ ...validTheme, themeId: 'pack_nova' })).toThrow();
    expect(() => ThemeManifestSchema.parse({ ...validTheme, manifestVersion: 2 })).toThrow();
  });
});

const validBlueprint: Blueprint = {
  formatVersion: 1,
  blueprintId: 'bp_lab_small',
  name: 'Small Laboratory',
  roomType: 'laboratory',
  footprint: { width: 6, height: 6 },
  objects: [
    {
      stationType: 'test_bench',
      gridX: 1,
      gridY: 1,
      rotation: 0,
      freeOffset: { x: 0.1, y: 0 },
    },
    {
      stationType: 'generic_workstation',
      gridX: 4,
      gridY: 3,
      rotation: 180,
    },
  ],
  requiredAssetRefs: ['skin.laboratory.default'],
};

describe('BlueprintSchema', () => {
  it('round-trips deterministically', () => {
    const parsed = parseBlueprint(validBlueprint);
    if (!parsed.ok) throw new Error('expected valid blueprint');
    expect(JSON.stringify(parsed.blueprint)).toBe(
      JSON.stringify(JSON.parse(JSON.stringify(validBlueprint))),
    );
  });

  it('enforces footprint bounds and object placement', () => {
    const huge = { ...validBlueprint, footprint: { width: 100, height: 2 } };
    expect(parseBlueprint(huge).ok).toBe(false);

    const outside = {
      ...validBlueprint,
      objects: [{ stationType: 'test_bench', gridX: 9, gridY: 1, rotation: 0 }],
    };
    expect(parseBlueprint(outside).ok).toBe(false);
  });

  it('enforces the rotation enum and station semantics', () => {
    const badRotation = {
      ...validBlueprint,
      objects: [{ stationType: 'test_bench', gridX: 1, gridY: 1, rotation: 45 }],
    };
    expect(parseBlueprint(badRotation).ok).toBe(false);

    const badStation = {
      ...validBlueprint,
      objects: [{ stationType: 'warp_core', gridX: 1, gridY: 1, rotation: 0 }],
    };
    expect(parseBlueprint(badStation).ok).toBe(false);
  });

  it('fails safely on garbage input without throwing', () => {
    for (const garbage of [null, 'string', 42, [], {}, undefined]) {
      const result = parseBlueprint(garbage);
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    }
  });
});
