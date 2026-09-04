import {
  parseNormalizedEvent,
  type NormalizedEvent,
  type SemanticActivity,
} from '@thenexus/contracts';
import { createPrng, type Prng } from './prng';

export interface SimulatorScenarioOptions {
  seed: number;
  workspaceId: string;
  agentCount: number;
  eventsPerAgent: number;
  startTime: string;
}

/**
 * Generates one synthetic agent's activity plan using state-aware
 * transitions (not independent random labels). Every plan ends in either
 * `completed` or a deliberately configured `error` terminal.
 */
function planAgentActivities(
  prng: Prng,
  hasSubagents: boolean,
  failsAtEnd: boolean,
): SemanticActivity[] {
  const plan: SemanticActivity[] = ['idle', 'planning', 'reading', 'coding'];
  if (hasSubagents) {
    plan.push('delegating', 'spawning-subagent');
  }
  if (prng() < 0.6) {
    plan.push('researching');
  }
  plan.push('testing', 'building', 'reviewing', 'version-control');
  if (prng() < 0.35) {
    plan.push('waiting-user');
  }
  plan.push('communicating');
  plan.push(failsAtEnd ? 'error' : 'completed');
  return plan;
}

/**
 * Builds a deterministic provider-neutral scenario.
 *
 * Properties guaranteed by construction and tested:
 * - same seed + options -> byte-for-byte identical event array;
 * - every event parses through the canonical NormalizedEvent schema;
 * - per-session sequences are strictly increasing in stream order;
 * - event IDs are globally unique;
 * - standard scenarios cover the baseline activity vocabulary;
 * - agents end in `completed` or (deliberately) `error`;
 * - subagents share their parent's session and reference it via
 *   `parentAgentId`, and their parents emit `spawning-subagent`.
 */
export function generateScenario(options: SimulatorScenarioOptions): NormalizedEvent[] {
  const { seed, workspaceId, agentCount, eventsPerAgent, startTime } = options;
  if (!Number.isInteger(agentCount) || agentCount < 1) {
    throw new Error('agentCount must be a positive integer');
  }
  if (!Number.isInteger(eventsPerAgent) || eventsPerAgent < 2) {
    throw new Error('eventsPerAgent must be an integer >= 2');
  }
  const startMs = Date.parse(startTime);
  if (Number.isNaN(startMs)) {
    throw new Error(`startTime is not an ISO datetime: ${startTime}`);
  }

  const prng = createPrng(seed);

  interface AgentPlan {
    id: string;
    sessionId: string;
    parentAgentId: string | null;
    activities: SemanticActivity[];
  }

  const plans: AgentPlan[] = [];
  // agentCount is the TOTAL agent population, roots plus subagents, so the
  // 10/50/100/250 scale scenarios produce exactly that many distinct agents.
  for (let i = 0; plans.length < agentCount; i++) {
    const agentId = `agent_${String(i + 1).padStart(4, '0')}`;
    const sessionId = `sess_${String(i + 1).padStart(4, '0')}`;
    // ~15% of agents deliberately take the error path; the standard
    // scenario (seed fixed in tests) still ends most agents `completed`.
    const failsAtEnd = agentCount >= 6 && prng() < 0.15;
    const roomForSubagents = agentCount - plans.length - 1 > 0;
    // Guarantee at least one parent/subagent relationship when the fleet has
    // room for it, so nested-agent scenarios always exist (plan requirement).
    const hasSubagents = roomForSubagents && (i === 0 || (agentCount > 1 && prng() < 0.4));
    const activities = planAgentActivities(prng, hasSubagents, failsAtEnd);
    plans.push({
      id: agentId,
      sessionId,
      parentAgentId: null,
      activities,
    });
    if (hasSubagents) {
      const maxSubagents = Math.min(2, agentCount - plans.length);
      const count = 1 + Math.floor(prng() * maxSubagents);
      for (let s = 0; s < count && plans.length < agentCount; s++) {
        const subId = `${agentId}_sub${s + 1}`;
        const subActivities = planAgentActivities(prng, false, failsAtEnd && prng() < 0.5);
        plans.push({
          id: subId,
          sessionId,
          parentAgentId: agentId,
          activities: subActivities,
        });
      }
    }
  }

  // Guarantee error-path coverage: any scenario with enough agents ends its
  // final agent in `error`, so error handling is always exercisable.
  if (agentCount >= 6) {
    const last = plans[plans.length - 1];
    if (last && last.activities[last.activities.length - 1] === 'completed') {
      last.activities[last.activities.length - 1] = 'error';
    }
  }

  // Trim each plan to eventsPerAgent while preserving a valid terminal so
  // large fleets remain cheap to generate.
  for (const plan of plans) {
    if (plan.activities.length > eventsPerAgent) {
      const terminal = plan.activities[plan.activities.length - 1] as SemanticActivity;
      plan.activities = [...plan.activities.slice(0, eventsPerAgent - 1), terminal];
    }
  }

  // Interleave deterministically: agent i event k lands at a fixed offset.
  interface TimedEvent {
    plan: AgentPlan;
    activity: SemanticActivity;
    atMs: number;
  }
  const timed: TimedEvent[] = [];
  for (const plan of plans) {
    const agentIndex = Number(plan.id.split('_')[1]);
    const agentOffsetMs = ((agentIndex - 1) * 137) % 60000;
    plan.activities.forEach((activity, k) => {
      timed.push({
        plan,
        activity,
        atMs: startMs + agentOffsetMs + k * 1000,
      });
    });
  }

  timed.sort((a, b) => {
    if (a.atMs !== b.atMs) return a.atMs - b.atMs;
    if (a.plan.id !== b.plan.id) return a.plan.id < b.plan.id ? -1 : 1;
    return 0;
  });

  const sequences = new Map<string, number>();
  const events: NormalizedEvent[] = timed.map((item, index) => {
    const sequence = (sequences.get(item.plan.sessionId) ?? 0) + 1;
    sequences.set(item.plan.sessionId, sequence);
    return parseNormalizedEvent({
      schemaVersion: 1,
      eventId: `evt_${String(index + 1).padStart(6, '0')}`,
      workspaceId,
      sessionId: item.plan.sessionId,
      agentId: item.plan.id,
      parentAgentId: item.plan.parentAgentId,
      sequence,
      occurredAt: new Date(item.atMs).toISOString(),
      kind: 'activity.changed',
      activity: item.activity,
      source: { adapterId: 'simulator', provider: 'simulator' },
      metadata: {},
    });
  });

  return events;
}

/**
 * Raw, intentionally-malformed payloads for testing consumer robustness.
 * The simulator can inject these into a stream so the bridge/UI/world are
 * proven to survive unknown future kinds and corrupted shapes without
 * crashing. These objects are NOT valid NormalizedEvents by design.
 */
export function generateMalformedFixture(count: number, seed: number): unknown[] {
  const prng = createPrng(seed ^ 0x5eed);
  const samples: unknown[] = [
    { kind: 'totally.unknown.future_kind' },
    { schemaVersion: 2, eventId: 'evt_future' },
    { eventId: '', kind: 'activity.changed' },
    { eventId: 'evt_null', kind: 'activity.changed', activity: null },
    { eventId: 'evt_seq', kind: 'activity.changed', sequence: 'one' },
    'not even an object',
    42,
    null,
    { eventId: 'evt_bad_time', occurredAt: 'not-a-date', kind: 'activity.changed' },
    { eventId: 'evt_deep', kind: 'activity.changed', metadata: { nested: { a: 1 } } },
  ];
  const out: unknown[] = [];
  for (let i = 0; i < count; i++) {
    out.push(samples[Math.floor(prng() * samples.length)]);
  }
  return out;
}

export type ScenarioPresetName =
  | 'single-agent'
  | 'nested-subagents'
  | 'error-path'
  | 'malformed'
  | 'agents-10'
  | 'agents-50'
  | 'agents-100'
  | 'agents-250';

const PRESET_DEFAULTS: Record<ScenarioPresetName, SimulatorScenarioOptions> = {
  'single-agent': {
    seed: 101,
    workspaceId: 'ws_single',
    agentCount: 1,
    eventsPerAgent: 12,
    startTime: '2026-09-03T21:00:00.000Z',
  },
  'nested-subagents': {
    seed: 202,
    workspaceId: 'ws_nested',
    agentCount: 8,
    eventsPerAgent: 12,
    startTime: '2026-09-03T21:00:00.000Z',
  },
  'error-path': {
    seed: 303,
    workspaceId: 'ws_errors',
    agentCount: 6,
    eventsPerAgent: 12,
    startTime: '2026-09-03T21:00:00.000Z',
  },
  malformed: {
    seed: 404,
    workspaceId: 'ws_malformed',
    agentCount: 2,
    eventsPerAgent: 6,
    startTime: '2026-09-03T21:00:00.000Z',
  },
  'agents-10': {
    seed: 1001,
    workspaceId: 'ws_scale10',
    agentCount: 10,
    eventsPerAgent: 6,
    startTime: '2026-09-03T21:00:00.000Z',
  },
  'agents-50': {
    seed: 1002,
    workspaceId: 'ws_scale50',
    agentCount: 50,
    eventsPerAgent: 6,
    startTime: '2026-09-03T21:00:00.000Z',
  },
  'agents-100': {
    seed: 1003,
    workspaceId: 'ws_scale100',
    agentCount: 100,
    eventsPerAgent: 6,
    startTime: '2026-09-03T21:00:00.000Z',
  },
  'agents-250': {
    seed: 1004,
    workspaceId: 'ws_scale250',
    agentCount: 250,
    eventsPerAgent: 6,
    startTime: '2026-09-03T21:00:00.000Z',
  },
};

/**
 * Named scenario presets (design spec §17): onboarding, demos, stress and
 * robustness tests all use these instead of ad-hoc option objects. All
 * preset values are fixed constants, so presets are deterministic; callers
 * may still override individual options explicitly.
 */
export function createScenarioPreset(
  name: ScenarioPresetName,
  overrides: Partial<SimulatorScenarioOptions> = {},
): SimulatorScenarioOptions {
  const defaults = PRESET_DEFAULTS[name];
  return { ...defaults, ...overrides };
}
