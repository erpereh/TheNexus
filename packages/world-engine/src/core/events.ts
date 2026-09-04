import type { Cell } from './grid';

/**
 * Deterministic world-simulation event log. Events are append-only with a
 * monotonically increasing `seq`; an identical sequence of ticks always
 * produces an identical log (no wall-clock, no randomness, no reordering).
 */

export type WorldEventKind = 'character_spawned' | 'path_assigned' | 'arrived' | 'movement_blocked';

export interface WorldEventBase {
  /** 1-based append order across the whole log. */
  seq: number;
  /** Simulation tick the event belongs to (spawn/assign happen on tick 0). */
  tick: number;
  characterId: string;
}

export interface CharacterSpawnedEvent extends WorldEventBase {
  kind: 'character_spawned';
  cell: Cell;
}

export interface PathAssignedEvent extends WorldEventBase {
  kind: 'path_assigned';
  destination: Cell;
  pathLength: number;
}

export interface ArrivedEvent extends WorldEventBase {
  kind: 'arrived';
  cell: Cell;
}

export interface MovementBlockedEvent extends WorldEventBase {
  kind: 'movement_blocked';
  /** Cell the character wanted to enter. */
  cell: Cell;
  /** Why entry was refused this tick. */
  reason: 'blocked' | 'occupied';
}

export type WorldEvent =
  CharacterSpawnedEvent | PathAssignedEvent | ArrivedEvent | MovementBlockedEvent;

export class EventLog {
  private events: WorldEvent[] = [];
  private nextSeq = 1;

  get size(): number {
    return this.events.length;
  }

  /** Appends an event built with the next sequence number; returns it. */
  append<E extends WorldEvent>(build: (seq: number) => E): E {
    const event = build(this.nextSeq++);
    this.events.push(event);
    return event;
  }

  /** Full log in append order (live reference; treat as read-only). */
  all(): readonly WorldEvent[] {
    return this.events;
  }

  last(): WorldEvent | undefined {
    return this.events[this.events.length - 1];
  }

  clear(): void {
    this.events = [];
    this.nextSeq = 1;
  }
}
