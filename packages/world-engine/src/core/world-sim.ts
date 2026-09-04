import { createCharacter, stepCharacter, type CharacterState, type Facing } from './character';
import { EventLog } from './events';
import { TileGrid, type Cell } from './grid';

/**
 * Fixed-step headless world simulation.
 *
 * - Determinism: `advance` drains a 100ms accumulator in fixed ticks; the
 *   per-tick character processing order is id-ascending, claims are resolved
 *   first-come in that order, and the event log is append-only with
 *   monotonic seq. Identical tick sequences -> byte-identical logs. No
 *   Math.random, no Date.now anywhere in the loop.
 * - Deadlock avoidance (simple): every character claims its current cell for
 *   the tick and adds a claim on the cell it moves into; a character may
 *   therefore never enter a cell another character holds, which also rules
 *   out swap-throughs. Vacated cells stay claimed for the rest of the tick.
 * - Movement rate: one path cell per tick (10 cells/s at 100ms), the coarse
 *   rate the isometric cell art is authored for.
 */

export const TICK_MS = 100;

export interface CharacterSpec {
  id: string;
  cell: Cell;
}

export interface CharacterSnapshot {
  id: string;
  cell: Cell;
  facing: Facing;
  /** True when the character still has path legs to walk. */
  moving: boolean;
  waiting: boolean;
  /** Final path cell while moving; null when idle. */
  destination: Cell | null;
}

export interface WorldSnapshot {
  tick: number;
  characters: readonly CharacterSnapshot[];
}

export class WorldSim {
  readonly grid: TileGrid;
  readonly log: EventLog;

  private readonly characters = new Map<string, CharacterState>();
  /** Spawn order; per-tick processing always re-sorts ids ascending. */
  private readonly spawnOrder: string[] = [];
  private tickCounter = 0;
  private accumulatorMs = 0;

  constructor(grid: TileGrid, specs: readonly CharacterSpec[] = []) {
    this.grid = grid;
    this.log = new EventLog();
    for (const spec of specs) this.spawn(spec.id, spec.cell);
  }

  /** Number of completed fixed ticks. */
  get currentTick(): number {
    return this.tickCounter;
  }

  spawn(id: string, cell: Cell): void {
    if (this.characters.has(id)) throw new Error(`character "${id}" already exists`);
    if (this.grid.isBlocked(cell.x, cell.y)) {
      throw new Error(`cannot spawn "${id}" on blocked cell ${cell.x},${cell.y}`);
    }
    if (this.characterAt(cell) !== undefined) {
      throw new Error(`cannot spawn "${id}" on occupied cell ${cell.x},${cell.y}`);
    }
    this.characters.set(id, createCharacter(id, cell));
    this.spawnOrder.push(id);
    this.log.append((seq) => ({
      seq,
      tick: this.tickCounter,
      characterId: id,
      kind: 'character_spawned',
      cell: { ...cell },
    }));
  }

  /**
   * Assigns a route whose first cell must be the character's current cell.
   * Later cells are not pre-validated: per-tick checks and event log handle
   * cells that become blocked after assignment.
   */
  assignPath(id: string, path: readonly Cell[]): void {
    const character = this.characters.get(id);
    if (character === undefined) throw new Error(`unknown character "${id}"`);
    if (path.length === 0) return;
    const first = path[0];
    if (first === undefined) return;
    if (first.x !== character.cell.x || first.y !== character.cell.y) {
      throw new Error(
        `path for "${id}" must start at its current cell ${character.cell.x},${character.cell.y}`,
      );
    }
    const last = path[path.length - 1];
    this.characters.set(id, { ...character, path: [...path], pathIndex: 0, waiting: false });
    if (last !== undefined) {
      this.log.append((seq) => ({
        seq,
        tick: this.tickCounter,
        characterId: id,
        kind: 'path_assigned',
        destination: { ...last },
        pathLength: path.length,
      }));
    }
  }

  /**
   * Advances real time; drains the accumulator in fixed TICK_MS steps. Non-
   * positive dt is ignored. There is deliberately no upper bound: callers
   * control dt, and clamping would break tick-for-tick determinism.
   */
  advance(dtMs: number): void {
    if (!(dtMs > 0)) return;
    this.accumulatorMs += dtMs;
    while (this.accumulatorMs >= TICK_MS) {
      this.tick();
      this.accumulatorMs -= TICK_MS;
    }
  }

  /** Runs exactly one fixed simulation step. */
  tick(): void {
    this.tickCounter += 1;
    const ordered = [...this.spawnOrder].sort();
    const claims = new Map<number, string>();
    for (const id of ordered) {
      const character = this.characters.get(id);
      if (character !== undefined) {
        claims.set(this.grid.index(character.cell.x, character.cell.y), id);
      }
    }
    for (const id of ordered) {
      const character = this.characters.get(id);
      if (character === undefined) continue;
      const result = stepCharacter(character, {
        canEnter: (cell: Cell): boolean => {
          if (this.grid.isBlocked(cell.x, cell.y)) return false;
          const holder = claims.get(this.grid.index(cell.x, cell.y));
          return holder === undefined || holder === id;
        },
      });
      if (result.moved) {
        claims.set(this.grid.index(result.character.cell.x, result.character.cell.y), id);
      }
      if (result.blocked && !character.waiting) {
        // one event per waiting episode, not per tick
        const nextCell = character.path[character.pathIndex + 1];
        if (nextCell !== undefined) {
          const reason = this.grid.isBlocked(nextCell.x, nextCell.y) ? 'blocked' : 'occupied';
          this.log.append((seq) => ({
            seq,
            tick: this.tickCounter,
            characterId: id,
            kind: 'movement_blocked',
            cell: { ...nextCell },
            reason,
          }));
        }
      }
      this.characters.set(id, result.character);
      if (result.arrived) {
        this.log.append((seq) => ({
          seq,
          tick: this.tickCounter,
          characterId: id,
          kind: 'arrived',
          cell: { ...result.character.cell },
        }));
        this.characters.set(id, {
          ...result.character,
          path: [{ ...result.character.cell }],
          pathIndex: 0,
        });
      }
    }
  }

  /** Id of the character occupying `cell`, if any. */
  characterAt(cell: Cell): string | undefined {
    for (const id of this.spawnOrder) {
      const character = this.characters.get(id);
      if (character === undefined) continue;
      if (character.cell.x === cell.x && character.cell.y === cell.y) return id;
    }
    return undefined;
  }

  getCharacter(id: string): CharacterState | undefined {
    return this.characters.get(id);
  }

  /** Render-facing snapshot in spawn order. */
  snapshot(): WorldSnapshot {
    return {
      tick: this.tickCounter,
      characters: this.spawnOrder.map((id) => {
        const character = this.characters.get(id);
        if (character === undefined) {
          throw new Error(`character "${id}" missing from simulation state`);
        }
        const moving = character.pathIndex < character.path.length - 1;
        const destination = moving ? character.path[character.path.length - 1] : undefined;
        return {
          id,
          cell: { ...character.cell },
          facing: character.facing,
          moving,
          waiting: character.waiting,
          ...(destination !== undefined
            ? { destination: { ...destination } }
            : { destination: null }),
        };
      }),
    };
  }
}
