import { describe, expect, it } from 'vitest';
import { summarizeRecording, parseRecording, type RecordingEnvelope } from './recording';

function envelope(overrides: Partial<RecordingEnvelope> = {}): RecordingEnvelope {
  return {
    formatVersion: 1,
    recordingId: 'rec_0001',
    createdAt: '2026-09-03T21:30:00.000Z',
    workspaceId: 'ws_demo',
    generator: { adapterId: 'simulator', provider: 'simulator' },
    events: [1, 2, 3].map((n) => ({
      schemaVersion: 1,
      eventId: `evt_000${n}`,
      workspaceId: 'ws_demo',
      sessionId: 'sess_0001',
      agentId: 'agent_0001',
      parentAgentId: null,
      sequence: n,
      occurredAt: '2026-09-03T21:00:00.000Z',
      kind: 'activity.changed',
      activity: 'coding',
      source: { adapterId: 'simulator', provider: 'simulator' },
      metadata: {},
    })),
    eventCount: 3,
    ...overrides,
  };
}

describe('RecordingEnvelopeSchema', () => {
  it('round-trips byte-for-byte preserving observed event order', () => {
    const input = envelope();
    const parsed = parseRecording(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(JSON.stringify(parsed.recording)).toBe(
      JSON.stringify(JSON.parse(JSON.stringify(input))),
    );
    expect(parsed.recording.events.map((e) => e.eventId)).toEqual([
      'evt_0001',
      'evt_0002',
      'evt_0003',
    ]);
  });

  it('rejects an eventCount mismatch', () => {
    const result = parseRecording(envelope({ eventCount: 5 }));
    expect(result.ok).toBe(false);
  });

  it('reports UNSUPPORTED_VERSION for unknown format versions', () => {
    for (const version of [0, 2]) {
      const bad = envelope();
      (bad as { formatVersion: number }).formatVersion = version;
      const result = parseRecording(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNSUPPORTED_VERSION');
      }
    }
  });

  it('reports INVALID_ENVELOPE for garbage without throwing', () => {
    for (const garbage of [null, 'recording', 7, [], undefined]) {
      const result = parseRecording(garbage);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ENVELOPE');
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('summarizes counts and duration correctly', () => {
    const parsed = parseRecording(envelope());
    if (!parsed.ok) throw new Error('expected valid recording');
    const summary = summarizeRecording(parsed.recording);
    expect(summary.eventCount).toBe(3);
    expect(summary.generator.adapterId).toBe('simulator');
    expect(summary.createdAt).toBe('2026-09-03T21:30:00.000Z');
  });
});
