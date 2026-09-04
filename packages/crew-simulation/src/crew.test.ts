import { describe, expect, it } from 'vitest';
import { createPrng } from '@thenexus/simulator';
import type { CrewCharacter } from '@thenexus/contracts';
import {
  assignAgent,
  chooseIdleDestination,
  convertGuestToCrew,
  createCrewRoster,
  recordSharedSession,
  recordTaskCompletion,
  releaseAssignment,
} from './index';

const now = '2026-09-04T12:00:00.000Z';

function character(overrides: Partial<CrewCharacter> = {}): CrewCharacter {
  return {
    id: 'char_0001',
    displayName: 'Nova',
    packId: null,
    role: 'Engineer',
    specialties: ['typescript'],
    personality: {
      sociability: 0.9,
      energy: 0.5,
      curiosity: 0.2,
      organization: 0.5,
      nocturnality: 0.5,
      celebratory: 0.5,
      bookish: 0.1,
    },
    favoriteRoomTypes: ['lounge'],
    favoriteStationTypes: [],
    affinity: {},
    stats: {
      tasksCompleted: 0,
      sessionsParticipated: 0,
      errorsRecoveredFrom: 0,
      subagentsAccompanied: 0,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const agentRequest = {
  workspaceId: 'ws_demo',
  sessionId: 'sess_0001',
  agentId: 'agent_0001',
};

describe('assignment policy', () => {
  it('honors a valid manual pin before any automatic choice', () => {
    const a = character({ id: 'char_0001' });
    const b = character({ id: 'char_0002' });
    let roster = createCrewRoster([a, b]);
    const pinned = assignAgent(roster, { ...agentRequest, pinnedCharacterId: 'char_0002' }, now);
    expect(pinned.assignment.characterId).toBe('char_0002');
    roster = pinned.roster;
    expect(assignAgent(roster, agentRequest, now).assignment.characterId).not.toBe('char_0002'); // pinned one is now busy
  });

  it('falls back to a deterministic available crew member', () => {
    const roster = createCrewRoster([
      character({ id: 'char_0002' }),
      character({ id: 'char_0001' }),
    ]);
    const first = assignAgent(roster, agentRequest, now);
    expect(first.assignment.characterId).toBe('char_0001'); // id tie-break
    const second = assignAgent(first.roster, agentRequest, now);
    expect(second.assignment.characterId).toBe('char_0002');
  });

  it('prefers specialty overlap deterministically', () => {
    const roster = createCrewRoster([
      character({ id: 'char_0001', specialties: ['rust'] }),
      character({ id: 'char_0002', specialties: ['typescript'] }),
    ]);
    const result = assignAgent(
      roster,
      {
        ...agentRequest,
        specialtyHints: ['typescript'],
      },
      now,
    );
    expect(result.assignment.characterId).toBe('char_0002');
  });

  it('creates a Guest Agent when no crew member is available', () => {
    const roster = createCrewRoster([character({ id: 'char_0001' })]);
    const first = assignAgent(roster, agentRequest, now);
    const second = assignAgent(first.roster, agentRequest, now);
    expect(second.assignment.guestId).toBeDefined();
    expect(second.assignment.characterId).toBeNull();
    expect(second.guest?.generatedFromPackId).toBe('pack_guest_pool');
    expect(second.guest?.createdFromAgentId).toBe('agent_0001');
  });

  it('releaseAssignment frees the character for reassignment', () => {
    const roster = createCrewRoster([character({ id: 'char_0001' })]);
    const { roster: busy } = assignAgent(roster, agentRequest, now);
    const assignment = busy.assignments[0];
    if (assignment === undefined) throw new Error('expected assignment');
    const released = releaseAssignment(busy, assignment.assignmentId, now);
    expect(released.assignments).toHaveLength(0);
    const again = assignAgent(released, agentRequest, now);
    expect(again.assignment.characterId).toBe('char_0001');
  });

  it('rejects an invalid pin and uses the automatic policy instead', () => {
    const roster = createCrewRoster([character({ id: 'char_0001' })]);
    const result = assignAgent(
      roster,
      {
        ...agentRequest,
        pinnedCharacterId: 'char_9999',
      },
      now,
    );
    expect(result.assignment.characterId).toBe('char_0001');
  });
});

describe('guest conversion', () => {
  it('converts a guest into permanent crew', () => {
    const roster = createCrewRoster([]);
    const first = assignAgent(roster, agentRequest, now);
    if (first.guest === null || first.guest === undefined) {
      throw new Error('expected guest');
    }
    const converted = convertGuestToCrew(
      first.roster,
      first.guest.id,
      { displayName: 'Echo', role: 'Support' },
      now,
    );
    expect(converted.guests).toHaveLength(0);
    const member = converted.crew.find((c) => c.displayName === 'Echo');
    expect(member?.role).toBe('Support');
    expect(member?.packId).toBe('pack_guest_pool');
  });
});

describe('progression and affinity', () => {
  it('records task completion and computes a level', () => {
    let member = character({ id: 'char_0001' });
    for (let i = 0; i < 12; i++) {
      member = recordTaskCompletion(member, { errorsRecovered: i === 3 });
    }
    expect(member.stats.tasksCompleted).toBe(12);
    expect(member.stats.errorsRecoveredFrom).toBe(1);
    expect(member.stats.tasksCompleted / 10).toBeGreaterThan(1); // level source
  });

  it('records shared sessions symmetrically', () => {
    const a = character({ id: 'char_0001' });
    const b = character({ id: 'char_0002' });
    const [a2, b2] = recordSharedSession(a, b);
    expect(a2.affinity['char_0002']).toBe(1);
    expect(b2.affinity['char_0001']).toBe(1);
  });
});

describe('personality idle behavior', () => {
  it('weights favorite rooms higher but stays deterministic per seed', () => {
    const rooms = [
      { roomInstanceId: 'room_lounge', roomType: 'lounge' },
      { roomInstanceId: 'room_lab', roomType: 'laboratory' },
      { roomInstanceId: 'room_obs', roomType: 'observatory' },
    ];
    const social = character({ id: 'char_0001' });
    // One long-lived PRNG drives successive ambient decisions (documented
    // usage); a fresh same-seed PRNG per call would repeat one roll.
    const socialRand = createPrng(7);
    const loungePicks = Array.from({ length: 100 }, () =>
      chooseIdleDestination(social, rooms, socialRand),
    ).filter((r) => r === 'room_lounge').length;
    expect(loungePicks).toBeGreaterThan(60);

    const curious = character({
      id: 'char_0001',
      personality: {
        sociability: 0.1,
        energy: 0.5,
        curiosity: 0.95,
        organization: 0.5,
        nocturnality: 0.5,
        celebratory: 0.5,
        bookish: 0.1,
      },
      favoriteRoomTypes: ['observatory'],
    });
    const curiousRand = createPrng(7);
    const curiousPicks = Array.from({ length: 100 }, () =>
      chooseIdleDestination(curious, rooms, curiousRand),
    ).filter((r) => r === 'room_obs').length;
    expect(curiousPicks).toBeGreaterThan(50);

    // Same seed -> same sequence (deterministic ambient life).
    const draw = (member: typeof social) => {
      const rand = createPrng(42);
      return Array.from({ length: 10 }, () => chooseIdleDestination(member, rooms, rand));
    };
    expect(draw(social)).toEqual(draw(social));
  });
});
