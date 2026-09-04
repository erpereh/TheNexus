import { describe, expect, it } from 'vitest';
import { parseNormalizedEvent } from '@thenexus/contracts';
import {
  createScenarioPreset,
  generateMalformedFixture,
  generateScenario,
  type SimulatorScenarioOptions,
} from './scenario';

const baseOptions: SimulatorScenarioOptions = {
  seed: 42,
  workspaceId: 'ws_demo',
  agentCount: 3,
  eventsPerAgent: 12,
  startTime: '2026-09-03T21:00:00.000Z',
};

describe('generateScenario determinism', () => {
  it('produces byte-for-byte identical arrays for the same seed and options', () => {
    const a = generateScenario(baseOptions);
    const b = generateScenario(baseOptions);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different activity streams for different seeds while staying valid', () => {
    const a = generateScenario(baseOptions);
    const b = generateScenario({ ...baseOptions, seed: 1337 });
    const aActs = a.map((e) => `${e.agentId}:${e.activity}`).join('|');
    const bActs = b.map((e) => `${e.agentId}:${e.activity}`).join('|');
    expect(aActs).not.toBe(bActs);
  });

  it('parses every generated event through the canonical schema', () => {
    const events = generateScenario({ ...baseOptions, agentCount: 8 });
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(() => parseNormalizedEvent(event)).not.toThrow();
      expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('keeps per-session sequence monotonically increasing', () => {
    const events = generateScenario({ ...baseOptions, agentCount: 8 });
    const lastSequence = new Map<string, number>();
    for (const event of events) {
      const previous = lastSequence.get(event.sessionId);
      if (previous !== undefined) {
        expect(event.sequence, `session ${event.sessionId}`).toBeGreaterThan(previous);
      }
      lastSequence.set(event.sessionId, event.sequence);
    }
  });

  it('uses unique event IDs across the whole stream', () => {
    const events = generateScenario({ ...baseOptions, agentCount: 8 });
    const ids = new Set(events.map((e) => e.eventId));
    expect(ids.size).toBe(events.length);
  });
});

describe('generateScenario semantics', () => {
  it('includes planning, coding, testing and completed in a standard scenario', () => {
    const events = generateScenario(baseOptions);
    const activities = new Set(events.map((e) => e.activity));
    for (const required of ['planning', 'coding', 'testing', 'completed']) {
      expect(activities.has(required as 'planning'), required).toBe(true);
    }
  });

  it('covers the full baseline activity vocabulary including git, review, waiting, error and reading', () => {
    const events = generateScenario({ ...baseOptions, agentCount: 12, seed: 7 });
    const activities = new Set(events.map((e) => e.activity));
    for (const required of [
      'planning',
      'reading',
      'coding',
      'researching',
      'testing',
      'building',
      'reviewing',
      'version-control',
      'communicating',
      'waiting-user',
      'completed',
    ] as const) {
      expect(activities.has(required), required).toBe(true);
    }
  });

  it('can generate a deterministic error path ending in error', () => {
    const events = generateScenario({ ...baseOptions, agentCount: 6, seed: 5 });
    const errorEvents = events.filter((e) => e.activity === 'error');
    // With enough agents and seed 5, at least one agent hits the error path.
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  it('creates parent/subagent relationships when agentCount > 1', () => {
    const events = generateScenario(baseOptions);
    const roots = new Set(events.filter((e) => e.parentAgentId === null).map((e) => e.agentId));
    const children = events.filter((e) => e.parentAgentId !== null);
    expect(roots.size).toBeGreaterThan(0);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(roots.has(child.parentAgentId as string)).toBe(true);
      expect(child.sessionId).toBe(
        events.find((e) => e.agentId === child.parentAgentId)?.sessionId,
      );
    }
  });

  it('emits a spawning-subagent activity on parents that own subagents', () => {
    const events = generateScenario(baseOptions);
    const parents = new Set(
      events.filter((e) => e.parentAgentId !== null).map((e) => e.parentAgentId),
    );
    const spawnActivities = events.filter(
      (e) => e.activity === 'spawning-subagent' && parents.has(e.agentId),
    );
    expect(spawnActivities.length).toBeGreaterThan(0);
  });
});

describe('generateScenario scale', () => {
  it.each([10, 50, 100, 250])('generates %i agents without duplicate event IDs', (count) => {
    const events = generateScenario({
      ...baseOptions,
      agentCount: count,
      eventsPerAgent: 6,
    });
    const ids = new Set(events.map((e) => e.eventId));
    expect(ids.size).toBe(events.length);
    const agents = new Set(events.map((e) => e.agentId));
    expect(agents.size).toBe(count);
  });

  it('ends every agent stream in completed or error', () => {
    const events = generateScenario({ ...baseOptions, agentCount: 15, seed: 3 });
    const lastPerAgent = new Map<string, string>();
    for (const event of events) {
      lastPerAgent.set(event.agentId, event.activity);
    }
    for (const [, activity] of lastPerAgent) {
      expect(['completed', 'error']).toContain(activity);
    }
  });
});

describe('generateMalformedFixture', () => {
  it('produces raw payloads that the canonical schema rejects', () => {
    const malformed = generateMalformedFixture(50, 9);
    expect(malformed.length).toBe(50);
    let rejected = 0;
    for (const payload of malformed) {
      expect(() => parseNormalizedEvent(payload)).toThrow();
      rejected++;
    }
    expect(rejected).toBe(50);
  });

  it('is deterministic for a given seed', () => {
    const a = generateMalformedFixture(20, 11);
    const b = generateMalformedFixture(20, 11);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('scenario presets', () => {
  it.each([
    'single-agent',
    'nested-subagents',
    'error-path',
    'malformed',
    'agents-10',
    'agents-50',
    'agents-100',
    'agents-250',
  ] as const)('builds deterministic options for %s', (name) => {
    const a = createScenarioPreset(name);
    const b = createScenarioPreset(name);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.workspaceId.length).toBeGreaterThan(0);
    expect(a.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(() => generateScenario(a)).not.toThrow();
  });

  it('single-agent yields exactly one agent', () => {
    const events = generateScenario(createScenarioPreset('single-agent'));
    expect(new Set(events.map((e) => e.agentId)).size).toBe(1);
  });

  it('nested-subagents yields parent and subagent relationships', () => {
    const events = generateScenario(createScenarioPreset('nested-subagents'));
    const children = events.filter((e) => e.parentAgentId !== null);
    expect(children.length).toBeGreaterThan(0);
  });

  it('scale presets produce exact agent populations', () => {
    const cases = {
      'agents-10': 10,
      'agents-50': 50,
      'agents-100': 100,
      'agents-250': 250,
    } as const;
    for (const [name, count] of Object.entries(cases)) {
      const events = generateScenario(createScenarioPreset(name as keyof typeof cases));
      expect(new Set(events.map((e) => e.agentId)).size).toBe(count);
    }
  });

  it('error-path preset ends at least one agent in error', () => {
    const events = generateScenario(createScenarioPreset('error-path'));
    const lastPerAgent = new Map<string, string>();
    for (const event of events) {
      lastPerAgent.set(event.agentId, event.activity);
    }
    expect([...lastPerAgent.values()]).toContain('error');
  });

  it('overrides merge over preset defaults deterministically', () => {
    const preset = createScenarioPreset('agents-10', {
      workspaceId: 'ws_custom',
      seed: 7,
    });
    expect(preset.workspaceId).toBe('ws_custom');
    expect(preset.seed).toBe(7);
    expect(preset.agentCount).toBe(10);
  });
});
