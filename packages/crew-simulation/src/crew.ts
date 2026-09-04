import type { CrewCharacter, GuestAgent } from '@thenexus/contracts';
import { GuestAgentSchema } from '@thenexus/contracts';
import { createPrng } from '@thenexus/simulator';

const GUEST_POOL_PACK_ID = 'pack_guest_pool';

export interface CrewAssignment {
  assignmentId: string;
  /** Persistent crew member, or null when a guest was created. */
  characterId: string | null;
  guestId: string | null;
  workspaceId: string;
  sessionId: string;
  agentId: string;
  taskId?: string;
  startedAt: string;
}

export interface CrewRoster {
  crew: readonly CrewCharacter[];
  guests: readonly GuestAgent[];
  assignments: readonly CrewAssignment[];
}

export interface AssignRequest {
  workspaceId: string;
  sessionId: string;
  agentId: string;
  taskId?: string;
  /** Manual pin honored before any automatic policy when still valid. */
  pinnedCharacterId?: string;
  /** Soft hints; more overlap wins, ties break by id ascending. */
  specialtyHints?: readonly string[];
}

export interface AssignResult {
  assignment: CrewAssignment;
  roster: CrewRoster;
  /** Present when the policy created a Guest Agent (no crew available). */
  guest?: GuestAgent;
}

/**
 * Assignment policy (game/02 order):
 *   1. manual pin when the character exists and is available;
 *   2. available crew with the most specialty overlap;
 *   3. deterministic fallback: available crew ordered by id ascending;
 *   4. Guest Agent when nobody is available.
 * Guests are generated from the safe generic pool pack and never collide:
 * the id counter derives from the roster size.
 */
export function createCrewRoster(crew: readonly CrewCharacter[]): CrewRoster {
  return { crew, guests: [], assignments: [] };
}

export function assignAgent(roster: CrewRoster, request: AssignRequest, now: string): AssignResult {
  const busyIds = new Set(
    roster.assignments.map((a) => a.characterId).filter((id): id is string => id !== null),
  );
  const available = roster.crew.filter((c) => !busyIds.has(c.id));

  const pinned =
    request.pinnedCharacterId !== undefined
      ? available.find((c) => c.id === request.pinnedCharacterId)
      : undefined;

  const hints = request.specialtyHints ?? [];
  const scored = available
    .map((c) => ({
      c,
      overlap: c.specialties.filter((s) => hints.includes(s)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0));

  const chosen = pinned ?? scored[0]?.c;
  const assignmentId = `assign_${String(roster.assignments.length + 1).padStart(4, '0')}`;

  const base: CrewAssignment = {
    assignmentId,
    characterId: null,
    guestId: null,
    workspaceId: request.workspaceId,
    sessionId: request.sessionId,
    agentId: request.agentId,
    startedAt: now,
    ...(request.taskId !== undefined ? { taskId: request.taskId } : {}),
  };

  if (chosen !== undefined) {
    const assignment = { ...base, characterId: chosen.id };
    return {
      assignment,
      roster: { ...roster, assignments: [...roster.assignments, assignment] },
    };
  }

  const guest: GuestAgent = GuestAgentSchema.parse({
    id: `guest_${String(roster.guests.length + 1).padStart(4, '0')}`,
    generatedFromPackId: GUEST_POOL_PACK_ID,
    createdFromAgentId: request.agentId,
    createdAt: now,
  });
  const assignment = { ...base, guestId: guest.id };
  return {
    assignment,
    roster: {
      ...roster,
      guests: [...roster.guests, guest],
      assignments: [...roster.assignments, assignment],
    },
    guest,
  };
}

export function releaseAssignment(
  roster: CrewRoster,
  assignmentId: string,
  _now: string,
): CrewRoster {
  return {
    ...roster,
    assignments: roster.assignments.filter((a) => a.assignmentId !== assignmentId),
  };
}

export function convertGuestToCrew(
  roster: CrewRoster,
  guestId: string,
  identity: { displayName: string; role?: string },
  now: string,
): CrewRoster {
  const guest = roster.guests.find((g) => g.id === guestId);
  if (guest === undefined) {
    throw new Error(`Unknown guest: ${guestId}`);
  }
  const member: CrewCharacter = {
    id: `char_${guest.id.replace('guest_', '').padStart(4, '0')}`,
    displayName: identity.displayName,
    packId: guest.generatedFromPackId,
    role: identity.role ?? null,
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
    createdAt: now,
  };
  return {
    ...roster,
    crew: [...roster.crew, member],
    guests: roster.guests.filter((g) => g.id !== guestId),
  };
}

/**
 * Cosmetic/statistical progression only: task completion bumps counters.
 * Level is derived (every 10 completed tasks) and never gates features.
 */
export function recordTaskCompletion(
  member: CrewCharacter,
  options: { errorsRecovered?: boolean; accompaniedSubagent?: boolean } = {},
): CrewCharacter {
  return {
    ...member,
    stats: {
      ...member.stats,
      tasksCompleted: member.stats.tasksCompleted + 1,
      errorsRecoveredFrom:
        member.stats.errorsRecoveredFrom + (options.errorsRecovered === true ? 1 : 0),
      subagentsAccompanied:
        member.stats.subagentsAccompanied + (options.accompaniedSubagent === true ? 1 : 0),
    },
  };
}

export function crewLevel(member: CrewCharacter): number {
  return 1 + Math.floor(member.stats.tasksCompleted / 10);
}

/** Symmetric affinity bump after a shared session (cosmetic social layer). */
export function recordSharedSession(
  a: CrewCharacter,
  b: CrewCharacter,
): [CrewCharacter, CrewCharacter] {
  const bump = (c: CrewCharacter, otherId: string): CrewCharacter => ({
    ...c,
    affinity: { ...c.affinity, [otherId]: (c.affinity[otherId] ?? 0) + 1 },
  });
  return [bump(a, b.id), bump(b, a.id)];
}

export interface IdleRoomView {
  roomInstanceId: string;
  roomType: string;
}

/**
 * Personality-driven idle destination: favorite rooms get a weight boost,
 * curiosity adds exploration weight to non-favorites. Deterministic for a
 * given seed via the simulator PRNG. Influences ONLY ambient idle life —
 * this module has no way to affect any real or simulated task.
 */
export function chooseIdleDestination(
  member: CrewCharacter,
  rooms: readonly IdleRoomView[],
  rand: () => number,
): string | null {
  if (rooms.length === 0) return null;
  const weights = rooms.map((room) => {
    const favorite = member.favoriteRoomTypes.includes(
      room.roomType as CrewCharacter['favoriteRoomTypes'][number],
    );
    // Favorites dominate; curiosity only adds mild exploration pull to
    // non-favorite rooms (capped below the favorite weight).
    return favorite ? 5 : 1 + member.personality.curiosity;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < rooms.length; i++) {
    const weight = weights[i] ?? 0;
    if (roll < weight) {
      return rooms[i]?.roomInstanceId ?? null;
    }
    roll -= weight;
  }
  return rooms[rooms.length - 1]?.roomInstanceId ?? null;
}

// Re-exported so ambient systems can derive deterministic idle jitter
// without importing the simulator directly at call sites.
export { createPrng };
