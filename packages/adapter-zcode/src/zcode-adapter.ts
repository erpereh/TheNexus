import { createFieldMappingAdapter } from '@thenexus/adapter-sdk';
import type { HarnessAdapter } from '@thenexus/adapter-sdk';
import { ZCODE_ADAPTER_DESCRIPTOR } from './descriptor';

/**
 * Parses the documented synthetic ZCode fixture shape:
 * { zcodeSession: { id, workspace }, zcodeAgent: { id, parentId? },
 *   entry: { ts, activity, kind? } }
 *
 * Field mapping lives entirely in this adapter so future real-format
 * research only changes this file (arch/03 version rule).
 */
export function createZcodeAdapter(): HarnessAdapter {
  return createFieldMappingAdapter({
    descriptor: ZCODE_ADAPTER_DESCRIPTOR,
    provider: 'zcode',
    rejectionReason: 'payload does not match the documented zcode fixture shape',
    mapFields(value) {
      const raw = value as {
        zcodeSession?: { id?: unknown; workspace?: unknown };
        zcodeAgent?: { id?: unknown; parentId?: unknown };
        entry?: { ts?: unknown; activity?: unknown; kind?: unknown };
      };
      if (
        typeof raw.zcodeSession?.id !== 'string' ||
        typeof raw.zcodeAgent?.id !== 'string' ||
        typeof raw.entry?.ts !== 'string' ||
        typeof raw.entry?.activity !== 'string'
      ) {
        return null;
      }
      return {
        timestamp: raw.entry.ts,
        workspaceId:
          typeof raw.zcodeSession.workspace === 'string'
            ? raw.zcodeSession.workspace
            : 'ws_unknown',
        sessionId: raw.zcodeSession.id,
        agentId: raw.zcodeAgent.id,
        parentAgentId: typeof raw.zcodeAgent.parentId === 'string' ? raw.zcodeAgent.parentId : null,
        activity: raw.entry.activity,
        kind: typeof raw.entry.kind === 'string' ? raw.entry.kind : 'activity.changed',
        metadata: {},
      };
    },
  });
}
