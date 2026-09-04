import type {
  CrewCharacter,
  MappingRule,
  NormalizedEvent,
  SemanticActivity,
  ThemeManifest,
} from '@thenexus/contracts';
import { DEFAULT_THEME } from '@thenexus/asset-system';
import { createEventBus, type EventBus } from '@thenexus/bridge';
import { createMappingEngine, DEFAULT_MAPPING_RULES, type MappingEngine } from '@thenexus/mapping';
import {
  assignAgent,
  createCrewRoster,
  releaseAssignment,
  type CrewRoster,
} from '@thenexus/crew-simulation';
import {
  createScenarioPreset,
  generateScenario,
  type ScenarioPresetName,
  type SimulatorScenarioOptions,
} from '@thenexus/simulator';
import {
  Camera,
  findPathToTarget,
  TICK_MS,
  WorldSim,
  type Cell,
  type GridPoint,
  type Viewport,
  type WorldSnapshot,
} from '@thenexus/world-engine/core';
import type { CharacterPresentation } from '@thenexus/world-engine/core';
import { buildDemoShip, type DemoShip } from './demo-ship';

/**
 * Deterministic local runtime session: the provider-neutral pipeline
 *
 * ```text
 * simulator scenario → EventBus → MappingEngine → crew assignment
 *   → A* (approach cells) → WorldSim → snapshot + presentation + trace
 * ```
 *
 * Identity model: simulator `agentId`s are ephemeral; each one is bound to
 * one persistent crew character (or a Guest fallback) and to exactly one
 * world character `w_<agentId>`. Subagents sharing a parent `sessionId`
 * still get separate world characters. Terminal `completed`/`error` events
 * release the crew assignment (the character stays visible with its final
 * activity) so later agents can reuse crew deterministically.
 *
 * Time model: scenario `occurredAt` timestamps drive a due-queue against
 * `simTimeMs`; identical `advance()` chunkings reach identical states.
 */

export type ScenarioInput = ScenarioPresetName | SimulatorScenarioOptions;

export interface WorldSessionOptions {
  /** Persistent crew available for assignment (empty → all Guests). */
  roster: readonly CrewCharacter[];
  rules?: readonly MappingRule[];
  theme?: ThemeManifest;
}

export interface AgentTrace {
  agentId: string;
  worldId: string;
  eventId: string;
  activity: SemanticActivity;
  ruleId: string | null;
  roomType: string;
  roomInstanceId: string | null;
  stationType: string;
  stationInstanceId: string | null;
  animationIntent: string;
  fallbackSteps: readonly string[];
  diagnostic: string | null;
  /**
   * Station the character was actually routed to. Equals
   * `stationInstanceId` when the mapping choice was reachable; a generic
   * fallback (or null when holding) otherwise.
   */
  destinationStationId: string | null;
}

export interface SessionSnapshot {
  tick: number;
  simTimeMs: number;
  world: WorldSnapshot;
  presentation: Map<string, CharacterPresentation>;
  traces: Map<string, AgentTrace>;
  /** Every processed event resolution in order (debugger timeline). */
  history: readonly AgentTrace[];
  counts: { agents: number; sessions: number; assignments: number; guests: number };
}

interface AgentEntry {
  agentId: string;
  sessionId: string;
  worldId: string;
  assignmentId: string;
  characterId: string | null;
  guestId: string | null;
  label: string;
  isGuest: boolean;
}

function worldIdFor(agentId: string): string {
  return `w_${agentId}`;
}

export class WorldSession {
  readonly ship: DemoShip;
  readonly camera: Camera;
  readonly theme: ThemeManifest;
  followWorldId: string | null = null;

  private readonly engine: MappingEngine;
  private readonly initialCrew: readonly CrewCharacter[];
  private readonly genericStationIds: readonly string[];
  private readonly stationFootprints = new Map<string, readonly Cell[]>();

  private sim: WorldSim;
  private bus: EventBus | null = null;
  private unsubscribers: readonly (() => void)[] = [];
  private roster: CrewRoster;
  private agents = new Map<string, AgentEntry>();
  private sessions = new Set<string>();
  private presentation = new Map<string, CharacterPresentation>();
  private traces = new Map<string, AgentTrace>();
  private history: AgentTrace[] = [];
  private queue: NormalizedEvent[] = [];
  private scenarioInput: ScenarioInput | null = null;
  private scenarioStartMs = 0;
  private simTimeMs = 0;
  private timeRemainderMs = 0;
  private spawnCursor = 0;
  /** Last live viewport seen (mount fit, pan or zoom); reused by start/reset. */
  private lastViewport: Viewport = { width: 1280, height: 800 };
  private listenerErrors: readonly { error: unknown; eventId: string }[] = [];

  constructor(opts: WorldSessionOptions) {
    this.theme = opts.theme ?? DEFAULT_THEME;
    this.ship = buildDemoShip(this.theme);
    this.engine = createMappingEngine(opts.rules ?? DEFAULT_MAPPING_RULES);
    this.initialCrew = opts.roster;
    this.roster = createCrewRoster(opts.roster);
    this.sim = new WorldSim(this.ship.grid);
    for (const station of this.ship.stations) {
      this.stationFootprints.set(station.stationInstanceId, station.footprint);
    }
    this.genericStationIds = this.ship.stations
      .filter((s) => s.stationType === 'generic_workstation')
      .map((s) => s.stationInstanceId)
      .sort();
    this.camera = new Camera({ x: 20, y: 14 }, 1);
    this.camera.setShipBounds({ ...this.ship.bounds });
    this.frameShip();
  }

  /** Number of live bus subscriptions (0 after `dispose`). */
  get activeSubscriptions(): number {
    return this.unsubscribers.length;
  }

  /** Listener errors captured from the bus boundary sink (HUD/debug aid). */
  get errors(): readonly { error: unknown; eventId: string }[] {
    return this.listenerErrors;
  }

  start(input: ScenarioInput): void {
    this.dispose();
    this.scenarioInput = input;
    const options: SimulatorScenarioOptions =
      typeof input === 'string' ? createScenarioPreset(input) : input;
    const events = generateScenario(options);
    // Fail fast on capacity: every agent needs a distinct spawn cell, so an
    // oversized scenario must surface here, not as listener errors mid-run.
    const agentIds = new Set(events.map((event) => event.agentId));
    if (agentIds.size > this.ship.spawnCells.length) {
      throw new Error(
        `scenario needs ${agentIds.size} spawn cells but the demo ship has ${this.ship.spawnCells.length}`,
      );
    }
    this.queue = [...events].sort((a, b) =>
      a.occurredAt < b.occurredAt
        ? -1
        : a.occurredAt > b.occurredAt
          ? 1
          : a.eventId < b.eventId
            ? -1
            : 1,
    );
    const first = this.queue[0];
    this.scenarioStartMs = first !== undefined ? Date.parse(first.occurredAt) : 0;
    this.simTimeMs = 0;
    this.timeRemainderMs = 0;
    this.sim = new WorldSim(this.ship.grid);
    this.roster = createCrewRoster(this.initialCrew);
    this.agents = new Map();
    this.sessions = new Set();
    this.presentation = new Map();
    this.traces = new Map();
    this.history = [];
    this.spawnCursor = 0;
    this.listenerErrors = [];
    const bus = createEventBus({
      onListenerError: (error, event) => {
        this.listenerErrors = [...this.listenerErrors, { error, eventId: event.eventId }];
      },
    });
    this.bus = bus;
    const unsubscribe = bus.subscribe((event) => {
      this.processEvent(event);
    });
    this.unsubscribers = [unsubscribe];
    this.frameShip(this.lastViewport);
  }

  /** Rebuilds from the same scenario input: byte-identical re-runs. */
  reset(): void {
    if (this.scenarioInput === null) return;
    this.followWorldId = null;
    this.start(this.scenarioInput);
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    if (this.bus !== null) {
      this.bus.clear();
      this.bus = null;
    }
    this.queue = [];
  }

  /** Advances scenario time, routes due events, then ticks the world. */
  advance(dtMs: number): void {
    if (!(dtMs > 0) || this.bus === null) return;
    // Session-owned accumulator with tick-quantized event processing: each
    // 100ms quantum processes its tick window of events and then runs
    // exactly one sim tick. Any chunking with the same total (10×100ms,
    // 1×1000ms, 60fps fractions) yields identical quanta and interleaving.
    // The sim is ticked directly so its own accumulator never diverges.
    this.timeRemainderMs += dtMs;
    while (this.timeRemainderMs >= TICK_MS) {
      this.timeRemainderMs -= TICK_MS;
      this.simTimeMs += TICK_MS;
      this.processDue();
      this.sim.tick();
    }
    if (this.followWorldId !== null) {
      const followed = this.sim.getCharacter(this.followWorldId);
      if (followed !== undefined) {
        this.camera.followTo({ x: followed.cell.x + 0.5, y: followed.cell.y + 0.5 }, dtMs);
      }
    }
  }

  private processDue(): void {
    const horizon = this.scenarioStartMs + this.simTimeMs;
    while (this.queue.length > 0) {
      const head = this.queue[0] as NormalizedEvent;
      if (Date.parse(head.occurredAt) > horizon) break;
      this.queue.shift();
      const bus = this.bus;
      if (bus !== null) bus.publish(head);
    }
  }

  snapshot(options: { history?: boolean } = {}): SessionSnapshot {
    const world = this.sim.snapshot();
    const waitingById = new Map(world.characters.map((c) => [c.id, c.waiting] as const));
    const presentation = new Map<string, CharacterPresentation>();
    for (const [worldId, info] of this.presentation) {
      presentation.set(worldId, { ...info, waiting: waitingById.get(worldId) ?? info.waiting });
    }
    // The per-frame render path passes `{ history: false }`: history grows
    // with every event and must not be cloned at 60Hz.
    const includeHistory = options.history ?? true;
    return {
      tick: world.tick,
      simTimeMs: this.simTimeMs,
      world,
      presentation,
      traces: new Map(this.traces),
      history: includeHistory ? [...this.history] : [],
      counts: {
        agents: this.agents.size,
        sessions: this.sessions.size,
        assignments: this.roster.assignments.length,
        guests: this.roster.guests.length,
      },
    };
  }

  /** Frames the whole ship (overview) for the given canvas size. */
  frameShip(viewport: Viewport = { width: 1280, height: 800 }): void {
    this.lastViewport = { ...viewport };
    const points: GridPoint[] = this.ship.spawnCells.map((cell) => ({ x: cell.x, y: cell.y }));
    this.camera.frameCells(points, viewport);
  }

  panBy(dxScreen: number, dyScreen: number, viewport: Viewport): void {
    this.lastViewport = { ...viewport };
    this.camera.panBy(dxScreen, dyScreen, viewport);
  }

  zoomAt(screenPoint: { x: number; y: number }, nextZoom: number, viewport: Viewport): void {
    this.lastViewport = { ...viewport };
    this.camera.zoomAt(screenPoint, nextZoom, viewport);
  }

  private processEvent(event: NormalizedEvent): void {
    let entry = this.agents.get(event.agentId);
    if (entry === undefined) {
      entry = this.spawnAgent(event);
      this.agents.set(event.agentId, entry);
    }
    this.sessions.add(event.sessionId);
    const character = this.sim.getCharacter(entry.worldId);
    if (character === undefined) return;
    const resolution = this.engine.resolve(event, this.ship.mappingLayout, {
      col: character.cell.x,
      row: character.cell.y,
    });
    const routing = this.routeToResolution(
      entry.worldId,
      character.cell,
      resolution.stationInstanceId,
    );
    this.presentation.set(entry.worldId, {
      id: entry.worldId,
      label: entry.label,
      activity: event.activity,
      animationIntent: resolution.animationIntent,
      statusDisplay: resolution.statusDisplay,
      effectIntent: resolution.effectIntent,
      waiting: character.waiting,
      isGuest: entry.isGuest,
    });
    const trace: AgentTrace = {
      agentId: event.agentId,
      worldId: entry.worldId,
      eventId: event.eventId,
      activity: event.activity,
      ruleId: resolution.ruleId,
      roomType: resolution.roomType,
      roomInstanceId: resolution.roomInstanceId,
      stationType: resolution.stationType,
      stationInstanceId: resolution.stationInstanceId,
      animationIntent: resolution.animationIntent,
      fallbackSteps: [...resolution.fallbackSteps, ...routing.steps],
      diagnostic: resolution.diagnostic,
      destinationStationId: routing.destination,
    };
    this.traces.set(entry.worldId, trace);
    this.history.push(trace);
    if (event.activity === 'completed' || event.activity === 'error') {
      this.roster = releaseAssignment(this.roster, entry.assignmentId, event.occurredAt);
    }
  }

  private spawnAgent(event: NormalizedEvent): AgentEntry {
    const result = assignAgent(
      this.roster,
      { workspaceId: event.workspaceId, sessionId: event.sessionId, agentId: event.agentId },
      event.occurredAt,
    );
    this.roster = result.roster;
    const worldId = worldIdFor(event.agentId);
    const cell = this.nextSpawnCell();
    this.sim.spawn(worldId, cell);
    const characterId = result.assignment.characterId;
    const guest = result.guest;
    if (guest !== undefined) {
      // Label from the stable guest id (`guest_0007` -> `Guest 7`) so numbers
      // are never reused after a guest converts or releases.
      const guestNumber = Number.parseInt(guest.id.replace(/^guest_0*/, ''), 10);
      return {
        agentId: event.agentId,
        sessionId: event.sessionId,
        worldId,
        assignmentId: result.assignment.assignmentId,
        characterId: null,
        guestId: guest.id,
        label: `Guest ${Number.isNaN(guestNumber) ? guest.id : guestNumber}`,
        isGuest: true,
      };
    }
    const member = this.roster.crew.find((c) => c.id === characterId);
    return {
      agentId: event.agentId,
      sessionId: event.sessionId,
      worldId,
      assignmentId: result.assignment.assignmentId,
      characterId,
      guestId: null,
      label: member?.displayName ?? worldId,
      isGuest: false,
    };
  }

  private nextSpawnCell(): Cell {
    for (let i = 0; i < this.ship.spawnCells.length; i++) {
      const index = (this.spawnCursor + i) % this.ship.spawnCells.length;
      const cell = this.ship.spawnCells[index] as Cell;
      if (this.sim.characterAt(cell) === undefined) {
        this.spawnCursor = (index + 1) % this.ship.spawnCells.length;
        return { ...cell };
      }
    }
    throw new Error('demo ship has no free spawn cell left');
  }

  private routeToResolution(
    worldId: string,
    from: Cell,
    stationInstanceId: string | null,
  ): { destination: string | null; steps: string[] } {
    const candidates: { id: string; footprint: readonly Cell[] }[] = [];
    if (stationInstanceId !== null) {
      const footprint = this.stationFootprints.get(stationInstanceId);
      if (footprint !== undefined) candidates.push({ id: stationInstanceId, footprint });
    }
    for (const genericId of this.genericStationIds) {
      if (genericId === stationInstanceId) continue;
      const footprint = this.stationFootprints.get(genericId);
      if (footprint !== undefined) candidates.push({ id: genericId, footprint });
    }
    for (const candidate of candidates) {
      const path = findPathToTarget(this.ship.grid, from, candidate.footprint);
      if (path.status === 'OK') {
        this.sim.assignPath(worldId, path.path);
        if (candidate.id === stationInstanceId) return { destination: candidate.id, steps: [] };
        return {
          destination: candidate.id,
          steps: [`station-unreachable:${stationInstanceId ?? 'none'}`, `rerouted:${candidate.id}`],
        };
      }
    }
    // No reachable station: stop in place (single-cell path) so the
    // character does not keep walking a stale route. Activity is kept.
    const holder = this.sim.getCharacter(worldId);
    if (holder !== undefined && holder.pathIndex < holder.path.length - 1) {
      this.sim.assignPath(worldId, [{ ...holder.cell }]);
    }
    return { destination: null, steps: ['no-reachable-station:holding-position'] };
  }
}
