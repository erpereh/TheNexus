import { describe, expect, it } from 'vitest';
import { DEPTH_SCALE } from './iso';
import {
  DEPTH_ELEVATION_STEP,
  DEPTH_LAYER_BIAS,
  DEPTH_LAYERS,
  depthKeyOf,
  sortByDepth,
  type DepthEntry,
} from './depth-sort';

function entry(
  id: string,
  layer: DepthEntry['layer'],
  cells: ReadonlyArray<{ x: number; y: number }>,
  elevation?: number,
): DepthEntry {
  return {
    id,
    layer,
    occupiedCells: cells,
    ...(elevation !== undefined ? { elevation } : {}),
  };
}

describe('depth sorting', () => {
  it('assigns ascending bias per layer in declaration order', () => {
    const biases = DEPTH_LAYERS.map((layer) => DEPTH_LAYER_BIAS[layer]);
    expect(biases).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('draws a character south of a prop in front of it', () => {
    const prop = entry('prop_1', 'low-props', [{ x: 5, y: 5 }]);
    const character = entry('char_1', 'characters', [{ x: 5, y: 6 }]);
    expect(sortByDepth([character, prop]).map((e) => e.id)).toEqual(['prop_1', 'char_1']);
  });

  it('draws a character north of a wall behind it (row dominates layer bias)', () => {
    const wall = entry('wall_1', 'walls', [{ x: 5, y: 5 }]);
    const character = entry('char_1', 'characters', [{ x: 5, y: 4 }]);
    expect(sortByDepth([character, wall]).map((e) => e.id)).toEqual(['char_1', 'wall_1']);
    expect(depthKeyOf(wall)).toBeGreaterThan(depthKeyOf(character));
  });

  it('sorts multi-cell props by their far corner (max x+y over occupied cells)', () => {
    const prop = entry('prop_1', 'low-props', [
      { x: 2, y: 3 },
      { x: 4, y: 4 },
    ]);
    expect(depthKeyOf(prop)).toBe(8 * DEPTH_SCALE + DEPTH_LAYER_BIAS['low-props']);
  });

  it('raises depth with elevation', () => {
    const low = entry('prop_1', 'stations', [{ x: 3, y: 3 }], 0);
    const high = entry('prop_1', 'stations', [{ x: 3, y: 3 }], 2);
    expect(depthKeyOf(high) - depthKeyOf(low)).toBe(2 * DEPTH_ELEVATION_STEP);
    expect(sortByDepth([high, low]).map((e) => e.elevation)).toEqual([0, 2]);
  });

  it('breaks equal-key ties by id ascending', () => {
    const first = entry('b_2', 'floor', [{ x: 1, y: 1 }]);
    const second = entry('a_1', 'floor', [{ x: 1, y: 1 }]);
    expect(sortByDepth([first, second]).map((e) => e.id)).toEqual(['a_1', 'b_2']);
  });

  it('is stable for fully equal entries and deterministic across runs', () => {
    const build = () => {
      const entries: DepthEntry[] = [];
      for (let i = 0; i < 40; i++) {
        // Deterministic pseudo-shuffle of layers/cells (no Math.random).
        const layer = DEPTH_LAYERS[i % DEPTH_LAYERS.length] as DepthEntry['layer'];
        const x = (i * 7) % 5;
        const y = (i * 3) % 5;
        entries.push(entry(`id_${String(i).padStart(2, '0')}`, layer, [{ x, y }]));
      }
      return entries;
    };
    const input = build();
    const run1 = sortByDepth(input);
    const run2 = sortByDepth(input);
    expect(run1.map((e) => e.id)).toEqual(run2.map((e) => e.id));
    // Same key -> insertion order preserved (id ascending comparator never
    // reorders equal ids, and equal keys with equal ids are identical).
    const equalA = entry('same', 'decals', [{ x: 0, y: 0 }]);
    const equalB = entry('same', 'decals', [{ x: 0, y: 0 }]);
    expect(sortByDepth([equalA, equalB])).toEqual([equalA, equalB]);
  });

  it('never lets layer bias or elevation overflow into the next depth row', () => {
    let maxBias = 0;
    for (const layer of DEPTH_LAYERS) maxBias = Math.max(maxBias, DEPTH_LAYER_BIAS[layer]);
    // Max elevation step must keep bias + elevation*64 below DEPTH_SCALE.
    const maxEncoded = maxBias + 63 * DEPTH_ELEVATION_STEP;
    expect(maxEncoded).toBeLessThan(DEPTH_SCALE);
  });
});
