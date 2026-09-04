import { describe, expect, it } from 'vitest';
import { SpatialIndex, type SpatialItem } from './spatial-index';

function item(id: string, x: number, y: number, radius = 0): SpatialItem {
  return { id, x, y, radius };
}

describe('SpatialIndex', () => {
  it('returns only items intersecting the query rect, sorted by id ascending', () => {
    const index = new SpatialIndex(4);
    index.insert(item('char_c', 1, 1));
    index.insert(item('char_a', 9, 9));
    index.insert(item('char_b', 5, 5));
    index.insert(item('char_d', 5, 1, 2));

    // radius-2 item at (5,1) spans x[3..7] y[-1..3] -> overlaps both rects.
    expect(index.queryRect({ x: 0, y: 0, width: 4, height: 4 })).toEqual([
      item('char_c', 1, 1),
      item('char_d', 5, 1, 2),
    ]);
    expect(index.queryRect({ x: 4, y: 0, width: 4, height: 4 })).toEqual([item('char_d', 5, 1, 2)]);
    const everything = index.queryRect({ x: -8, y: -8, width: 32, height: 32 });
    expect(everything.map((i) => i.id)).toEqual(['char_a', 'char_b', 'char_c', 'char_d']);
  });

  it('excludes items that merely neighbor the rect', () => {
    const index = new SpatialIndex(4);
    index.insert(item('a', 0, 0));
    index.insert(item('b', 4, 0));
    expect(index.queryRect({ x: 0, y: 0, width: 4, height: 4 }).map((i) => i.id)).toEqual([
      'a',
      'b',
    ]);
    // Shrink the rect below b's edge: only a remains, then neither.
    expect(index.queryRect({ x: 0, y: 0, width: 3.5, height: 3.5 })).toEqual([item('a', 0, 0)]);
    expect(index.queryRect({ x: 1, y: 1, width: 2, height: 2 })).toEqual([]);
  });

  it('reflects update and remove immediately', () => {
    const index = new SpatialIndex(4);
    index.insert(item('a', 1, 1));
    expect(index.queryRect({ x: 0, y: 0, width: 4, height: 4 })).toHaveLength(1);
    index.update('a', 9, 9);
    expect(index.queryRect({ x: 0, y: 0, width: 4, height: 4 })).toHaveLength(0);
    expect(index.queryRect({ x: 8, y: 8, width: 4, height: 4 })).toEqual([item('a', 9, 9)]);
    expect(index.remove('a')).toBe(true);
    expect(index.remove('a')).toBe(false);
    expect(index.size).toBe(0);
  });

  it('matches a brute-force filter across many items and bucket boundaries', () => {
    const index = new SpatialIndex(3);
    const items: SpatialItem[] = [];
    for (let i = 0; i < 120; i++) {
      const it = item(`it_${String(i).padStart(3, '0')}`, (i * 7) % 31, (i * 5) % 29, i % 3);
      items.push(it);
      index.insert(it);
    }
    const rects = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 12, y: 8, width: 6, height: 5 },
      { x: -5, y: -5, width: 40, height: 40 },
    ];
    for (const rect of rects) {
      const expected = items
        .filter(
          (it) =>
            it.x - it.radius <= rect.x + rect.width &&
            it.x + it.radius >= rect.x &&
            it.y - it.radius <= rect.y + rect.height &&
            it.y + it.radius >= rect.y,
        )
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      expect(index.queryRect(rect)).toEqual(expected);
    }
    expect(index.size).toBe(120);
  });
});
