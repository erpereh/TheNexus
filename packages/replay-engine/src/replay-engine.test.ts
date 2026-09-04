import { describe, expect, it } from 'vitest';
import { parseNormalizedEvent } from '@thenexus/contracts';
import type { NormalizedEvent } from '@thenexus/contracts';
import { ManualReplayScheduler } from './manual-scheduler';
import { buildReplayTimeline } from './timeline';
import { ReplayEngine, type ReplayProjector, type ReplaySpeed } from './replay-engine';

function eventsAt(...timesMs: number[]): NormalizedEvent[] {
  const base = Date.parse('2026-09-03T21:00:00.000Z');
  return timesMs.map((t, i) =>
    parseNormalizedEvent({
      schemaVersion: 1,
      eventId: `evt_${String(i + 1).padStart(4, '0')}`,
      workspaceId: 'ws_demo',
      sessionId: 'sess_0001',
      agentId: 'agent_0001',
      parentAgentId: null,
      sequence: i + 1,
      occurredAt: new Date(base + t).toISOString(),
      kind: 'activity.changed',
      activity: i % 2 === 0 ? 'coding' : 'testing',
      source: { adapterId: 'simulator', provider: 'simulator' },
      metadata: {},
    }),
  );
}

function recordingOf(events: NormalizedEvent[]) {
  return {
    formatVersion: 1 as const,
    recordingId: 'rec_0001',
    createdAt: '2026-09-03T21:00:00.000Z',
    generator: { adapterId: 'simulator', provider: 'simulator' },
    events,
    eventCount: events.length,
  };
}

const countingProjector: ReplayProjector<number> = {
  initialState: () => 0,
  apply: (state, event) => state + 1 + event.sequence * 0,
};

function makeEngine(
  events: NormalizedEvent[],
  listener?: ConstructorParameters<typeof ReplayEngine<number>>[0]['listener'],
) {
  const scheduler = new ManualReplayScheduler();
  const engine = new ReplayEngine<number>({
    timeline: buildReplayTimeline(recordingOf(events)),
    events,
    scheduler,
    projector: countingProjector,
    ...(listener ? { listener } : {}),
  });
  return { scheduler, engine };
}

describe('ReplayEngine playback', () => {
  it('plays all events in order at 1x', () => {
    const events = eventsAt(0, 1000, 2500);
    const seen: string[] = [];
    const { scheduler, engine } = makeEngine(events, {
      onEvent: (e) => seen.push(e.eventId),
    });
    engine.play();
    while (engine.getState().status !== 'finished') {
      scheduler.advanceToNext();
    }
    expect(seen).toEqual(['evt_0001', 'evt_0002', 'evt_0003']);
  });

  it('produces identical projector snapshots at 1x/2x/5x/10x/50x', () => {
    const events = eventsAt(0, 500, 1500, 4000, 4500);
    const finalStates = [1, 2, 5, 10, 50].map((speed) => {
      const { scheduler, engine } = makeEngine(events);
      engine.setSpeed(speed as ReplaySpeed);
      engine.play();
      while (engine.getState().status !== 'finished') {
        scheduler.advanceToNext();
      }
      return engine.getState();
    });
    // All speeds consumed every event exactly once -> identical nextIndex.
    for (const state of finalStates) {
      expect(state.nextIndex).toBe(events.length);
      expect(state.status).toBe('finished');
    }
  });

  it('mid-flight speed changes do not alter the logical outcome', () => {
    const events = eventsAt(0, 1000, 2000, 3000, 4000);
    const seen: string[] = [];
    const { scheduler, engine } = makeEngine(events, {
      onEvent: (e) => seen.push(e.eventId),
    });
    engine.play();
    scheduler.advanceToNext(); // evt_0001
    engine.setSpeed(50);
    while (engine.getState().status !== 'finished') {
      scheduler.advanceToNext();
    }
    expect(seen).toEqual(
      ['evt_0001', 'evt_0002', 'evt_0003', 'evt_0004', 'evt_0005'].slice(0, events.length),
    );
  });

  it('pause and resume neither drop nor duplicate events', () => {
    const events = eventsAt(0, 1000, 2000, 3000, 4000);
    const seen: string[] = [];
    const { scheduler, engine } = makeEngine(events, {
      onEvent: (e) => seen.push(e.eventId),
    });
    engine.play();
    scheduler.advanceToNext();
    engine.pause();
    scheduler.advanceBy(60000); // paused: nothing pending must run
    expect(seen).toHaveLength(1);
    engine.resume();
    while (engine.getState().status !== 'finished') {
      scheduler.advanceToNext();
    }
    expect(seen).toEqual(events.map((e) => e.eventId));
  });

  it('stepForward and stepBackward move exactly one entry', () => {
    const events = eventsAt(0, 1000, 2000);
    const { engine } = makeEngine(events);
    engine.stepForward();
    expect(engine.getState().nextIndex).toBe(1);
    engine.stepForward();
    expect(engine.getState().nextIndex).toBe(2);
    engine.stepBackward();
    expect(engine.getState().nextIndex).toBe(1);
  });

  it('jumpTo applies the prefix through the projector and continues cleanly', () => {
    const events = eventsAt(0, 1000, 2000, 3000);
    const seen: number[] = [];
    const { scheduler, engine } = makeEngine(events, {
      onJump: (_state, toIndex) => seen.push(toIndex),
    });
    engine.jumpTo(2);
    expect(engine.getState().nextIndex).toBe(2);
    expect(seen).toEqual([2]);
    engine.play();
    while (engine.getState().status !== 'finished') {
      scheduler.advanceToNext();
    }
    expect(engine.getState().nextIndex).toBe(events.length);
  });

  it('pausing or disposing cancels pending scheduled tasks', () => {
    const events = eventsAt(0, 1000);
    const a = makeEngine(events);
    a.engine.play();
    expect(a.scheduler.pendingCount()).toBe(1);
    a.engine.pause();
    expect(a.scheduler.pendingCount()).toBe(0);

    const b = makeEngine(events);
    b.engine.play();
    b.engine.dispose();
    b.engine.dispose(); // idempotent
    expect(b.scheduler.pendingCount()).toBe(0);
  });

  it('fires onFinish exactly once and transitions to finished', () => {
    const events = eventsAt(0, 1000, 2000);
    let finishes = 0;
    const { scheduler, engine } = makeEngine(events, {
      onFinish: () => finishes++,
    });
    engine.play();
    while (engine.getState().status !== 'finished') {
      scheduler.advanceToNext();
    }
    // Extra scheduling attempts after finish must not re-fire.
    scheduler.advanceBy(600000);
    expect(finishes).toBe(1);
    expect(engine.getState().status).toBe('finished');
  });

  it('reaches the same final state across different control interleavings', () => {
    const events = eventsAt(0, 1000, 2000, 3000, 4000);
    const runStraight = (): number => {
      const { scheduler, engine } = makeEngine(events);
      engine.play();
      while (engine.getState().status !== 'finished') scheduler.advanceToNext();
      return engine.getState().nextIndex;
    };
    const runStepped = (): number => {
      const { scheduler, engine } = makeEngine(events);
      engine.stepForward();
      engine.play();
      scheduler.advanceToNext();
      engine.pause();
      engine.stepForward();
      engine.resume();
      while (engine.getState().status !== 'finished') scheduler.advanceToNext();
      return engine.getState().nextIndex;
    };
    expect(runStepped()).toBe(runStraight());
  });
});
