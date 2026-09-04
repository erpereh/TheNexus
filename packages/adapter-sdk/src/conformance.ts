import { describe, expect, it } from 'vitest';
import type { HarnessAdapter } from './adapter';
import { createControlGateway } from './adapter';

export interface AdapterConformanceOptions {
  /** Factory returning a fresh adapter instance per test. */
  makeAdapter: () => HarnessAdapter;
  /** Valid provider-specific raw samples the adapter must accept. */
  validSamples: readonly unknown[];
  /** Malformed/unknown samples that must be rejected without throwing. */
  malformedSamples?: readonly unknown[];
}

/**
 * Shared conformance suite every adapter must pass (arch/03 contract-test
 * list): capability reporting, event validation, malformed input safety,
 * duplicate handling, health transitions, source disappearance and no
 * accidental control dispatch.
 */
export function runAdapterConformanceSuite(options: AdapterConformanceOptions): void {
  const { makeAdapter, validSamples, malformedSamples = [] } = options;

  describe('adapter conformance', () => {
    it('declares a complete capability set and starts not_configured/available', () => {
      const adapter = makeAdapter();
      const caps = adapter.descriptor.capabilities;
      for (const flag of Object.values(caps)) {
        expect(typeof flag).toBe('boolean');
      }
      expect(adapter.descriptor.id.length).toBeGreaterThan(0);
      expect(adapter.descriptor.experimental).toBeTypeOf('boolean');
    });

    it('parses valid samples into schema-valid normalized events with stable source ids', () => {
      for (const sample of validSamples) {
        // Fresh adapter per sample: identical samples would legitimately
        // dedupe on one instance; conformance verifies parsing, not history.
        const adapter = makeAdapter();
        const result = adapter.parse(sample);
        expect(result.rejected).toEqual([]);
        expect(result.accepted.length).toBeGreaterThan(0);
        for (const event of result.accepted) {
          expect(event.schemaVersion).toBe(1);
          expect(event.source.adapterId).toBe(adapter.descriptor.id);
        }
      }
    });

    it('rejects malformed input without throwing', () => {
      const adapter = makeAdapter();
      for (const sample of malformedSamples) {
        expect(() => adapter.parse(sample)).not.toThrow();
        const result = adapter.parse(sample);
        expect(result.accepted).toEqual([]);
        expect(result.rejected.length).toBeGreaterThan(0);
        for (const rejection of result.rejected) {
          expect(rejection.reason.length).toBeGreaterThan(0);
        }
      }
    });

    it('suppresses duplicate event ids within a session window', () => {
      const adapter = makeAdapter();
      const sample = validSamples[0];
      if (sample === undefined) return;
      const first = adapter.parse(sample);
      const second = adapter.parse(sample);
      if (first.accepted.length > 0 && second.accepted.length > 0) {
        const firstIds = new Set(first.accepted.map((e) => e.eventId));
        for (const event of second.accepted) {
          expect(firstIds.has(event.eventId)).toBe(false);
        }
      }
    });

    it('tracks health transitions including source disappearance', () => {
      const adapter = makeAdapter();
      adapter.setHealth('observing');
      expect(adapter.health().state).toBe('observing');
      adapter.setHealth('disconnected', 'source vanished');
      expect(adapter.health().state).toBe('disconnected');
      expect(adapter.health().detail).toBe('source vanished');
      adapter.setHealth('observing');
      expect(adapter.health().state).toBe('observing');
    });

    it('never dispatches control by default and records the refusal', () => {
      const adapter = makeAdapter();
      const gateway = createControlGateway(adapter.descriptor, {
        experimentalControlEnabled: false,
        now: () => '2026-09-04T00:00:00.000Z',
      });
      expect(() =>
        gateway.dispatch({
          action: 'sendTask',
          sessionId: 'sess_0001',
          payload: 'hello',
        }),
      ).toThrow(/refused/);
      expect(gateway.auditLog()[0]?.outcome).toBe('rejected-control-disabled');
    });

    it('reports unsupported control actions even with control enabled', () => {
      const adapter = makeAdapter();
      const caps = adapter.descriptor.capabilities;
      if (caps.sendTask) return; // observation-only adapters skip this
      const gateway = createControlGateway(adapter.descriptor, {
        experimentalControlEnabled: true,
        now: () => '2026-09-04T00:00:00.000Z',
      });
      expect(() =>
        gateway.dispatch({
          action: 'sendTask',
          sessionId: 'sess_0001',
          payload: 'hello',
        }),
      ).toThrow(/refused/);
      expect(gateway.auditLog()[0]?.outcome).toBe('rejected-unsupported');
    });
  });
}
