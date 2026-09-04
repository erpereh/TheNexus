import { describe, expect, it } from 'vitest';
import { createOpencodeAdapter } from './opencode-adapter';
import { OPENCODE_ADAPTER_DESCRIPTOR } from './descriptor';
import { runAdapterConformanceSuite } from '@thenexus/adapter-sdk';

const validSample = {
  sessionId: 'sess_0001',
  agentId: 'agent_0001',
  timestamp: '2026-09-03T21:00:00.000Z',
  state: 'running',
  workspaceId: 'ws_demo',
};

const malformedSamples: readonly unknown[] = [
  null,
  'text',
  { sessionId: 'sess_0001' },
  { sessionId: 's', agentId: 'a', timestamp: '2026-09-03T21:00:00.000Z', state: 'quantum' },
];

runAdapterConformanceSuite({
  makeAdapter: createOpencodeAdapter,
  validSamples: [validSample],
  malformedSamples,
});

describe('opencode adapter specifics', () => {
  it.each([
    ['running', 'coding'],
    ['waiting', 'waiting-user'],
    ['error', 'error'],
    ['done', 'completed'],
  ] as const)('maps state %s to activity %s', (state, activity) => {
    const adapter = createOpencodeAdapter();
    const result = adapter.parse({
      sessionId: 'sess_0001',
      agentId: 'agent_0001',
      timestamp: '2026-09-03T21:00:00.000Z',
      state,
    });
    expect(result.accepted[0]?.activity).toBe(activity);
  });

  it('rejects unknown states', () => {
    const adapter = createOpencodeAdapter();
    const result = adapter.parse({
      sessionId: 'sess_0001',
      agentId: 'agent_0001',
      timestamp: '2026-09-03T21:00:00.000Z',
      state: 'hibernating',
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain('documented opencode fixture shape');
  });

  it('declares no control capabilities (UI must never fabricate them)', () => {
    expect(OPENCODE_ADAPTER_DESCRIPTOR.capabilities.sendTask).toBe(false);
    expect(OPENCODE_ADAPTER_DESCRIPTOR.capabilities.sendMessage).toBe(false);
    expect(OPENCODE_ADAPTER_DESCRIPTOR.capabilities.cancelTask).toBe(false);
  });
});
