import { createFieldMappingAdapter } from '@thenexus/adapter-sdk';
import type { HarnessAdapter } from '@thenexus/adapter-sdk';
import { OPENCODE_ADAPTER_DESCRIPTOR } from './descriptor';

const STATE_ACTIVITY: Record<string, string> = {
  running: 'coding',
  waiting: 'waiting-user',
  error: 'error',
  done: 'completed',
};

/**
 * Parses the documented synthetic OpenCode fixture shape:
 * { sessionId, agentId, timestamp, state: running|waiting|error|done,
 *   workspaceId? }
 *
 * Field mapping lives entirely in this adapter so future real-format
 * research only changes this file (arch/03 version rule).
 */
export function createOpencodeAdapter(): HarnessAdapter {
  return createFieldMappingAdapter({
    descriptor: OPENCODE_ADAPTER_DESCRIPTOR,
    provider: 'opencode',
    rejectionReason: 'payload does not match the documented opencode fixture shape',
    mapFields(value) {
      const raw = value as {
        sessionId?: unknown;
        agentId?: unknown;
        timestamp?: unknown;
        state?: unknown;
        workspaceId?: unknown;
      };
      if (
        typeof raw.sessionId !== 'string' ||
        typeof raw.agentId !== 'string' ||
        typeof raw.timestamp !== 'string' ||
        typeof raw.state !== 'string'
      ) {
        return null;
      }
      const activity = STATE_ACTIVITY[raw.state];
      if (activity === undefined) return null;
      return {
        timestamp: raw.timestamp,
        workspaceId: typeof raw.workspaceId === 'string' ? raw.workspaceId : 'ws_unknown',
        sessionId: raw.sessionId,
        agentId: raw.agentId,
        activity,
        metadata: {},
      };
    },
  });
}
