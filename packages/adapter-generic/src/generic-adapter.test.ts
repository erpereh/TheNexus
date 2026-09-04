import { describe, expect, it } from 'vitest';
import { GENERIC_ADAPTER_DESCRIPTOR } from './descriptor';
import { createGenericAdapter } from './generic-adapter';
import { runAdapterConformanceSuite } from '@thenexus/adapter-sdk';

const validSample = {
  timestamp: '2026-09-03T21:00:00.000Z',
  workspaceId: 'ws_demo',
  sessionId: 'sess_0001',
  agentId: 'agent_0001',
  parentAgentId: null,
  activity: 'coding',
};

const malformedSamples: readonly unknown[] = [
  'not json at all',
  { timestamp: 'nope' },
  null,
  42,
  {
    timestamp: '2026-09-03T21:00:00.000Z',
    sessionId: 'sess_0001',
    agentId: 'agent_0001',
    activity: 'totally-unknown-activity',
  },
];

runAdapterConformanceSuite({
  makeAdapter: createGenericAdapter,
  validSamples: [validSample, JSON.stringify(validSample)],
  malformedSamples,
});

describe('generic adapter specifics', () => {
  it('parses multi-line JSONL streams line by line', () => {
    const adapter = createGenericAdapter();
    const jsonl = [
      JSON.stringify({
        ...validSample,
        agentId: 'agent_0001',
        timestamp: '2026-09-03T21:00:01.000Z',
      }),
      JSON.stringify({
        ...validSample,
        agentId: 'agent_0002',
        timestamp: '2026-09-03T21:00:02.000Z',
      }),
      'garbage line',
    ].join('\n');
    const result = adapter.parse(jsonl);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.index).toBe(2);
  });

  it('rejects unknown activities with a schema reason', () => {
    const adapter = createGenericAdapter();
    const result = adapter.parse({
      timestamp: '2026-09-03T21:00:00.000Z',
      sessionId: 'sess_0001',
      agentId: 'agent_0001',
      activity: 'divine-intervention',
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain('schema invalid');
  });

  it('defaults the workspace id for unknown workspaces', () => {
    const adapter = createGenericAdapter();
    const result = adapter.parse({
      timestamp: '2026-09-03T21:00:00.000Z',
      sessionId: 'sess_0001',
      agentId: 'agent_0001',
      activity: 'coding',
    });
    expect(result.accepted[0]?.workspaceId).toBe('ws_unknown');
  });

  it('is registered as the non-experimental first-class generic adapter', () => {
    expect(GENERIC_ADAPTER_DESCRIPTOR.id).toBe('generic');
    expect(GENERIC_ADAPTER_DESCRIPTOR.experimental).toBe(false);
  });
});
