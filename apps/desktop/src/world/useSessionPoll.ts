import { useEffect, useState } from 'react';
import type { SemanticActivity } from '@thenexus/contracts';
import type { WorldSession } from '@thenexus/runtime';

export interface PolledAgent {
  worldId: string;
  label: string;
  activity: SemanticActivity;
  room: string;
  station: string;
  statusSymbol: string;
  isGuest: boolean;
}

export interface RecentEvent {
  eventId: string;
  activity: SemanticActivity;
  ruleId: string | null;
  roomType: string;
  stationType: string;
}

export interface SessionPoll {
  started: boolean;
  tick: number;
  simTimeMs: number;
  agentCount: number;
  sessionCount: number;
  guestCount: number;
  agents: PolledAgent[];
  recent: RecentEvent[];
}

const EMPTY: SessionPoll = {
  started: false,
  tick: 0,
  simTimeMs: 0,
  agentCount: 0,
  sessionCount: 0,
  guestCount: 0,
  agents: [],
  recent: [],
};

function statusSymbol(activity: SemanticActivity, waiting: boolean): string {
  if (activity === 'error') return '✕';
  if (activity === 'completed') return '★';
  if (activity === 'waiting-user' || waiting) return '❚❚';
  return '●';
}

/**
 * Polls a `WorldSession` snapshot on an interval (never at frame rate) and
 * projects it into render-ready panel data. Shared by the world drawer, the
 * sidebar status card and the topbar project indicator so every surface
 * reads the same live runtime state.
 */
export function useSessionPoll(session: WorldSession, intervalMs = 500): SessionPoll {
  const [poll, setPoll] = useState<SessionPoll>(EMPTY);
  useEffect(() => {
    const read = (): void => {
      const snap = session.snapshot();
      const agents: PolledAgent[] = snap.world.characters.map((c) => {
        const info = snap.presentation.get(c.id);
        const trace = snap.traces.get(c.id);
        return {
          worldId: c.id,
          label: info?.label ?? c.id,
          activity: info?.activity ?? 'idle',
          room: trace?.roomType ?? '—',
          station: trace?.stationType ?? '—',
          statusSymbol: statusSymbol(info?.activity ?? 'idle', info?.waiting ?? c.waiting),
          isGuest: info?.isGuest ?? false,
        };
      });
      setPoll({
        started: snap.world.characters.length > 0 || snap.simTimeMs > 0,
        tick: snap.tick,
        simTimeMs: snap.simTimeMs,
        agentCount: snap.counts.agents,
        sessionCount: snap.counts.sessions,
        guestCount: snap.counts.guests,
        agents,
        recent: snap.history
          .slice(-12)
          .reverse()
          .map((t) => ({
            eventId: t.eventId,
            activity: t.activity,
            ruleId: t.ruleId,
            roomType: t.roomType,
            stationType: t.stationType,
          })),
      });
    };
    read();
    const timer = setInterval(read, intervalMs);
    return () => clearInterval(timer);
  }, [session, intervalMs]);
  return poll;
}
