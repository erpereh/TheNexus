import { describe, expect, it } from 'vitest';
import { createCharacter, facingFromDelta, stepCharacter, type CharacterState } from './character';
import type { Cell } from './grid';

describe('facing from dominant velocity axis', () => {
  it('maps pure axis movement to the four cardinal facings', () => {
    expect(facingFromDelta(1, 0, 'N')).toBe('E');
    expect(facingFromDelta(-1, 0, 'N')).toBe('W');
    expect(facingFromDelta(0, 1, 'N')).toBe('S');
    expect(facingFromDelta(0, -1, 'N')).toBe('N');
  });

  it('follows the dominant axis for mixed movement', () => {
    expect(facingFromDelta(2, 1, 'N')).toBe('E');
    expect(facingFromDelta(1, 2, 'W')).toBe('S');
    expect(facingFromDelta(-2, 1, 'N')).toBe('W');
    expect(facingFromDelta(1, -2, 'S')).toBe('N');
  });

  it('breaks exact diagonal ties toward the horizontal axis', () => {
    expect(facingFromDelta(1, 1, 'N')).toBe('E');
    expect(facingFromDelta(1, -1, 'N')).toBe('E');
    expect(facingFromDelta(-1, 1, 'N')).toBe('W');
    expect(facingFromDelta(-1, -1, 'N')).toBe('W');
  });

  it('keeps the previous facing for zero movement', () => {
    expect(facingFromDelta(0, 0, 'N')).toBe('N');
    expect(facingFromDelta(0, 0, 'W')).toBe('W');
  });
});

describe('stepCharacter', () => {
  const straightPath: Cell[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];

  function characterOn(path: readonly Cell[]): CharacterState {
    const start = path[0];
    if (start === undefined) throw new Error('path needs a start');
    return { ...createCharacter('char_1', start), path: [...path], pathIndex: 0 };
  }

  it('advances one cell per step and reports arrival on the last cell', () => {
    let character = characterOn(straightPath);
    const enterEverything = (): boolean => true;

    const step1 = stepCharacter(character, { canEnter: enterEverything });
    expect(step1.moved).toBe(true);
    expect(step1.arrived).toBe(false);
    expect(step1.character.cell).toEqual({ x: 1, y: 0 });
    expect(step1.character.pathIndex).toBe(1);
    expect(step1.character.facing).toBe('E');
    character = step1.character;

    const step2 = stepCharacter(character, { canEnter: enterEverything });
    expect(step2.moved).toBe(true);
    expect(step2.arrived).toBe(true);
    expect(step2.character.cell).toEqual({ x: 2, y: 0 });
    expect(step2.character.facing).toBe('E');
  });

  it('never steps into a cell the context refuses and flags waiting', () => {
    const character = characterOn(straightPath);
    const result = stepCharacter(character, { canEnter: () => false });
    expect(result.moved).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.arrived).toBe(false);
    expect(result.character.cell).toEqual({ x: 0, y: 0 });
    expect(result.character.waiting).toBe(true);
  });

  it('is a no-op once the path is exhausted', () => {
    const character = characterOn(straightPath);
    const atEnd: CharacterState = { ...character, pathIndex: 2 };
    const result = stepCharacter(atEnd, { canEnter: () => true });
    expect(result.moved).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.arrived).toBe(false);
    expect(result.character).toBe(atEnd);
  });

  it('updates facing per step for diagonal legs via the dominant axis', () => {
    const diagonalPath: Cell[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 3 },
    ];
    let character = characterOn(diagonalPath);
    character = stepCharacter(character, { canEnter: () => true }).character;
    expect(character.facing).toBe('E'); // (1,1) diagonal tie -> horizontal
    character = stepCharacter(character, { canEnter: () => true }).character;
    expect(character.facing).toBe('S'); // (0,2) dominant vertical
  });

  it('createCharacter starts idle on a single-cell path facing south', () => {
    const character = createCharacter('char_9', { x: 4, y: 5 });
    expect(character.path).toEqual([{ x: 4, y: 5 }]);
    expect(character.pathIndex).toBe(0);
    expect(character.facing).toBe('S');
    expect(character.waiting).toBe(false);
  });
});
