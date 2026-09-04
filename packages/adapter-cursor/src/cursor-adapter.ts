import { createFieldMappingAdapter } from '@thenexus/adapter-sdk';
import type { HarnessAdapter } from '@thenexus/adapter-sdk';
import { CURSOR_ADAPTER_DESCRIPTOR } from './descriptor';

/**
 * Parses the documented synthetic Cursor fixture shape:
 * { cursorSession: string, agentId: string, timestamp: string,
 *   activity: string, workspaceId? }
 *
 * Field mapping lives entirely in this adapter so future real-format
 * research only changes this file (arch/03 version rule). Note: the
 * `cursorSession` value is treated as opaque session identity only.
 */
export function createCursorAdapter(): HarnessAdapter {
  return createFieldMappingAdapter({
    descriptor: CURSOR_ADAPTER_DESCRIPTOR,
    provider: 'cursor',
    rejectionReason: 'payload does not match the documented cursor fixture shape',
    mapFields(value) {
      const raw = value as {
        cursorSession?: unknown;
        agentId?: unknown;
        timestamp?: unknown;
        activity?: unknown;
        workspaceId?: unknown;
      };
      if (
        typeof raw.cursorSession !== 'string' ||
        typeof raw.agentId !== 'string' ||
        typeof raw.timestamp !== 'string' ||
        typeof raw.activity !== 'string'
      ) {
        return null;
      }
      return {
        timestamp: raw.timestamp,
        workspaceId: typeof raw.workspaceId === 'string' ? raw.workspaceId : 'ws_unknown',
        sessionId: raw.cursorSession,
        agentId: raw.agentId,
        activity: raw.activity,
        metadata: {},
      };
    },
  });
}
