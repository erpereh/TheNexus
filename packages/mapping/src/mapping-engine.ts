import {
  selectMappingRule,
  type MappingRule,
  type NormalizedEvent,
  type SemanticActivity,
  type StationType,
} from '@thenexus/contracts';

/** Minimal ship-layout view the mapping engine reasons over. */
export interface MappingRoomView {
  roomInstanceId: string;
  roomType: string;
  center: { col: number; row: number };
}

export interface MappingStationView {
  stationInstanceId: string;
  stationType: string;
  roomInstanceId: string;
  cell: { col: number; row: number };
  available: boolean;
}

export interface MappingShipLayout {
  rooms: readonly MappingRoomView[];
  stations: readonly MappingStationView[];
}

export interface MappingResolution {
  ruleId: string | null;
  activity: SemanticActivity;
  roomType: string;
  roomInstanceId: string | null;
  stationType: string;
  stationInstanceId: string | null;
  animationIntent: string;
  effectIntent: string | null;
  statusDisplay: 'always' | 'overview' | 'hidden';
  /** Ordered record of fallback steps taken (Mapping Debugger trace). */
  fallbackSteps: string[];
  /** Human-readable diagnostic when fallbacks degraded the resolution. */
  diagnostic: string | null;
}

const dist = (a: { col: number; row: number }, b: { col: number; row: number }): number =>
  (a.col - b.col) ** 2 + (a.row - b.row) ** 2;

function rule(
  id: string,
  activity: SemanticActivity,
  roomType: MappingRule['preferredRoomType'],
  stationType: StationType,
  animationIntent: string,
  extra: Partial<MappingRule> = {},
): MappingRule {
  return {
    id,
    enabled: true,
    priority: 0,
    match: { activity },
    preferredRoomType: roomType,
    preferredStationType: stationType,
    animationIntent,
    statusDisplay: 'always',
    allowFallback: true,
    ...extra,
  };
}

/**
 * Default semantic mappings (arch/02 room semantics x spec section 8
 * activities). Provider-scoped rules are forbidden in the default set;
 * activity -> room/station resolution is the only channel.
 */
export const DEFAULT_MAPPING_RULES: readonly MappingRule[] = [
  rule('rule_planning', 'planning', 'command', 'planning_holo', 'planning'),
  rule('rule_waiting_user', 'waiting-user', 'command', 'core_console', 'idle', {
    statusDisplay: 'always',
  }),
  rule('rule_error', 'error', 'command', 'core_console', 'error', {
    statusDisplay: 'always',
  }),
  rule('rule_coding', 'coding', 'engineering', 'coding_workstation', 'coding'),
  rule('rule_building', 'building', 'engineering', 'coding_workstation', 'coding'),
  rule('rule_reviewing', 'reviewing', 'engineering', 'coding_workstation', 'coding'),
  rule('rule_testing', 'testing', 'laboratory', 'test_bench', 'testing'),
  rule('rule_reading', 'reading', 'library', 'reading_desk', 'researching'),
  rule('rule_researching', 'researching', 'observatory', 'research_scope', 'researching'),
  rule('rule_communicating', 'communicating', 'communications', 'comm_console', 'talking'),
  rule('rule_delegating', 'delegating', 'communications', 'comm_console', 'talking'),
  rule('rule_spawning_subagent', 'spawning-subagent', 'communications', 'comm_console', 'talking'),
  rule('rule_version_control', 'version-control', 'archive', 'archive_terminal', 'coding'),
  rule('rule_idle', 'idle', 'lounge', 'lounge_seat', 'idle', { statusDisplay: 'overview' }),
  rule('rule_completed', 'completed', 'lounge', 'lounge_seat', 'celebrating', {
    statusDisplay: 'overview',
  }),
];

export interface MappingEngine {
  readonly rules: readonly MappingRule[];
  resolve(
    event: NormalizedEvent,
    layout: MappingShipLayout,
    characterCell: { col: number; row: number },
  ): MappingResolution;
}

/**
 * Provider-neutral mapping engine: normalized event -> semantic activity ->
 * deterministic rule selection -> room/station resolution with the
 * documented fallback hierarchy (arch/02):
 *
 *   1. preferred station in preferred room
 *   2. any compatible station in the preferred room
 *   3. nearest compatible semantic room with a matching station
 *   4. nearest generic workstation (universal fallback)
 *   5. safe idle marker + diagnostic (character is never stranded)
 *
 * All comparisons are deterministic: distance, then instance-id ascending.
 */
export function createMappingEngine(rules: readonly MappingRule[]): MappingEngine {
  return {
    rules,
    resolve(event, layout, characterCell): MappingResolution {
      const selection = selectMappingRule(rules, event);
      const winner = selection.rule;
      const activity = winner?.overrideActivity ?? (event.activity as SemanticActivity);
      const preferredRoomType = winner?.preferredRoomType ?? 'generic_workstation';
      const preferredStationType = winner?.preferredStationType ?? 'generic_workstation';
      const fallbackSteps: string[] = [];

      if (winner?.overrideActivity !== undefined) {
        fallbackSteps.push('activity-overridden');
      }

      const base = {
        ruleId: winner?.id ?? null,
        activity,
        animationIntent: winner?.animationIntent ?? 'idle',
        effectIntent: winner?.effectIntent ?? null,
        statusDisplay: winner?.statusDisplay ?? ('overview' as const),
      };

      // Step 1/2: preferred room, preferred then any compatible station.
      const preferredRooms = layout.rooms
        .filter((r) => r.roomType === preferredRoomType)
        .sort(
          (a, b) =>
            dist(a.center, characterCell) - dist(b.center, characterCell) ||
            (a.roomInstanceId < b.roomInstanceId ? -1 : 1),
        );

      for (const room of preferredRooms) {
        const exact = pickStation(
          layout.stations,
          preferredStationType,
          room.roomInstanceId,
          characterCell,
        );
        if (exact !== null) {
          return {
            ...base,
            roomType: room.roomType,
            roomInstanceId: room.roomInstanceId,
            stationType: preferredStationType,
            stationInstanceId: exact.stationInstanceId,
            fallbackSteps,
            diagnostic: fallbackSteps.length === 0 ? null : fallbackSteps.join(' -> '),
          };
        }
      }
      if (preferredRooms.length > 0) {
        fallbackSteps.push('preferred-station-unavailable');
      } else {
        fallbackSteps.push('preferred-room-missing');
      }

      // Step 3: nearest room (any semantic type) holding an available
      // station of the preferred type.
      for (const room of [...layout.rooms]
        .filter((r) => r.roomType !== preferredRoomType)
        .sort(
          (a, b) =>
            dist(a.center, characterCell) - dist(b.center, characterCell) ||
            (a.roomInstanceId < b.roomInstanceId ? -1 : 1),
        )) {
        const station = pickStation(
          layout.stations,
          preferredStationType,
          room.roomInstanceId,
          characterCell,
        );
        if (station !== null) {
          return {
            ...base,
            roomType: room.roomType,
            roomInstanceId: room.roomInstanceId,
            stationType: preferredStationType,
            stationInstanceId: station.stationInstanceId,
            fallbackSteps: [...fallbackSteps, 'nearest-compatible-room'],
            diagnostic: [...fallbackSteps, 'nearest-compatible-room'].join(' -> '),
          };
        }
      }

      // Step 4: nearest generic workstation anywhere.
      const genericStations = layout.stations
        .filter((s) => s.stationType === 'generic_workstation' && s.available)
        .sort(
          (a, b) =>
            dist(a.cell, characterCell) - dist(b.cell, characterCell) ||
            (a.stationInstanceId < b.stationInstanceId ? -1 : 1),
        );
      const generic = genericStations[0];
      if (generic !== undefined) {
        const genericRoom = layout.rooms.find((r) => r.roomInstanceId === generic.roomInstanceId);
        return {
          ...base,
          roomType: genericRoom?.roomType ?? 'generic_workstation',
          roomInstanceId: generic.roomInstanceId,
          stationType: 'generic_workstation',
          stationInstanceId: generic.stationInstanceId,
          fallbackSteps: [...fallbackSteps, 'generic-workstation'],
          diagnostic: [...fallbackSteps, 'generic-workstation'].join(' -> '),
        };
      }
      fallbackSteps.push('generic-workstation-unavailable');

      // Step 5: safe idle marker — never stranded, always explained.
      fallbackSteps.push('idle-marker');
      return {
        ...base,
        roomType: preferredRoomType,
        roomInstanceId: null,
        stationType: preferredStationType,
        stationInstanceId: null,
        animationIntent: 'idle',
        fallbackSteps,
        diagnostic: `no compatible room/station found for activity "${event.activity}" (rule ${winner?.id ?? 'none'}); character parked at safe idle marker`,
      };
    },
  };
}

function pickStation(
  stations: readonly MappingStationView[],
  stationType: StationType,
  roomInstanceId: string,
  characterCell: { col: number; row: number },
): MappingStationView | null {
  const candidates = stations
    .filter(
      (s) => s.roomInstanceId === roomInstanceId && s.stationType === stationType && s.available,
    )
    .sort(
      (a, b) =>
        dist(a.cell, characterCell) - dist(b.cell, characterCell) ||
        (a.stationInstanceId < b.stationInstanceId ? -1 : 1),
    );
  return candidates[0] ?? null;
}
