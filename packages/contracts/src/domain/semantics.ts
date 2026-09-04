import { z } from 'zod';

/**
 * Semantic room types (docs/architecture/02-event-model-and-mapping.md).
 * Themes resolve these into concrete presentation; provider names never do.
 */
export const ROOM_TYPES = [
  'command',
  'engineering',
  'laboratory',
  'library',
  'observatory',
  'communications',
  'archive',
  'lounge',
  'generic_workstation',
] as const;

export const RoomTypeSchema = z.enum(ROOM_TYPES);
export type RoomType = z.infer<typeof RoomTypeSchema>;

/**
 * Semantic station types. Each maps to at least one compatible room type;
 * `generic_workstation` is the universal fallback that exists in every ship.
 */
export const STATION_TYPES = [
  'coding_workstation',
  'test_bench',
  'reading_desk',
  'research_scope',
  'planning_holo',
  'comm_console',
  'archive_terminal',
  'lounge_seat',
  'core_console',
  'generic_workstation',
] as const;

export const StationTypeSchema = z.enum(STATION_TYPES);
export type StationType = z.infer<typeof StationTypeSchema>;

/**
 * Default room -> compatible station types. The mapping engine uses this to
 * find fallback stations when a preferred room is missing.
 */
export const ROOM_TYPE_TO_STATION_TYPES: Record<RoomType, readonly StationType[]> = {
  command: ['planning_holo', 'core_console'],
  engineering: ['coding_workstation'],
  laboratory: ['test_bench'],
  library: ['reading_desk'],
  observatory: ['research_scope'],
  communications: ['comm_console'],
  archive: ['archive_terminal'],
  lounge: ['lounge_seat'],
  generic_workstation: ['generic_workstation'],
};

/** Station types every ship guarantees (mapping fallback endpoints). */
export const UNIVERSAL_STATION_TYPES: readonly StationType[] = ['generic_workstation'];
