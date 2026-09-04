import { describe, expect, it } from 'vitest';
import { NormalizedEventSchema, SEMANTIC_ACTIVITIES, parseNormalizedEvent } from './index';

const fixture = {
  schemaVersion: 1,
  eventId: 'evt_0001',
  workspaceId: 'ws_demo',
  sessionId: 'sess_0001',
  agentId: 'agent_root',
  parentAgentId: null,
  sequence: 1,
  occurredAt: '2026-09-03T21:00:00.000Z',
  kind: 'activity.changed',
  activity: 'planning',
  source: { adapterId: 'simulator', provider: 'simulator' },
  metadata: {},
} as const;

describe('NormalizedEventSchema', () => {
  it('parses the canonical valid fixture', () => {
    const parsed = NormalizedEventSchema.parse(fixture);
    expect(parsed.eventId).toBe('evt_0001');
    expect(parsed.kind).toBe('activity.changed');
    expect(parsed.activity).toBe('planning');
  });

  it('rejects an invalid event', () => {
    const invalid = { ...fixture, eventId: '' };
    expect(() => NormalizedEventSchema.parse(invalid)).toThrow();
  });

  it('rejects a non-ISO timestamp', () => {
    const invalid = { ...fixture, occurredAt: 'yesterday' };
    expect(() => NormalizedEventSchema.parse(invalid)).toThrow();
  });

  it('rejects an unknown semantic activity', () => {
    const invalid = { ...fixture, activity: 'divine-intervention' };
    expect(() => NormalizedEventSchema.parse(invalid)).toThrow();
  });

  it('rejects a negative sequence', () => {
    const invalid = { ...fixture, sequence: -1 };
    expect(() => NormalizedEventSchema.parse(invalid)).toThrow();
  });

  it('serializes timestamps as ISO strings rather than Date objects', () => {
    const parsed = parseNormalizedEvent(fixture);
    expect(parsed.occurredAt).toBeTypeOf('string');
    expect(parsed.occurredAt).toBe('2026-09-03T21:00:00.000Z');
    const json = JSON.parse(JSON.stringify(parsed)) as { occurredAt: unknown };
    expect(json.occurredAt).toBe('2026-09-03T21:00:00.000Z');
  });

  it('retains unknown provider metadata under a safe metadata record', () => {
    const withMetadata = {
      ...fixture,
      metadata: {
        providerSpecific: { cursorSession: 'abc', nested: { depth: 2 } },
      },
    };
    const parsed = parseNormalizedEvent(withMetadata);
    expect(parsed.metadata).toEqual({
      providerSpecific: { cursorSession: 'abc', nested: { depth: 2 } },
    });
  });

  it('rejects non-JSON-safe metadata values', () => {
    const bad = { ...fixture, metadata: { fn: () => {} } };
    expect(() => parseNormalizedEvent(bad)).toThrow();
  });

  it('accepts a nullable parentAgentId and rejects unknown schema versions', () => {
    expect(() =>
      NormalizedEventSchema.parse({ ...fixture, parentAgentId: 'agent_parent' }),
    ).not.toThrow();
    expect(() => NormalizedEventSchema.parse({ ...fixture, schemaVersion: 2 })).toThrow();
  });

  it('tolerates unknown future top-level fields by stripping them (forward-compat stance)', () => {
    // Ruling: schema v1 ignores unknown top-level keys so older consumers
    // can read events produced by newer adapters that add optional fields.
    const withFutureField = {
      ...fixture,
      futureField: { whatever: true },
    };
    const parsed = parseNormalizedEvent(withFutureField);
    expect(parsed).not.toHaveProperty('futureField');
    expect(parsed.eventId).toBe('evt_0001');
  });
});

describe('parseNormalizedEvent', () => {
  it('returns a typed normalized event for valid input', () => {
    const event = parseNormalizedEvent(fixture);
    expect(event.workspaceId).toBe('ws_demo');
    expect(event.source.adapterId).toBe('simulator');
  });

  it('throws a descriptive error for invalid input', () => {
    expect(() => parseNormalizedEvent({ nope: true })).toThrow(/normalized event/i);
  });
});

describe('SEMANTIC_ACTIVITIES', () => {
  it('exposes the provider-neutral taxonomy', () => {
    for (const activity of [
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
    ] as const) {
      expect(SEMANTIC_ACTIVITIES).toContain(activity);
    }
  });

  it('contains no provider-specific values', () => {
    const joined = SEMANTIC_ACTIVITIES.join(' ');
    for (const provider of ['zcode', 'cursor', 'codex', 'opencode']) {
      expect(joined).not.toContain(provider);
    }
  });
});
