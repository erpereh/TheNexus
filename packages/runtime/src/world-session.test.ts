import { describe, expect, it } from 'vitest';
import type { CrewCharacter, SemanticActivity } from '@thenexus/contracts';
import { WorldSession } from './world-session';

const START = '2026-09-03T21:00:00.000Z';

function character(id: string, displayName: string): CrewCharacter {
  return {
    id,
    displayName,
    packId: null,
    role: 'Engineer',
    specialties: [],
    personality: {
      sociability: 0.5,
      energy: 0.5,
      curiosity: 0.5,
      organization: 0.5,
      nocturnality: 0.5,
      celebratory: 0.5,
      bookish: 0.5,
    },
    favoriteRoomTypes: [],
    favoriteStationTypes: [],
    affinity: {},
    stats: {
      tasksCompleted: 0,
      sessionsParticipated: 0,
      errorsRecoveredFrom: 0,
      subagentsAccompanied: 0,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}

function roster(size: number): CrewCharacter[] {
  return Array.from({ length: size }, (_, i) => {
    const n = String(i + 1).padStart(4, '0');
    return character(`char_${n}`, `Crew ${n}`);
  });
}

/** Advances in fixed 100ms ticks (the world sim quantum). */
function advanceTicks(session: WorldSession, ticks: number): void {
  for (let i = 0; i < ticks; i++) session.advance(100);
}

function activities(
  session: WorldSession,
): { activity: SemanticActivity; room: string; station: string }[] {
  return session.snapshot().history.map((trace) => ({
    activity: trace.activity,
    room: trace.roomType,
    station: trace.stationType,
  }));
}

describe('WorldSession deterministic pipeline', () => {
  it('repeats byte-identically for the same scenario and tick plan', () => {
    const run = (): string => {
      const session = new WorldSession({ roster: roster(12) });
      session.start('nested-subagents');
      advanceTicks(session, 150);
      const snap = session.snapshot();
      session.dispose();
      return JSON.stringify({
        tick: snap.tick,
        cells: snap.world.characters.map((c) => [c.id, c.cell, c.facing, c.moving]),
        presentation: [...snap.presentation.values()].map((p) => [p.id, p.label, p.activity]),
        traces: snap.history.map((t) => [
          t.eventId,
          t.activity,
          t.ruleId,
          t.roomInstanceId,
          t.stationInstanceId,
        ]),
      });
    };
    expect(run()).toBe(run());
  });

  it('routes coding/testing/researching through semantic rooms and stations', () => {
    const session = new WorldSession({ roster: roster(12) });
    session.start('nested-subagents');
    advanceTicks(session, 200);
    const seen = activities(session);
    const coding = seen.find((s) => s.activity === 'coding');
    expect(coding, 'expected a coding event in the scenario').toBeDefined();
    expect(coding?.room).toBe('engineering');
    expect(coding?.station).toBe('coding_workstation');
    const testing = seen.find((s) => s.activity === 'testing');
    expect(testing, 'expected a testing event in the scenario').toBeDefined();
    expect(testing?.room).toBe('laboratory');
    expect(testing?.station).toBe('test_bench');
    const researching = seen.find((s) => s.activity === 'researching');
    expect(researching, 'expected a researching event in the scenario').toBeDefined();
    expect(researching?.room).toBe('observatory');
    expect(researching?.station).toBe('research_scope');
    session.dispose();
  });

  it('keeps parent and subagent as separate visible world characters', () => {
    const session = new WorldSession({ roster: roster(12) });
    session.start('nested-subagents');
    advanceTicks(session, 200);
    const snap = session.snapshot();
    const ids = snap.world.characters.map((c) => c.id);
    const parent = ids.find((id) => id.includes('agent_0001') && !id.includes('sub'));
    const sub = ids.find((id) => id.includes('agent_0001_sub'));
    expect(parent).toBeDefined();
    expect(sub).toBeDefined();
    expect(parent).not.toBe(sub);
    session.dispose();
  });

  it('falls back to Guest Agents when no crew is available', () => {
    const session = new WorldSession({ roster: [] });
    session.start('nested-subagents');
    advanceTicks(session, 200);
    const snap = session.snapshot();
    expect(snap.counts.agents).toBeGreaterThan(0);
    expect(snap.counts.guests).toBe(snap.counts.agents);
    for (const info of snap.presentation.values()) {
      expect(info.isGuest).toBe(true);
    }
    session.dispose();
  });

  it('falls back to a generic workstation when the preferred station is sealed', () => {
    const session = new WorldSession({ roster: roster(4) });
    // Seal every coding_workstation: block footprint + all neighbors.
    for (const station of session.ship.stations) {
      if (station.stationType !== 'coding_workstation') continue;
      for (const cell of station.footprint) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            session.ship.grid.setBlocked(cell.x + dx, cell.y + dy, true);
          }
        }
      }
    }
    session.start({
      seed: 7,
      workspaceId: 'ws_sealed',
      agentCount: 2,
      eventsPerAgent: 6,
      startTime: START,
    });
    advanceTicks(session, 120);
    const trace = session.snapshot().history.find((t) => t.activity === 'coding');
    expect(trace, 'expected a coding event in the scenario').toBeDefined();
    // Mapping still resolves the semantic preference; the session reroutes.
    expect(trace?.stationType).toBe('coding_workstation');
    expect(trace?.destinationStationId).toBeDefined();
    const destination = session.ship.stations.find(
      (s) => s.stationInstanceId === trace?.destinationStationId,
    );
    expect(destination?.stationType).toBe('generic_workstation');
    expect(trace?.fallbackSteps.some((step) => step.startsWith('station-unreachable:'))).toBe(true);
    session.dispose();
  });

  it('holds position without crossing blocked geometry when nothing is reachable', () => {
    const session = new WorldSession({ roster: roster(2) });
    // Seal every station of every type.
    for (const station of session.ship.stations) {
      for (const cell of station.footprint) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            session.ship.grid.setBlocked(cell.x + dx, cell.y + dy, true);
          }
        }
      }
    }
    session.start({
      seed: 7,
      workspaceId: 'ws_sealed_all',
      agentCount: 2,
      eventsPerAgent: 6,
      startTime: START,
    });
    advanceTicks(session, 120);
    const snap = session.snapshot();
    expect(snap.world.characters.length).toBeGreaterThan(0);
    for (const c of snap.world.characters) {
      expect(session.ship.grid.isWalkable(c.cell.x, c.cell.y)).toBe(true);
    }
    session.dispose();
  });

  it('never places characters on blocked cells during a full run', () => {
    const session = new WorldSession({ roster: roster(12) });
    session.start('nested-subagents');
    for (let i = 0; i < 200; i++) {
      session.advance(100);
      for (const c of session.snapshot().world.characters) {
        expect(session.ship.grid.isWalkable(c.cell.x, c.cell.y), `${c.id} on blocked cell`).toBe(
          true,
        );
      }
    }
    session.dispose();
  });

  it('resets to a clean deterministic state', () => {
    const session = new WorldSession({ roster: roster(12) });
    session.start('nested-subagents');
    advanceTicks(session, 150);
    const before = JSON.stringify(session.snapshot().world.characters);
    session.reset();
    const fresh = session.snapshot();
    expect(fresh.tick).toBe(0);
    expect(fresh.world.characters).toHaveLength(0);
    advanceTicks(session, 150);
    expect(JSON.stringify(session.snapshot().world.characters)).toBe(before);
    session.dispose();
  });

  it('does not accumulate subscriptions across repeated runs', () => {
    const session = new WorldSession({ roster: roster(12) });
    expect(session.activeSubscriptions).toBe(0);
    session.start('nested-subagents');
    expect(session.activeSubscriptions).toBe(1);
    advanceTicks(session, 50);
    session.dispose();
    expect(session.activeSubscriptions).toBe(0);
    session.start('nested-subagents');
    expect(session.activeSubscriptions).toBe(1);
    advanceTicks(session, 50);
    const snap = session.snapshot();
    expect(snap.world.characters.length).toBeGreaterThan(0);
    // Restarting without an explicit dispose still leaves exactly one subscription.
    session.start('nested-subagents');
    expect(session.activeSubscriptions).toBe(1);
    session.dispose();
    expect(session.activeSubscriptions).toBe(0);
  });

  it('supports the 100-agent scale preset end to end', () => {
    const session = new WorldSession({ roster: roster(120) });
    session.start('agents-100');
    advanceTicks(session, 100);
    const snap = session.snapshot();
    expect(snap.counts.agents).toBe(100);
    expect(snap.world.characters).toHaveLength(100);
    session.dispose();
  }, 30000);
});
