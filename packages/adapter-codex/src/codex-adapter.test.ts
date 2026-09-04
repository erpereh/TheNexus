import { describe, expect, it } from 'vitest';
import { createCodexAdapter } from './codex-adapter';
import { CODEX_ADAPTER_DESCRIPTOR } from './descriptor';
import { runAdapterConformanceSuite } from '@thenexus/adapter-sdk';

const validSample = {
  codexTask: {
    state: 'started',
    taskId: 'task_0001',
    sessionId: 'sess_0001',
    agentId: 'agent_0001',
    timestamp: '2026-09-03T21:00:00.000Z',
    workspaceId: 'ws_demo',
  },
};

const malformedSamples: readonly unknown[] = [
  null,
  [],
  { codexTask: { state: 'started' } },
  {
    codexTask: {
      state: 'exploded',
      taskId: 'task_0001',
      sessionId: 'sess_0001',
      agentId: 'agent_0001',
      timestamp: '2026-09-03T21:00:00.000Z',
    },
  },
];

runAdapterConformanceSuite({
  makeAdapter: createCodexAdapter,
  validSamples: [validSample],
  malformedSamples,
});

describe('codex adapter specifics', () => {
  it('carries the task id in safe metadata and maps task kinds', () => {
    const adapter = createCodexAdapter();
    const result = adapter.parse({
      codexTask: {
        state: 'completed',
        taskId: 'task_0009',
        sessionId: 'sess_0001',
        agentId: 'agent_0001',
        timestamp: '2026-09-03T22:00:00.000Z',
      },
    });
    expect(result.accepted[0]?.kind).toBe('task.completed');
    expect(result.accepted[0]?.activity).toBe('completed');
    expect(result.accepted[0]?.metadata).toEqual({ taskId: 'task_0009' });
  });

  it('keeps observeTasks true while control stays false', () => {
    expect(CODEX_ADAPTER_DESCRIPTOR.capabilities.observeTasks).toBe(true);
    expect(CODEX_ADAPTER_DESCRIPTOR.capabilities.sendTask).toBe(false);
  });
});
