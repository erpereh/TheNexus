import { describe, expect, it } from 'vitest';
import { createCursorAdapter } from './cursor-adapter';
import { CURSOR_ADAPTER_DESCRIPTOR } from './descriptor';
import { runAdapterConformanceSuite } from '@thenexus/adapter-sdk';

const validSample = {
  cursorSession: 'sess_0001',
  agentId: 'agent_0001',
  timestamp: '2026-09-03T21:00:00.000Z',
  activity: 'coding',
  workspaceId: 'ws_demo',
};

const malformedSamples: readonly unknown[] = [
  null,
  7,
  { cursorSession: 'sess_0001' },
  { cursorSession: 's', agentId: 'a', timestamp: 'not-a-date', activity: 'coding' },
];

runAdapterConformanceSuite({
  makeAdapter: createCursorAdapter,
  validSamples: [validSample],
  malformedSamples,
});

describe('cursor adapter specifics', () => {
  it('treats cursorSession as opaque session identity', () => {
    const adapter = createCursorAdapter();
    const result = adapter.parse(validSample);
    expect(result.accepted[0]?.sessionId).toBe('sess_0001');
    expect(result.accepted[0]?.source.provider).toBe('cursor');
  });

  it('declares observation-only capabilities (no control)', () => {
    expect(CURSOR_ADAPTER_DESCRIPTOR.capabilities.observeSessions).toBe(true);
    expect(CURSOR_ADAPTER_DESCRIPTOR.capabilities.sendTask).toBe(false);
    expect(CURSOR_ADAPTER_DESCRIPTOR.capabilities.sendMessage).toBe(false);
    expect(CURSOR_ADAPTER_DESCRIPTOR.capabilities.cancelTask).toBe(false);
  });

  it('rejects non-ISO timestamps at the schema boundary', () => {
    const adapter = createCursorAdapter();
    const result = adapter.parse({
      cursorSession: 'sess_0001',
      agentId: 'agent_0001',
      timestamp: 'yesterday',
      activity: 'coding',
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain('schema invalid');
  });
});
