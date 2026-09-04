import { describe, expect, it } from 'vitest';
import { ZCODE_ADAPTER_DESCRIPTOR } from './descriptor';
import { createZcodeAdapter } from './zcode-adapter';
import { runAdapterConformanceSuite } from '@thenexus/adapter-sdk';

const validSample = {
  zcodeSession: { id: 'sess_0001', workspace: 'ws_demo' },
  zcodeAgent: { id: 'agent_0001', parentId: null },
  entry: { ts: '2026-09-03T21:00:00.000Z', activity: 'coding' },
};

const malformedSamples: readonly unknown[] = [
  null,
  42,
  { zcodeSession: { id: 'sess_0001' } },
  {
    zcodeSession: { id: 'sess_0001', workspace: 'ws_demo' },
    zcodeAgent: { id: 'agent_0001' },
    entry: { ts: '2026-09-03T21:00:00.000Z', activity: 'unknown-gibberish' },
  },
];

runAdapterConformanceSuite({
  makeAdapter: createZcodeAdapter,
  validSamples: [validSample],
  malformedSamples,
});

describe('zcode adapter specifics', () => {
  it('maps subagent parent links and tool-call capability truthfully', () => {
    const adapter = createZcodeAdapter();
    const result = adapter.parse({
      zcodeSession: { id: 'sess_0001', workspace: 'ws_demo' },
      zcodeAgent: { id: 'agent_0002', parentId: 'agent_0001' },
      entry: { ts: '2026-09-03T21:00:01.000Z', activity: 'testing', kind: 'tool.invoked' },
    });
    expect(result.accepted[0]?.parentAgentId).toBe('agent_0001');
    expect(result.accepted[0]?.kind).toBe('tool.invoked');
    expect(ZCODE_ADAPTER_DESCRIPTOR.capabilities.observeToolCalls).toBe(true);
    expect(ZCODE_ADAPTER_DESCRIPTOR.capabilities.sendTask).toBe(false);
  });

  it('rejects activities outside the canonical taxonomy', () => {
    const adapter = createZcodeAdapter();
    const result = adapter.parse({
      zcodeSession: { id: 'sess_0001', workspace: 'ws_demo' },
      zcodeAgent: { id: 'agent_0001' },
      entry: { ts: '2026-09-03T21:00:00.000Z', activity: 'teleporting' },
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain('schema invalid');
  });
});
