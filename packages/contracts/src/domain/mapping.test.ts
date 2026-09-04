import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '../events';
import { parseMappingRule, selectMappingRule } from './mapping';

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    schemaVersion: 1,
    eventId: 'evt_0001',
    workspaceId: 'ws_demo',
    sessionId: 'sess_0001',
    agentId: 'agent_0001',
    parentAgentId: null,
    sequence: 1,
    occurredAt: '2026-09-03T21:00:00.000Z',
    kind: 'activity.changed',
    activity: 'testing',
    source: { adapterId: 'simulator', provider: 'simulator' },
    metadata: {},
    ...overrides,
  };
}

const rule = (overrides: Record<string, unknown>) =>
  parseMappingRule({
    id: 'rule_default',
    enabled: true,
    priority: 0,
    match: { activity: 'any' },
    preferredRoomType: 'laboratory',
    preferredStationType: 'test_bench',
    animationIntent: 'testing',
    statusDisplay: 'always',
    allowFallback: true,
    ...overrides,
  });

describe('MappingRuleSchema', () => {
  it('accepts a valid rule and defaults optional fields', () => {
    const parsed = rule({});
    expect(parsed.preferredRoomType).toBe('laboratory');
    expect(parsed.effectIntent).toBeUndefined();
  });

  it('rejects unknown room/station types and invalid status display', () => {
    expect(() => rule({ preferredRoomType: 'reactor' })).toThrow();
    expect(() => rule({ preferredStationType: 'hyperdrive' })).toThrow();
    expect(() => rule({ statusDisplay: 'sometimes' })).toThrow();
  });
});

describe('selectMappingRule', () => {
  it('picks the highest-priority enabled matching rule', () => {
    const low = rule({ id: 'rule_a', priority: 1 });
    const high = rule({ id: 'rule_b', priority: 10 });
    const result = selectMappingRule([low, high], event());
    expect(result.rule?.id).toBe('rule_b');
    expect(result.considered.map((r) => r.rule.id)).toEqual(['rule_b', 'rule_a']);
  });

  it('breaks priority ties by lexicographic rule id (documented tie-break)', () => {
    const b = rule({ id: 'rule_b', priority: 5 });
    const a = rule({ id: 'rule_a', priority: 5 });
    const result = selectMappingRule([b, a], event());
    expect(result.rule?.id).toBe('rule_a');
  });

  it('never selects disabled rules', () => {
    const disabled = rule({ id: 'rule_disabled', priority: 100, enabled: false });
    const fallback = rule({ id: 'rule_enabled', priority: 0 });
    const result = selectMappingRule([disabled, fallback], event());
    expect(result.rule?.id).toBe('rule_enabled');
  });

  it('filters by activity, provider and kind predicates', () => {
    const testingOnly = rule({ id: 'rule_testing', match: { activity: 'testing' } });
    const codingOnly = rule({ id: 'rule_coding', match: { activity: 'coding' } });
    expect(selectMappingRule([testingOnly, codingOnly], event()).rule?.id).toBe('rule_testing');

    const providerScoped = rule({
      id: 'rule_provider',
      match: { activity: 'any', provider: 'simulator' },
    });
    const otherProvider = rule({
      id: 'rule_other',
      match: { activity: 'any', provider: 'codex' },
    });
    expect(selectMappingRule([providerScoped, otherProvider], event()).rule?.id).toBe(
      'rule_provider',
    );

    const kindScoped = rule({
      id: 'rule_kind',
      match: { activity: 'any', kind: 'activity.changed' },
    });
    expect(selectMappingRule([kindScoped], event({ kind: 'task.completed' })).rule).toBeNull();
  });

  it('returns null for an empty or non-matching rule set', () => {
    expect(selectMappingRule([], event()).rule).toBeNull();
    const codingOnly = rule({ id: 'rule_coding', match: { activity: 'coding' } });
    expect(selectMappingRule([codingOnly], event()).rule).toBeNull();
  });

  it('is deterministic: repeated selection yields byte-for-byte identical traces', () => {
    const rules = [
      rule({ id: 'rule_b', priority: 3 }),
      rule({ id: 'rule_a', priority: 3 }),
      rule({ id: 'rule_c', priority: 9, match: { activity: 'coding' } }),
      rule({ id: 'rule_d', priority: 1 }),
    ];
    const e = event();
    const first = JSON.stringify(selectMappingRule(rules, e));
    const second = JSON.stringify(selectMappingRule([...rules].reverse(), e));
    expect(first).toBe(second);
  });
});
