import type { Cell } from './grid';

/**
 * Character controller: pure path-following state and stepping logic.
 * Deterministic, world-agnostic (walkability/claims are injected), and free
 * of rendering, providers and wall-clock sources.
 */

/** Cardinal facing derived from the dominant velocity axis. */
export type Facing = 'N' | 'E' | 'S' | 'W';

/**
 * Grid-space movement convention: N = (0,-1), S = (0,+1), E = (+1,0),
 * W = (-1,0). These are *grid* facings, not screen facings; the animation
 * layer maps them onto the four diagonal pack directions.
 */
export interface CharacterState {
  id: string;
  /** Cell currently occupied. */
  cell: Cell;
  /** Full assigned route; path[0] is the cell the character started from. */
  path: readonly Cell[];
  /** Index into `path` of the currently occupied cell. */
  pathIndex: number;
  facing: Facing;
  /** True while the character wanted to advance but could not. */
  waiting: boolean;
}

/** New character standing on `cell`, idle, facing "towards the camera" (S). */
export function createCharacter(id: string, cell: Cell): CharacterState {
  return { id, cell: { ...cell }, path: [{ ...cell }], pathIndex: 0, facing: 'S', waiting: false };
}

/**
 * Facing from the dominant velocity axis. Exact diagonal ties resolve to the
 * horizontal axis (E/W) so results are deterministic; zero movement keeps
 * the previous facing.
 */
export function facingFromDelta(dx: number, dy: number, previous: Facing): Facing {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx === 0 && ady === 0) return previous;
  if (adx > ady) return dx > 0 ? 'E' : 'W';
  if (ady > adx) return dy > 0 ? 'S' : 'N';
  return dx > 0 ? 'E' : 'W'; // perfect diagonal: horizontal wins the tie
}

export interface CharacterStepContext {
  /**
   * May the character enter this cell on this tick? Encapsulates grid
   * walkability plus per-tick cell claims held by other characters.
   */
  canEnter(cell: Cell): boolean;
}

export interface CharacterStepResult {
  /** Updated state (new object on move/block, same object when idle). */
  character: CharacterState;
  moved: boolean;
  /** True when the character wanted to move but was refused. */
  blocked: boolean;
  /** True when this step reached the final path cell. */
  arrived: boolean;
}

/** Attempts one step along the path. Never mutates the input state. */
export function stepCharacter(
  character: CharacterState,
  context: CharacterStepContext,
): CharacterStepResult {
  const nextIndex = character.pathIndex + 1;
  const next = character.path[nextIndex];
  if (next === undefined) {
    return { character, moved: false, blocked: false, arrived: false };
  }
  if (!context.canEnter(next)) {
    return {
      character: { ...character, waiting: true },
      moved: false,
      blocked: true,
      arrived: false,
    };
  }
  const facing = facingFromDelta(
    next.x - character.cell.x,
    next.y - character.cell.y,
    character.facing,
  );
  return {
    character: {
      ...character,
      cell: { ...next },
      pathIndex: nextIndex,
      facing,
      waiting: false,
    },
    moved: true,
    blocked: false,
    arrived: nextIndex === character.path.length - 1,
  };
}

/** Remaining route including the currently occupied cell. */
export function pathRemaining(character: CharacterState): readonly Cell[] {
  return character.path.slice(character.pathIndex);
}
