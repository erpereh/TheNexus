import { NormalizedEventSchema, type NormalizedEvent } from '@thenexus/contracts';
import type {
  AdapterHealthState,
  HarnessAdapter,
  IngestResult,
  ParsedEventRejection,
} from './adapter';

export interface MappedFields {
  timestamp: string;
  workspaceId: string;
  sessionId: string;
  agentId: string;
  parentAgentId?: string | null;
  activity: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface FieldMappingAdapterConfig {
  descriptor: HarnessAdapter['descriptor'];
  provider: string;
  /**
   * Maps ONE raw provider payload to canonical fields. Provider format
   * knowledge stays entirely inside the adapter (arch/03 version rule).
   * Return null to reject the payload with a structured reason.
   */
  mapFields: (raw: unknown) => MappedFields | null;
  /** Human-readable reason when mapFields returns null. */
  rejectionReason?: string;
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
 * Shared implementation for adapters whose provider payloads are JSON
 * objects mapping onto canonical fields: dedupe by stable event id,
 * schema-validate everything, never throw on garbage, track health.
 */
export function createFieldMappingAdapter(config: FieldMappingAdapterConfig): HarnessAdapter {
  const seen = new Set<string>();
  const health: { state: AdapterHealthState; detail?: string } = {
    state: 'not_configured',
  };
  const adapterId = config.descriptor.id;
  const rejectionReason =
    config.rejectionReason ?? 'payload does not match the documented provider shape';

  const parseOne = (
    value: unknown,
    index: number,
    accepted: NormalizedEvent[],
    rejected: ParsedEventRejection[],
  ): void => {
    const mapped = typeof value === 'object' && value !== null ? config.mapFields(value) : null;
    if (mapped === null) {
      rejected.push({ index, reason: rejectionReason });
      return;
    }
    const candidate: unknown = {
      schemaVersion: 1,
      eventId: `evt_${adapterId}_${stableHash(
        `${mapped.sessionId}~${mapped.agentId}~${mapped.timestamp}~${mapped.activity}`,
      )}`,
      workspaceId:
        typeof mapped.workspaceId === 'string' && mapped.workspaceId.length > 0
          ? mapped.workspaceId
          : 'ws_unknown',
      sessionId: mapped.sessionId,
      agentId: mapped.agentId,
      parentAgentId: typeof mapped.parentAgentId === 'string' ? mapped.parentAgentId : null,
      sequence: 0,
      occurredAt: mapped.timestamp,
      kind: typeof mapped.kind === 'string' ? mapped.kind : 'activity.changed',
      activity: mapped.activity,
      source: { adapterId, provider: config.provider },
      metadata:
        typeof mapped.metadata === 'object' && mapped.metadata !== null ? mapped.metadata : {},
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
    if (seen.size > 10000) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    accepted.push(event);
  };

  return {
    descriptor: config.descriptor,
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
      if (Array.isArray(raw)) {
        if (raw.length === 0) {
          rejected.push({ index: 0, reason: 'empty batch' });
          return { accepted, rejected };
        }
        raw.forEach((item, index) => parseOne(item, index, accepted, rejected));
        return { accepted, rejected };
      }
      parseOne(raw, 0, accepted, rejected);
      return { accepted, rejected };
    },
  };
}
