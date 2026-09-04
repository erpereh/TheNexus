import { createFieldMappingAdapter } from '@thenexus/adapter-sdk';
import type { HarnessAdapter } from '@thenexus/adapter-sdk';
import { CODEX_ADAPTER_DESCRIPTOR } from './descriptor';

const TASK_ACTIVITY: Record<string, string> = {
  started: 'coding',
  completed: 'completed',
  failed: 'error',
};

/**
 * Parses the documented synthetic Codex fixture shape:
 * { codexTask: { state: started|completed|failed, taskId, sessionId,
 *   agentId, timestamp, workspaceId? } }
 *
 * Field mapping lives entirely in this adapter so future real-format
 * research only changes this file (arch/03 version rule).
 */
export function createCodexAdapter(): HarnessAdapter {
  return createFieldMappingAdapter({
    descriptor: CODEX_ADAPTER_DESCRIPTOR,
    provider: 'codex',
    rejectionReason: 'payload does not match the documented codex fixture shape',
    mapFields(value) {
      const raw = value as {
        codexTask?: {
          state?: unknown;
          taskId?: unknown;
          sessionId?: unknown;
          agentId?: unknown;
          timestamp?: unknown;
          workspaceId?: unknown;
        };
      };
      const task = raw.codexTask;
      if (
        task === undefined ||
        typeof task.state !== 'string' ||
        typeof task.taskId !== 'string' ||
        typeof task.sessionId !== 'string' ||
        typeof task.agentId !== 'string' ||
        typeof task.timestamp !== 'string'
      ) {
        return null;
      }
      const activity = TASK_ACTIVITY[task.state];
      if (activity === undefined) return null;
      return {
        timestamp: task.timestamp,
        workspaceId: typeof task.workspaceId === 'string' ? task.workspaceId : 'ws_unknown',
        sessionId: task.sessionId,
        agentId: task.agentId,
        activity,
        kind: `task.${task.state}`,
        metadata: { taskId: task.taskId },
      };
    },
  });
}
