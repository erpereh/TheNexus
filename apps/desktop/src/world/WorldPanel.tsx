import { useEffect, useRef, useState } from 'react';
import type { CrewCharacter, SemanticActivity } from '@thenexus/contracts';
import { WorldSession, type ScenarioPresetName } from '@thenexus/runtime';
import type { WorldRenderer } from '@thenexus/world-engine';
import { useT } from '../app/I18nProvider';
import { WorldCanvas } from './WorldCanvas';

const CREW_NAMES = [
  'Nova',
  'Vega',
  'Lyra',
  'Orion',
  'Mira',
  'Altair',
  'Rigel',
  'Cassia',
  'Draco',
  'Selene',
  'Atlas',
  'Juno',
];

function devCrewMember(index: number): CrewCharacter {
  const n = String(index + 1).padStart(4, '0');
  return {
    id: `char_${n}`,
    displayName: CREW_NAMES[index % CREW_NAMES.length] ?? `Crew ${n}`,
    packId: null,
    role: 'Specialist',
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

const PRESETS: readonly ScenarioPresetName[] = [
  'single-agent',
  'nested-subagents',
  'error-path',
  'agents-10',
  'agents-50',
  'agents-100',
  'agents-250',
];

interface PanelAgent {
  worldId: string;
  label: string;
  activity: SemanticActivity;
  room: string;
  station: string;
  statusSymbol: string;
  isGuest: boolean;
}

interface PanelState {
  started: boolean;
  tick: number;
  agentCount: number;
  sessionCount: number;
  agents: PanelAgent[];
  perf: { fps: number; p50: number; p95: number } | null;
}

function statusSymbol(activity: SemanticActivity, waiting: boolean): string {
  if (activity === 'error') return '✕';
  if (activity === 'completed') return '★';
  if (activity === 'waiting-user' || waiting) return '❚❚';
  return '●';
}

/**
 * Developer/demo world surface. The PixiJS world dominates; this panel owns
 * scenario controls (start/reset/preset), camera controls (overview, zoom,
 * follow), the character roster, the selected-agent mapping trace and dev
 * performance metrics. All world state is polled at 2Hz — never at frame
 * rate — while the canvas renders smoothly underneath.
 */
export function WorldPanel() {
  const t = useT();
  const [session] = useState(
    () => new WorldSession({ roster: CREW_NAMES.map((_, i) => devCrewMember(i)) }),
  );
  const [preset, setPreset] = useState<ScenarioPresetName>('nested-subagents');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [panel, setPanel] = useState<PanelState>({
    started: false,
    tick: 0,
    agentCount: 0,
    sessionCount: 0,
    agents: [],
    perf: null,
  });
  const rendererRef = useRef<WorldRenderer | null>(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const live = sessionRef.current;
      const snap = live.snapshot();
      const agents: PanelAgent[] = snap.world.characters.map((c) => {
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
      const perf = rendererRef.current?.perfSnapshot() ?? null;
      setPanel({
        started: snap.world.characters.length > 0 || snap.simTimeMs > 0,
        tick: snap.tick,
        agentCount: snap.counts.agents,
        sessionCount: snap.counts.sessions,
        agents,
        perf: perf === null ? null : { fps: perf.fps, p50: perf.frameP50Ms, p95: perf.frameP95Ms },
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Keep camera follow glued to the current selection while enabled.
  useEffect(() => {
    sessionRef.current.followWorldId = following ? selectedId : null;
  }, [following, selectedId]);

  return (
    <section aria-label={t('world.panelLabel')} data-testid="world-panel">
      <header>
        <h2>{t('world.title')}</h2>
        <p data-testid="simulator-badge">{t('world.badge')}</p>
      </header>
      <div className="world-layout">
        <WorldCanvas
          session={session}
          selectedId={selectedId}
          onSelect={setSelectedId}
          rendererRef={rendererRef}
        />
        <aside className="world-side">
          <div>
            <label htmlFor="world-preset">{t('world.scenario')}</label>
            <select
              id="world-preset"
              data-testid="world-preset"
              value={preset}
              onChange={(event) => setPreset(event.target.value as ScenarioPresetName)}
            >
              {PRESETS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="world-start"
              onClick={() => {
                session.start(preset);
                setSelectedId(null);
              }}
            >
              {t('world.start')}
            </button>
            <button type="button" data-testid="world-reset" onClick={() => session.reset()}>
              {t('world.reset')}
            </button>
          </div>
          <div>
            <button type="button" data-testid="world-overview" onClick={() => session.frameShip()}>
              {t('world.overview')}
            </button>
            <button
              type="button"
              data-testid="world-zoom-in"
              onClick={() =>
                session.zoomAt({ x: 640, y: 400 }, session.camera.zoom * 1.25, {
                  width: 1280,
                  height: 800,
                })
              }
            >
              {t('world.zoomIn')}
            </button>
            <button
              type="button"
              data-testid="world-zoom-out"
              onClick={() =>
                session.zoomAt({ x: 640, y: 400 }, session.camera.zoom / 1.25, {
                  width: 1280,
                  height: 800,
                })
              }
            >
              {t('world.zoomOut')}
            </button>
            <button
              type="button"
              data-testid="world-follow"
              disabled={selectedId === null}
              onClick={() => setFollowing((f) => !f)}
            >
              {following ? t('world.unfollow') : t('world.follow')}
            </button>
          </div>
          <WorldRoster panel={panel} selectedId={selectedId} onSelect={setSelectedId} />
          <WorldSelection session={session} selectedId={selectedId} />
          <WorldPerf panel={panel} />
        </aside>
      </div>
    </section>
  );
}

function WorldRoster({
  panel,
  selectedId,
  onSelect,
}: {
  panel: PanelState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useT();
  return (
    <div>
      <h3>
        {t('world.characters')} ({panel.agentCount})
      </h3>
      <ul data-testid="world-agents">
        {panel.agents.map((agent) => (
          <li key={agent.worldId}>
            <button
              type="button"
              data-testid={`world-agent-${agent.worldId}`}
              aria-pressed={selectedId === agent.worldId}
              onClick={() => onSelect(selectedId === agent.worldId ? null : agent.worldId)}
            >
              <span aria-hidden="true">{agent.statusSymbol}</span> {agent.label} · {agent.activity}{' '}
              · {agent.room}
              {agent.isGuest ? ` · ${t('world.guest')}` : ''}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorldSelection({
  session,
  selectedId,
}: {
  session: WorldSession;
  selectedId: string | null;
}) {
  const t = useT();
  if (selectedId === null) return <p data-testid="world-selection">{t('world.noSelection')}</p>;
  const snap = session.snapshot();
  const info = snap.presentation.get(selectedId);
  const trace = snap.traces.get(selectedId);
  if (info === undefined || trace === undefined)
    return <p data-testid="world-selection">{t('world.noSelection')}</p>;
  const rerouted =
    trace.destinationStationId !== null && trace.destinationStationId !== trace.stationInstanceId;
  return (
    <div data-testid="world-selection">
      <h3>{info.label}</h3>
      <dl>
        <div>
          <dt>{t('world.activity')}</dt>
          <dd>{trace.activity}</dd>
        </div>
        <div>
          <dt>{t('world.room')}</dt>
          <dd>
            {trace.roomType} ({trace.roomInstanceId ?? '—'})
          </dd>
        </div>
        <div>
          <dt>{t('world.station')}</dt>
          <dd>
            {trace.stationType} ({trace.stationInstanceId ?? '—'})
          </dd>
        </div>
        {rerouted ? (
          <div>
            <dt>{t('world.destination')}</dt>
            <dd>{trace.destinationStationId}</dd>
          </div>
        ) : null}
      </dl>
      <h4>{t('world.mappingTrace')}</h4>
      <ol data-testid="world-trace">
        <li>{trace.eventId}</li>
        <li>{trace.activity}</li>
        <li>{trace.ruleId ?? '—'}</li>
        <li>{trace.roomType}</li>
        <li>{trace.stationType}</li>
        <li>{trace.animationIntent}</li>
      </ol>
      {trace.fallbackSteps.length > 0 ? <p>{trace.fallbackSteps.join(' · ')}</p> : null}
      {trace.diagnostic !== null ? <p>{trace.diagnostic}</p> : null}
    </div>
  );
}

function WorldPerf({ panel }: { panel: PanelState }) {
  const t = useT();
  return (
    <div data-testid="world-perf">
      <h3>{t('world.perf')}</h3>
      <dl>
        <div>
          <dt>{t('world.tick')}</dt>
          <dd>{panel.tick}</dd>
        </div>
        <div>
          <dt>{t('world.sessions')}</dt>
          <dd>{panel.sessionCount}</dd>
        </div>
        {panel.perf !== null ? (
          <>
            <div>
              <dt>{t('world.fps')}</dt>
              <dd>{panel.perf.fps.toFixed(0)}</dd>
            </div>
            <div>
              <dt>{t('world.p50')}</dt>
              <dd>{panel.perf.p50.toFixed(2)} ms</dd>
            </div>
            <div>
              <dt>{t('world.p95')}</dt>
              <dd>{panel.perf.p95.toFixed(2)} ms</dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
