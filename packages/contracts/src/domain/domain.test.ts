import { describe, expect, it } from 'vitest';
import {
  GuestAgentSchema,
  ShipSchema,
  isAssignment,
  isCrewCharacter,
  isWorkspace,
  parseAssignment,
  parseCrewCharacter,
  parseWorkspace,
} from './index';

const workspace = {
  id: 'ws_demo',
  name: 'Demo Workspace',
  folders: [{ folderId: 'folder_1', path: 'C:/dev/demo-repo', displayName: 'demo-repo' }],
  isDemo: false,
  createdAt: '2026-09-03T21:00:00.000Z',
};

const crew = {
  id: 'char_0001',
  displayName: 'Nova',
  packId: null,
  role: 'Systems Engineer',
  specialties: ['typescript', 'testing'],
  personality: {
    sociability: 0.6,
    energy: 0.8,
    curiosity: 0.9,
    organization: 0.4,
    nocturnality: 0.2,
    celebratory: 0.7,
    bookish: 0.5,
  },
  favoriteRoomTypes: ['laboratory', 'library'],
  favoriteStationTypes: ['test_bench'],
  affinity: { char_0002: 3 },
  stats: {
    tasksCompleted: 12,
    sessionsParticipated: 5,
    errorsRecoveredFrom: 2,
    subagentsAccompanied: 1,
  },
  createdAt: '2026-09-03T21:00:00.000Z',
};

const assignment = {
  id: 'assign_0001',
  characterId: 'char_0001',
  workspaceId: 'ws_demo',
  sessionId: 'sess_0001',
  agentId: 'agent_0001',
  state: 'active',
  startedAt: '2026-09-03T21:00:00.000Z',
};

describe('WorkspaceSchema', () => {
  it('round-trips a valid workspace', () => {
    const parsed = parseWorkspace(workspace);
    expect(parsed.id).toBe('ws_demo');
    expect(parsed.folders).toHaveLength(1);
    expect(parsed.isDemo).toBe(false);
  });

  it('rejects wrong id prefixes and empty names', () => {
    expect(() => parseWorkspace({ ...workspace, id: 'ship_0001' })).toThrow();
    expect(() => parseWorkspace({ ...workspace, name: '' })).toThrow();
  });

  it('rejects workspaces with no authorized folders', () => {
    expect(() => parseWorkspace({ ...workspace, folders: [] })).toThrow();
  });

  it('serializes to JSON-stable output', () => {
    const parsed = parseWorkspace(workspace);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });
});

describe('ShipSchema', () => {
  it('accepts a metadata-level ship bound to a workspace', () => {
    const ship = ShipSchema.parse({
      id: 'ship_0001',
      workspaceId: 'ws_demo',
      name: 'Demo Ship',
      createdAt: '2026-09-03T21:00:00.000Z',
      updatedAt: '2026-09-03T21:00:00.000Z',
    });
    expect(ship.workspaceId).toBe('ws_demo');
  });

  it('rejects a ship whose id prefix is not ship_', () => {
    expect(() =>
      ShipSchema.parse({
        id: 'ws_demo',
        workspaceId: 'ws_demo',
        name: 'X',
        createdAt: '2026-09-03T21:00:00.000Z',
        updatedAt: '2026-09-03T21:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('CrewCharacterSchema', () => {
  it('round-trips a valid crew character', () => {
    const parsed = parseCrewCharacter(crew);
    expect(parsed.displayName).toBe('Nova');
    expect(parsed.personality.sociability).toBeCloseTo(0.6);
  });

  it('carries no provider/model/session identity fields', () => {
    const parsed = parseCrewCharacter(crew);
    const keys = Object.keys(parsed);
    for (const forbidden of ['provider', 'model', 'sessionId', 'agentId', 'harness']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('rejects out-of-range personality scores', () => {
    expect(() =>
      parseCrewCharacter({
        ...crew,
        personality: { ...crew.personality, sociability: 1.5 },
      }),
    ).toThrow();
  });

  it('rejects negative stats and bad id prefixes', () => {
    expect(() =>
      parseCrewCharacter({
        ...crew,
        stats: { ...crew.stats, tasksCompleted: -1 },
      }),
    ).toThrow();
    expect(() => parseCrewCharacter({ ...crew, id: 'guest_0001' })).toThrow();
  });
});

describe('GuestAgentSchema', () => {
  it('accepts a guest generated from a safe pool pack', () => {
    const guest = GuestAgentSchema.parse({
      id: 'guest_0001',
      generatedFromPackId: 'pack_guest_pool',
      createdFromAgentId: 'agent_0042',
      createdAt: '2026-09-03T21:00:00.000Z',
    });
    expect(guest.id).toBe('guest_0001');
  });

  it('rejects a guest id with the crew prefix', () => {
    expect(() =>
      GuestAgentSchema.parse({
        id: 'char_0009',
        generatedFromPackId: 'pack_guest_pool',
        createdFromAgentId: 'agent_0042',
        createdAt: '2026-09-03T21:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('AssignmentSchema', () => {
  it('round-trips a valid assignment', () => {
    const parsed = parseAssignment(assignment);
    expect(parsed.state).toBe('active');
    expect(parsed.releasedAt).toBeUndefined();
  });

  it('allows an optional taskId and released state with releasedAt', () => {
    const released = parseAssignment({
      ...assignment,
      taskId: 'task_0001',
      state: 'released',
      releasedAt: '2026-09-03T22:00:00.000Z',
    });
    expect(released.state).toBe('released');
  });

  it('rejects unknown assignment states', () => {
    expect(() => parseAssignment({ ...assignment, state: 'cancelled-by-moon' })).toThrow();
  });
});

describe('review hardening', () => {
  it('allows negative affinity (rivalry) within range and rejects extremes', () => {
    expect(() => parseCrewCharacter({ ...crew, affinity: { char_0002: -5 } })).not.toThrow();
    expect(() => parseCrewCharacter({ ...crew, affinity: { char_0002: -999 } })).toThrow();
  });

  it('rejects active assignments that already carry releasedAt', () => {
    expect(() =>
      parseAssignment({ ...assignment, releasedAt: '2026-09-03T21:30:00.000Z' }),
    ).toThrow(/releasedAt/);
  });

  it('exposes type guards for workspace/crew/assignment', () => {
    expect(isWorkspace(workspace)).toBe(true);
    expect(isWorkspace({ ...workspace, id: 'ship_1' })).toBe(false);
    expect(isCrewCharacter(crew)).toBe(true);
    expect(isAssignment(assignment)).toBe(true);
    expect(isAssignment(null)).toBe(false);
  });
});
