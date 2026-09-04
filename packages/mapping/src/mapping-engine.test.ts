import { describe, expect, it } from 'vitest';
import { parseNormalizedEvent } from '@thenexus/contracts';
import type { NormalizedEvent } from '@thenexus/contracts';
import {
  DEFAULT_MAPPING_RULES,
  createMappingEngine,
  type MappingShipLayout,
} from './mapping-engine';

function event(activity: string, provider = 'simulator'): NormalizedEvent {
  return parseNormalizedEvent({
    schemaVersion: 1,
    eventId: `evt_${activity}`,
    workspaceId: 'ws_demo',
    sessionId: 'sess_0001',
    agentId: 'agent_0001',
    parentAgentId: null,
    sequence: 1,
    occurredAt: '2026-09-03T21:00:00.000Z',
    kind: 'activity.changed',
    activity,
    source: { adapterId: 'simulator', provider },
    metadata: {},
  });
}

const layout: MappingShipLayout = {
  rooms: [
    {
      roomInstanceId: 'room_bridge',
      roomType: 'command',
      center: { col: 2, row: 2 },
    },
    {
      roomInstanceId: 'room_lab',
      roomType: 'laboratory',
      center: { col: 6, row: 2 },
    },
    {
      roomInstanceId: 'room_generic',
      roomType: 'generic_workstation',
      center: { col: 4, row: 5 },
    },
  ],
  stations: [
    {
      stationInstanceId: 'station_bench_1',
      stationType: 'test_bench',
      roomInstanceId: 'room_lab',
      cell: { col: 6, row: 2 },
      available: true,
    },
    {
      stationInstanceId: 'station_generic_1',
      stationType: 'generic_workstation',
      roomInstanceId: 'room_generic',
      cell: { col: 4, row: 5 },
      available: true,
    },
  ],
};

describe('DEFAULT_MAPPING_RULES', () => {
  it('covers every semantic activity with a default rule', () => {
    const covered = new Set(DEFAULT_MAPPING_RULES.map((r) => r.match.activity));
    for (const activity of SEMANTIC_ACTIVITIES_LIST) {
      expect(covered.has(activity), activity).toBe(true);
    }
  });

  it('has unique ids and no provider-scoped defaults', () => {
    const ids = DEFAULT_MAPPING_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of DEFAULT_MAPPING_RULES) {
      expect(rule.match.provider, rule.id).toBeUndefined();
    }
  });
});

const SEMANTIC_ACTIVITIES_LIST = [
  'idle',
  'planning',
  'reading',
  'coding',
  'researching',
  'testing',
  'building',
  'reviewing',
  'version-control',
  'communicating',
  'delegating',
  'waiting-user',
  'error',
  'completed',
  'spawning-subagent',
] as const;

describe('createMappingEngine', () => {
  it('resolves the preferred room and station when available', () => {
    const engine = createMappingEngine(DEFAULT_MAPPING_RULES);
    const resolution = engine.resolve(event('testing'), layout, { col: 5, row: 2 });
    expect(resolution.ruleId).toBe('rule_testing');
    expect(resolution.roomType).toBe('laboratory');
    expect(resolution.roomInstanceId).toBe('room_lab');
    expect(resolution.stationType).toBe('test_bench');
    expect(resolution.stationInstanceId).toBe('station_bench_1');
    expect(resolution.fallbackSteps).toEqual([]);
  });

  it('falls back to another station in the preferred room (step 2)', () => {
    const engine = createMappingEngine(DEFAULT_MAPPING_RULES);
    const busyLayout: MappingShipLayout = {
      ...layout,
      stations: layout.stations.map((s) =>
        s.stationInstanceId === 'station_bench_1' ? { ...s, available: false } : s,
      ),
    };
    const resolution = engine.resolve(event('testing'), busyLayout, { col: 5, row: 2 });
    // No other test_bench exists anywhere; the universal generic workstation
    // (step 4) catches the assignment so the character is never stranded.
    expect(resolution.stationType).toBe('generic_workstation');
    expect(resolution.stationInstanceId).toBe('station_generic_1');
    expect(resolution.fallbackSteps).toContain('preferred-station-unavailable');
  });

  it('falls back to the nearest generic workstation when the preferred room is missing (step 4)', () => {
    const engine = createMappingEngine(DEFAULT_MAPPING_RULES);
    const noLab: MappingShipLayout = {
      rooms: layout.rooms.filter((r) => r.roomType !== 'laboratory'),
      stations: layout.stations.filter((s) => s.stationInstanceId !== 'station_bench_1'),
    };
    const resolution = engine.resolve(event('testing'), noLab, { col: 5, row: 2 });
    expect(resolution.roomType).toBe('generic_workstation');
    expect(resolution.roomInstanceId).toBe('room_generic');
    expect(resolution.fallbackSteps).toContain('preferred-room-missing');
  });

  it('resolves a safe idle marker when nothing compatible exists (step 5)', () => {
    const engine = createMappingEngine(DEFAULT_MAPPING_RULES);
    const empty: MappingShipLayout = { rooms: [], stations: [] };
    const resolution = engine.resolve(event('testing'), empty, { col: 0, row: 0 });
    expect(resolution.roomInstanceId).toBeNull();
    expect(resolution.stationInstanceId).toBeNull();
    expect(resolution.animationIntent).toBe('idle');
    expect(resolution.fallbackSteps).toContain('idle-marker');
    expect(resolution.diagnostic).toContain('testing');
  });

  it('picks the nearest compatible room deterministically (step 3)', () => {
    const engine = createMappingEngine(DEFAULT_MAPPING_RULES);
    const twoLabs: MappingShipLayout = {
      rooms: [
        ...layout.rooms,
        { roomInstanceId: 'room_lab_far', roomType: 'laboratory', center: { col: 20, row: 20 } },
      ],
      stations: [
        ...layout.stations,
        {
          stationInstanceId: 'station_bench_far',
          stationType: 'test_bench',
          roomInstanceId: 'room_lab_far',
          cell: { col: 20, row: 20 },
          available: true,
        },
      ],
    };
    const resolution = engine.resolve(event('testing'), twoLabs, { col: 5, row: 2 });
    expect(resolution.roomInstanceId).toBe('room_lab');
    const reversed = engine.resolve(event('testing'), twoLabs, { col: 5, row: 2 });
    expect(JSON.stringify(resolution)).toBe(JSON.stringify(reversed));
  });

  it('applies rule overrideActivity when present', () => {
    const engine = createMappingEngine([
      {
        id: 'rule_override',
        enabled: true,
        priority: 100,
        match: { activity: 'coding' },
        overrideActivity: 'reviewing',
        preferredRoomType: 'laboratory',
        preferredStationType: 'test_bench',
        animationIntent: 'testing',
        statusDisplay: 'always',
        allowFallback: true,
      },
    ]);
    const resolution = engine.resolve(event('coding'), layout, { col: 0, row: 0 });
    expect(resolution.activity).toBe('reviewing');
    expect(resolution.roomType).toBe('laboratory');
  });

  it('skips disabled rules and honors user rules over defaults', () => {
    const custom = {
      id: 'rule_user_testing',
      enabled: true,
      priority: 50,
      match: { activity: 'testing' as const },
      preferredRoomType: 'command' as const,
      preferredStationType: 'core_console' as const,
      animationIntent: 'planning',
      statusDisplay: 'always' as const,
      allowFallback: true,
    };
    const engine = createMappingEngine([...DEFAULT_MAPPING_RULES, custom]);
    const resolution = engine.resolve(event('testing'), layout, { col: 5, row: 2 });
    expect(resolution.ruleId).toBe('rule_user_testing');

    const disabledEngine = createMappingEngine([
      ...DEFAULT_MAPPING_RULES,
      { ...custom, enabled: false },
    ]);
    const defaultResolution = disabledEngine.resolve(event('testing'), layout, {
      col: 5,
      row: 2,
    });
    expect(defaultResolution.ruleId).toBe('rule_testing');
  });
});
