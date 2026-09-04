import { describe, expect, it, vi } from 'vitest';
import type { NormalizedEvent } from '@thenexus/contracts';
import { createEventBus } from './event-bus';
function makeEvent(index: number): NormalizedEvent {
  return {
    schemaVersion: 1,
    eventId: `evt_${String(index).padStart(4, '0')}`,
    workspaceId: 'ws_demo',
    sessionId: 'sess_0001',
    agentId: 'agent_0001',
    parentAgentId: null,
    sequence: index,
    occurredAt: '2026-09-03T21:00:00.000Z',
    kind: 'activity.changed',
    activity: 'coding',
    source: { adapterId: 'simulator', provider: 'simulator' },
    metadata: {},
  };
}

describe('createEventBus', () => {
  it('delivers published events in order to a subscriber', () => {
    const bus = createEventBus();
    const received: string[] = [];
    bus.subscribe((event) => received.push(event.eventId));
    for (let i = 1; i <= 3; i++) bus.publish(makeEvent(i));
    expect(received).toEqual(['evt_0001', 'evt_0002', 'evt_0003']);
  });

  it('supports multiple subscribers receiving the same stream', () => {
    const bus = createEventBus();
    const a: string[] = [];
    const b: string[] = [];
    bus.subscribe((e) => a.push(e.eventId));
    bus.subscribe((e) => b.push(e.eventId));
    bus.publish(makeEvent(1));
    expect(a).toEqual(['evt_0001']);
    expect(b).toEqual(['evt_0001']);
  });

  it('stops delivery after unsubscribe', () => {
    const bus = createEventBus();
    const received: string[] = [];
    const unsubscribe = bus.subscribe((e) => received.push(e.eventId));
    bus.publish(makeEvent(1));
    unsubscribe();
    bus.publish(makeEvent(2));
    expect(received).toEqual(['evt_0001']);
  });

  it('unsubscribe is idempotent and does not affect other subscribers', () => {
    const bus = createEventBus();
    const received: string[] = [];
    const unsubscribeA = bus.subscribe((e) => received.push(`a:${e.eventId}`));
    bus.subscribe((e) => received.push(`b:${e.eventId}`));
    unsubscribeA();
    unsubscribeA();
    bus.publish(makeEvent(1));
    expect(received).toEqual(['b:evt_0001']);
  });

  it('clear() detaches all subscribers and subsequent publishes are isolated', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.subscribe(listener);
    bus.publish(makeEvent(1));
    bus.clear();
    expect(() => bus.publish(makeEvent(2))).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid events at the boundary without notifying subscribers', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.subscribe(listener);
    expect(() => bus.publish({ notAnEvent: true } as unknown as NormalizedEvent)).toThrow(
      /normalized event/i,
    );
    expect(listener).not.toHaveBeenCalled();
  });

  it('a throwing listener does not corrupt bus state nor block other listeners', () => {
    const errors: unknown[] = [];
    const bus = createEventBus({
      onListenerError: (error) => errors.push(error),
    });
    const received: string[] = [];
    // Ruling: listener errors are contained per-listener (routed to the
    // injected sink) so one broken subscriber cannot silence others.
    bus.subscribe(() => {
      throw new Error('listener exploded');
    });
    bus.subscribe((e) => received.push(e.eventId));
    expect(() => bus.publish(makeEvent(1))).not.toThrow();
    expect(received).toEqual(['evt_0001']);
    expect(errors).toHaveLength(1);
    // Bus remains fully usable after the failure.
    bus.publish(makeEvent(2));
    expect(received).toEqual(['evt_0001', 'evt_0002']);
  });

  it('handles high-volume publishes (backpressure by synchronous queueing)', () => {
    const bus = createEventBus();
    let count = 0;
    bus.subscribe(() => count++);
    for (let i = 1; i <= 10000; i++) bus.publish(makeEvent(i));
    expect(count).toBe(10000);
  });
});

describe('malformed/unknown event robustness', () => {
  // Mirrors the shapes the Harness Simulator's malformed fixture generates
  // (unknown future kinds, wrong types, garbage) so the bus boundary is
  // proven to reject them without corrupting subscriber state.
  const malformedSamples: unknown[] = [
    { kind: 'totally.unknown.future_kind' },
    { schemaVersion: 2, eventId: 'evt_future' },
    { eventId: '', kind: 'activity.changed' },
    'not even an object',
    42,
    null,
    { eventId: 'evt_bad_time', occurredAt: 'not-a-date', kind: 'activity.changed' },
  ];

  it('rejects every malformed sample with a descriptive error', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.subscribe(listener);
    for (const sample of malformedSamples) {
      expect(() => bus.publish(sample as NormalizedEvent)).toThrow(/normalized event/i);
    }
    expect(listener).not.toHaveBeenCalled();
  });

  it('bus stays usable after malformed input', () => {
    const bus = createEventBus();
    const received: string[] = [];
    bus.subscribe((e) => received.push(e.eventId));
    for (const sample of malformedSamples) {
      expect(() => bus.publish(sample as NormalizedEvent)).toThrow();
    }
    bus.publish(makeEvent(9));
    expect(received).toEqual(['evt_0009']);
  });
});
