import {
  NormalizedEventSchema,
  parseNormalizedEvent,
  type NormalizedEvent,
} from '@thenexus/contracts';
import type {
  AdapterHealthState,
  HarnessAdapter,
  IngestResult,
  ParsedEventRejection,
} from '@thenexus/adapter-sdk';
import { GENERIC_ADAPTER_DESCRIPTOR } from './descriptor';

const MAX_SEEN_IDS = 10000;

/** Documented Generic Adapter input shape (JSONL-friendly, one object per line). */
export interface GenericInputEvent {
  timestamp: string;
  workspaceId: string;
  sessionId: string;
  agentId: string;
  parentAgentId?: string | null;
  activity: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The Generic Adapter is a first-class integration for unknown/future
 * harnesses: it accepts a documented, provider-neutral JSONL shape and
 * validates every line through the canonical event schema. Unknown
 * activities are rejected per-line, never crash the stream.
 */
export function createGenericAdapter(): HarnessAdapter {
  const seen = new Set<string>();
  const health: { state: AdapterHealthState; detail?: string } = { state: 'not_configured' };

  const parseLine = (
    value: unknown,
    index: number,
    accepted: NormalizedEvent[],
    rejected: ParsedEventRejection[],
  ): void => {
    let parsed: unknown = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value) as unknown;
      } catch {
        rejected.push({ index, reason: 'not valid JSON' });
        return;
      }
    }
    const input = parsed as Partial<GenericInputEvent> | null;
    if (
      input === null ||
      typeof input !== 'object' ||
      typeof input.timestamp !== 'string' ||
      typeof input.sessionId !== 'string' ||
      typeof input.agentId !== 'string' ||
      typeof input.activity !== 'string'
    ) {
      rejected.push({
        index,
        reason: 'missing required generic fields (timestamp, sessionId, agentId, activity)',
      });
      return;
    }
    const candidate: unknown = {
      schemaVersion: 1,
      eventId: `evt_generic_${stableHash(
        `${input.sessionId}~${input.agentId}~${input.timestamp}~${input.activity}`,
      )}`,
      workspaceId:
        typeof input.workspaceId === 'string' && input.workspaceId.length > 0
          ? input.workspaceId
          : 'ws_unknown',
      sessionId: input.sessionId,
      agentId: input.agentId,
      parentAgentId: typeof input.parentAgentId === 'string' ? input.parentAgentId : null,
      sequence: 0,
      occurredAt: input.timestamp,
      kind: typeof input.kind === 'string' ? input.kind : 'activity.changed',
      activity: input.activity,
      source: { adapterId: 'generic', provider: 'generic' },
      metadata: typeof input.metadata === 'object' && input.metadata !== null ? input.metadata : {},
    };
    const check = NormalizedEventSchema.safeParse(candidate);
    if (!check.success) {
      rejected.push({
        index,
        reason: `schema invalid: ${check.error.issues.map((i) => i.message).join('; ')}`,
      });
      return;
    }
    const event = check.data as NormalizedEvent;
    if (seen.has(event.eventId)) {
      rejected.push({ index, reason: `duplicate event id ${event.eventId}` });
      return;
    }
    seen.add(event.eventId);
    if (seen.size > MAX_SEEN_IDS) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    accepted.push(event);
  };

  return {
    descriptor: GENERIC_ADAPTER_DESCRIPTOR,
    health: (): { state: AdapterHealthState; detail?: string } => {
      return health.detail === undefined
        ? { state: health.state }
        : { state: health.state, detail: health.detail };
    },
    setHealth(state, detail) {
      health.state = state;
      if (detail === undefined) {
        delete health.detail;
      } else {
        health.detail = detail;
      }
    },
    parse(raw: unknown): IngestResult {
      const accepted: NormalizedEvent[] = [];
      const rejected: ParsedEventRejection[] = [];
      if (typeof raw === 'string' && raw.includes('\n')) {
        raw
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .forEach((line, index) => parseLine(line, index, accepted, rejected));
        return { accepted, rejected };
      }
      if (Array.isArray(raw)) {
        raw.forEach((item, index) => parseLine(item, index, accepted, rejected));
        return { accepted, rejected };
      }
      parseLine(raw, 0, accepted, rejected);
      return { accepted, rejected };
    },
  };
}

export { parseNormalizedEvent };
