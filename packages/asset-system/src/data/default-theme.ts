import type { ThemeManifest } from '@thenexus/contracts';

/**
 * The official default theme: anime space-fantasy (docs/art/01).
 * Celestial architecture + arcane technology expressed through runic
 * holograms, crystal cores and constellation lines. Presentation only —
 * the manifest carries zero activity semantics by construction.
 *
 * Asset refs are placeholders for the sprite/effect pipeline; colors and
 * name keys are the load-bearing part for the theme runtime and i18n.
 */
export const DEFAULT_THEME: ThemeManifest = {
  manifestVersion: 1,
  themeId: 'theme_space_fantasy',
  name: 'Anime Space Fantasy',
  tokens: {
    'color.background.deep': '#070b1e',
    'color.background.station': '#101735',
    'color.platform.base': '#1a234d',
    'color.platform.inlay': '#2d3a7a',
    'color.crystal.core': '#7c5cff',
    'color.crystal.glow': '#b8a6ff',
    'color.rune.active': '#54e0ff',
    'color.rune.idle': '#37577a',
    'color.constellation.line': '#8ea2ff',
    'color.status.error': '#ff5470',
    'color.status.waiting': '#ffc857',
    'color.status.completed': '#5dffa9',
    'color.text.primary': '#e8ecff',
    'window.nebula': 'asset.windows.nebula',
    'ambient.particles': 'asset.particles.stardust',
  },
  roomSkins: {
    command: {
      nameKey: 'room.command',
      palette: { base: '#1c2a5e', accent: '#7c5cff', trim: '#b8a6ff' },
      assetRefs: { floor: 'asset.floor.command', walls: 'asset.walls.command' },
    },
    engineering: {
      nameKey: 'room.engineering',
      palette: { base: '#232a55', accent: '#54e0ff', trim: '#9fe8ff' },
      assetRefs: { floor: 'asset.floor.engineering', walls: 'asset.walls.engineering' },
    },
    laboratory: {
      nameKey: 'room.laboratory',
      palette: { base: '#1e2f52', accent: '#66f0d0', trim: '#b3fff0' },
      assetRefs: { floor: 'asset.floor.laboratory', walls: 'asset.walls.laboratory' },
    },
    library: {
      nameKey: 'room.library',
      palette: { base: '#2a264f', accent: '#c9a3ff', trim: '#e8d6ff' },
      assetRefs: { floor: 'asset.floor.library', walls: 'asset.walls.library' },
    },
    observatory: {
      nameKey: 'room.observatory',
      palette: { base: '#141c44', accent: '#8ea2ff', trim: '#cfd8ff' },
      assetRefs: { floor: 'asset.floor.observatory', walls: 'asset.walls.observatory' },
    },
    communications: {
      nameKey: 'room.communications',
      palette: { base: '#20264e', accent: '#ff9e6b', trim: '#ffd0b8' },
      assetRefs: { floor: 'asset.floor.communications', walls: 'asset.walls.communications' },
    },
    archive: {
      nameKey: 'room.archive',
      palette: { base: '#252743', accent: '#9aa7d6', trim: '#d6dcf5' },
      assetRefs: { floor: 'asset.floor.archive', walls: 'asset.walls.archive' },
    },
    lounge: {
      nameKey: 'room.lounge',
      palette: { base: '#2b2850', accent: '#ff7eb0', trim: '#ffd3e4' },
      assetRefs: { floor: 'asset.floor.lounge', walls: 'asset.walls.lounge' },
    },
    generic_workstation: {
      nameKey: 'room.generic',
      palette: { base: '#20264a', accent: '#7c5cff', trim: '#b8a6ff' },
      assetRefs: { floor: 'asset.floor.generic', walls: 'asset.walls.generic' },
    },
  },
  stationSkins: {
    planning_holo: {
      nameKey: 'station.planningHolo',
      palette: { base: '#31346b', glow: '#54e0ff' },
    },
    core_console: { nameKey: 'station.coreConsole', palette: { base: '#2a2f66', glow: '#7c5cff' } },
    coding_workstation: {
      nameKey: 'station.codingWorkstation',
      palette: { base: '#2c3468', glow: '#54e0ff' },
    },
    test_bench: { nameKey: 'station.testBench', palette: { base: '#28455e', glow: '#66f0d0' } },
    reading_desk: { nameKey: 'station.readingDesk', palette: { base: '#3a3568', glow: '#c9a3ff' } },
    research_scope: {
      nameKey: 'station.researchScope',
      palette: { base: '#22294f', glow: '#8ea2ff' },
    },
    comm_console: { nameKey: 'station.commConsole', palette: { base: '#332f5f', glow: '#ff9e6b' } },
    archive_terminal: {
      nameKey: 'station.archiveTerminal',
      palette: { base: '#2c2f4d', glow: '#9aa7d6' },
    },
    lounge_seat: { nameKey: 'station.loungeSeat', palette: { base: '#3b3363', glow: '#ff7eb0' } },
    generic_workstation: {
      nameKey: 'station.generic',
      palette: { base: '#2b2f58', glow: '#7c5cff' },
    },
  },
  audioProfile: 'celestial-calm',
  backgroundAsset: 'asset.background.starfield',
};
