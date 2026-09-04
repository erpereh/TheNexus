import type {
  AdapterCapabilities,
  HarnessAdapterDescriptor,
  NormalizedEvent,
} from '@thenexus/contracts';

/**
 * Adapter health states surfaced in Communications/Settings without making
 * the whole application unhealthy (docs/architecture/03-harness-adapters.md).
 */
export const ADAPTER_HEALTH_STATES = [
  'not_configured',
  'available',
  'observing',
  'degraded',
  'permission_required',
  'unsupported_version',
  'disconnected',
  'error',
] as const;

export type AdapterHealthState = (typeof ADAPTER_HEALTH_STATES)[number];

export interface AdapterHealth {
  state: AdapterHealthState;
  detail?: string;
}

export interface ParsedEventRejection {
  index: number;
  reason: string;
}

export interface IngestResult {
  accepted: readonly NormalizedEvent[];
  rejected: readonly ParsedEventRejection[];
}

/**
 * A harness adapter translates provider-specific observations into
 * normalized events and declares its capability set. Adapters NEVER render
 * UI, invent unsupported metadata, submit prompts, use credentials, mutate
 * provider configuration, or scan unrelated data.
 */
export interface HarnessAdapter {
  readonly descriptor: HarnessAdapterDescriptor;
  health(): AdapterHealth;
  /**
   * Parses one provider-specific observation (an object, a JSONL line
   * string, etc.). Implementations must never throw: unknown/malformed
   * input is reported per-item in `rejected`.
   */
  parse(raw: unknown): IngestResult;
  /** Downgrade/upgrade health as sources appear/disappear. */
  setHealth(state: AdapterHealthState, detail?: string): void;
}

/**
 * Control capability surface (SDK-level from v1, hard-disabled unless a
 * human explicitly enables it at construction). No world, personality or
 * simulation system may ever reach this path; adapters throw instead of
 * dispatching when control is disabled.
 */
export interface ControlRequest {
  action: 'sendTask' | 'sendMessage' | 'cancelTask';
  sessionId: string;
  payload: string;
}

export interface ControlAuditEntry {
  requestedAt: string;
  request: ControlRequest;
  outcome: 'dispatched' | 'rejected-control-disabled' | 'rejected-unsupported';
}

export interface AdapterControlOptions {
  /** Must be explicitly set by a human action; never a default. */
  experimentalControlEnabled: boolean;
  /** ISO timestamp provider; inject for deterministic tests. */
  now?: () => string;
}

export interface AdapterControlGateway {
  dispatch(request: ControlRequest): void;
  auditLog(): readonly ControlAuditEntry[];
}

export function createControlGateway(
  descriptor: HarnessAdapterDescriptor,
  options: AdapterControlOptions,
): AdapterControlGateway {
  const audit: ControlAuditEntry[] = [];
  const now = options.now ?? (() => new Date().toISOString());
  const supports = (action: ControlRequest['action']): boolean => {
    const caps: AdapterCapabilities = descriptor.capabilities;
    if (action === 'sendTask') return caps.sendTask;
    if (action === 'sendMessage') return caps.sendMessage;
    return caps.cancelTask;
  };
  return {
    dispatch(request: ControlRequest): void {
      if (!options.experimentalControlEnabled || !supports(request.action)) {
        audit.push({
          requestedAt: now(),
          request,
          outcome: options.experimentalControlEnabled
            ? 'rejected-unsupported'
            : 'rejected-control-disabled',
        });
        throw new Error(
          `Control dispatch refused for adapter ${descriptor.id} (action ${request.action}): experimental control is ${
            options.experimentalControlEnabled ? 'not supported by this adapter' : 'disabled'
          }`,
        );
      }
      // With control explicitly enabled AND supported, the host runtime
      // performs the actual provider dispatch; the SDK only audits here.
      audit.push({ requestedAt: now(), request, outcome: 'dispatched' });
    },
    auditLog(): readonly ControlAuditEntry[] {
      return [...audit];
    },
  };
}
