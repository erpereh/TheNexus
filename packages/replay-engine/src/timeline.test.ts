import { describe, expect, it } from 'vitest';
import { parseNormalizedEvent } from '@thenexus/contracts';
import type { NormalizedEvent } from '@thenexus/contracts';
import { buildReplayTimeline } from './timeline';

function eventAt(index: number, occurredAt: string): NormalizedEvent {
  return parseNormalizedEvent({
    schemaVersion: 1,
    eventId: `evt_${String(index).padStart(4, '0')}`,
    workspaceId: 'ws_demo',
    sessionId: 'sess_0001',
    agentId: 'agent_0001',
    parentAgentId: null,
    sequence: index,
    occurredAt,
    kind: 'activity.changed',
    activity: 'coding',
    source: { adapterId: 'simulator', provider: 'simulator' },
    metadata: {},
  });
}

describe('buildReplayTimeline', () => {
  it('preserves observed event order exactly', () => {
    const recording = {
      formatVersion: 1 as const,
      recordingId: 'rec_0001',
      createdAt: '2026-09-03T21:00:00.000Z',
      generator: { adapterId: 'simulator', provider: 'simulator' },
      events: [
        eventAt(1, '2026-09-03T21:00:05.000Z'),
        eventAt(2, '2026-09-03T21:00:01.000Z'),
        eventAt(3, '2026-09-03T21:00:03.000Z'),
      ],
      eventCount: 3,
    };
    const timeline = buildReplayTimeline(recording);
    expect(timeline.entries.map((e) => e.eventId)).toEqual(['evt_0001', 'evt_0002', 'evt_0003']);
    expect(timeline.totalEvents).toBe(3);
  });

  it('computes offsets from the first event and clamps non-monotonic gaps to zero', () => {
    const recording = {
      formatVersion: 1 as const,
      recordingId: 'rec_0001',
      createdAt: '2026-09-03T21:00:00.000Z',
      generator: { adapterId: 'simulator', provider: 'simulator' },
      events: [
        eventAt(1, '2026-09-03T21:00:10.000Z'),
        eventAt(2, '2026-09-03T21:00:14.000Z'),
        eventAt(3, '2026-09-03T21:00:12.000Z'),
        eventAt(4, '2026-09-03T21:00:15.000Z'),
      ],
      eventCount: 4,
    };
    const timeline = buildReplayTimeline(recording);
    expect(timeline.entries.map((e) => e.offsetMs)).toEqual([0, 4000, 2000, 5000]);
    expect(timeline.entries.map((e) => e.delayMs)).toEqual([0, 4000, 0, 3000]);
    expect(timeline.durationMs).toBe(5000);
  });

  it('handles an empty recording', () => {
    const timeline = buildReplayTimeline({
      formatVersion: 1 as const,
      recordingId: 'rec_0002',
      createdAt: '2026-09-03T21:00:00.000Z',
      generator: { adapterId: 'simulator', provider: 'simulator' },
      events: [],
      eventCount: 0,
    });
    expect(timeline.entries).toEqual([]);
    expect(timeline.durationMs).toBe(0);
  });
});
