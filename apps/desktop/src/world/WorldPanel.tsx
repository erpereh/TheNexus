import { useEffect, useMemo, useRef, useState } from 'react';
import type { CrewCharacter } from '@thenexus/contracts';
import type { AppLocale } from '@thenexus/i18n';
import { WorldSession, type ScenarioPresetName } from '@thenexus/runtime';
import type { WorldRenderer } from '@thenexus/world-engine/render';
import { useT } from '../app/I18nProvider';
import { WorldCanvas } from './WorldCanvas';
import { useSessionPoll } from './useSessionPoll';

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

/** Standard 12-member demo crew for the project house. */
export function createDemoSession(): WorldSession {
  return new WorldSession({ roster: CREW_NAMES.map((_, i) => devCrewMember(i)) });
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

export type DrawerTab = 'home' | 'agents' | 'tasks' | 'settings';

/** roomInstanceId -> rooms.* i18n key for the in-world floor labels. */
const ROOM_I18N_KEY: Readonly<Record<string, string>> = {
  room_command: 'planning',
  room_engineering: 'development',
  room_observatory: 'research',
  room_library: 'library',
  room_laboratory: 'testing',
  room_communications: 'communications',
  room_archive: 'archive',
  room_lounge: 'lounge',
};

interface WorldPanelProps {
  session?: WorldSession;
  tab?: DrawerTab;
  locale?: AppLocale;
  onLocaleChange?: (locale: AppLocale) => void;
}

/**
 * Project-house world surface. The PixiJS canvas dominates; floating
 * overlays carry the selected agent and camera controls, while the drawer
 * switches between scenario (home), roster (agents), timeline (tasks) and
 * app settings. All world state is polled at 2Hz — never at frame rate —
 * while the canvas renders smoothly underneath.
 *
 * Accepts an optional prebuilt session (test seam); otherwise creates the
 * standard 12-member demo crew.
 */
export function WorldPanel({
  session: sessionProp,
  tab = 'home',
  locale,
  onLocaleChange,
}: WorldPanelProps) {
  const t = useT();
  const [session] = useState(() => sessionProp ?? createDemoSession());
  const [preset, setPreset] = useState<ScenarioPresetName>('nested-subagents');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [perf, setPerf] = useState<{ fps: number; p50: number; p95: number } | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const sessionRef = useRef(session);
  const poll = useSessionPoll(session);

  useEffect(() => {
    sessionRef.current = session;
  });

  // Renderer perf is read on the same 2Hz cadence as the session poll.
  useEffect(() => {
    const timer = setInterval(() => {
      const snapshot = rendererRef.current?.perfSnapshot() ?? null;
      setPerf(
        snapshot === null
          ? null
          : { fps: snapshot.fps, p50: snapshot.frameP50Ms, p95: snapshot.frameP95Ms },
      );
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Keep camera follow glued to the current selection while enabled.
  useEffect(() => {
    sessionRef.current.followWorldId = following ? selectedId : null;
  }, [following, selectedId]);

  const roomLabels = useMemo(() => {
    const labels: Record<string, { title: string; subtitle: string }> = {};
    for (const [roomId, key] of Object.entries(ROOM_I18N_KEY)) {
      labels[roomId] = {
        title: t(`rooms.${key}.title`),
        subtitle: t(`rooms.${key}.subtitle`),
      };
    }
    return labels;
  }, [t]);

  const selected =
    selectedId === null ? null : (poll.agents.find((a) => a.worldId === selectedId) ?? null);

  return (
    <section className="world" aria-label={t('world.panelLabel')} data-testid="world-panel">
      <div className="world-stage">
        <WorldCanvas
          session={session}
          selectedId={selectedId}
          onSelect={setSelectedId}
          rendererRef={rendererRef}
          roomLabels={roomLabels}
        />
        {selected !== null ? (
          <button
            type="button"
            className="world-selected-card"
            data-testid="world-selected-card"
            onClick={() => setSelectedId(null)}
            title={t('world.noSelection')}
          >
            <span aria-hidden="true">{selected.statusSymbol}</span>
            <strong>{selected.label}</strong>
            <span>
              {selected.activity} · {selected.room}
            </span>
          </button>
        ) : null}
        <div className="world-camera" role="toolbar" aria-label={t('world.camera')}>
          <button
            type="button"
            data-testid="world-overview"
            onClick={() => {
              const size = rendererRef.current?.viewportSize();
              if (size !== undefined) session.frameShip(size);
              else session.frameShip();
            }}
          >
            {t('world.overview')}
          </button>
          <button
            type="button"
            data-testid="world-zoom-in"
            onClick={() => {
              const size = rendererRef.current?.viewportSize() ?? { width: 1280, height: 800 };
              session.zoomAt(
                { x: size.width / 2, y: size.height / 2 },
                session.camera.zoom * 1.25,
                size,
              );
            }}
          >
            {t('world.zoomIn')}
          </button>
          <button
            type="button"
            data-testid="world-zoom-out"
            onClick={() => {
              const size = rendererRef.current?.viewportSize() ?? { width: 1280, height: 800 };
              session.zoomAt(
                { x: size.width / 2, y: size.height / 2 },
                session.camera.zoom / 1.25,
                size,
              );
            }}
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
      </div>
      <aside className="world-drawer">
        <div hidden={tab !== 'home'}>
          <div className="drawer-section">
            <h2>{t('world.title')}</h2>
            <p className="drawer-badge" data-testid="simulator-badge">
              {t('world.badge')}
            </p>
          </div>
          <div className="drawer-section">
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
            <div className="button-row">
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
          </div>
          <WorldPerf tick={poll.tick} sessionCount={poll.sessionCount} perf={perf} />
        </div>
        <div hidden={tab !== 'agents'}>
          <WorldRoster poll={poll} selectedId={selectedId} onSelect={setSelectedId} />
          <WorldSelection session={session} selectedId={selectedId} />
        </div>
        <div hidden={tab !== 'tasks'}>
          <WorldTasks poll={poll} />
        </div>
        <div hidden={tab !== 'settings'}>
          <WorldSettings locale={locale} onLocaleChange={onLocaleChange} />
        </div>
      </aside>
    </section>
  );
}

function WorldRoster({
  poll,
  selectedId,
  onSelect,
}: {
  poll: ReturnType<typeof useSessionPoll>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useT();
  return (
    <div className="drawer-section">
      <h3>
        {t('world.characters')} ({poll.agentCount})
      </h3>
      <ul data-testid="world-agents">
        {poll.agents.map((agent) => (
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
  if (selectedId === null)
    return (
      <div className="drawer-section">
        <h3>{t('world.selected')}</h3>
        <p data-testid="world-selection">{t('world.noSelection')}</p>
      </div>
    );
  const snap = session.snapshot();
  const info = snap.presentation.get(selectedId);
  const trace = snap.traces.get(selectedId);
  if (info === undefined || trace === undefined)
    return (
      <div className="drawer-section">
        <h3>{t('world.selected')}</h3>
        <p data-testid="world-selection">{t('world.noSelection')}</p>
      </div>
    );
  const rerouted =
    trace.destinationStationId !== null && trace.destinationStationId !== trace.stationInstanceId;
  return (
    <div className="drawer-section" data-testid="world-selection">
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

function WorldTasks({ poll }: { poll: ReturnType<typeof useSessionPoll> }) {
  const t = useT();
  return (
    <div className="drawer-section" data-testid="world-tasks">
      <h3>{t('tasks.title')}</h3>
      <p>
        {t('world.sessions')}: {poll.sessionCount} · {t('world.tick')}: {poll.tick}
      </p>
      {poll.recent.length === 0 ? (
        <p>{t('tasks.empty')}</p>
      ) : (
        <>
          <h4>{t('tasks.recent')}</h4>
          <ol data-testid="world-recent">
            {poll.recent.map((event) => (
              <li key={event.eventId}>
                {event.activity} · {event.ruleId ?? '—'} · {event.roomType} → {event.stationType}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function WorldSettings({
  locale,
  onLocaleChange,
}: {
  locale: AppLocale | undefined;
  onLocaleChange: ((locale: AppLocale) => void) | undefined;
}) {
  const t = useT();
  return (
    <div className="drawer-section">
      <h3>{t('settings.title')}</h3>
      <h4>{t('settings.language')}</h4>
      <p>{t('settings.languageHint')}</p>
      {onLocaleChange === undefined ? (
        <p>{locale ?? 'en'}</p>
      ) : (
        <div className="button-row">
          <button
            type="button"
            data-testid="world-lang-en"
            aria-pressed={locale === 'en'}
            onClick={() => onLocaleChange('en')}
          >
            English
          </button>
          <button
            type="button"
            data-testid="world-lang-es"
            aria-pressed={locale === 'es'}
            onClick={() => onLocaleChange('es')}
          >
            Español
          </button>
        </div>
      )}
      <h4>{t('settings.renderer')}</h4>
      <p>{t('settings.rendererValue')}</p>
      <h4>{t('settings.about')}</h4>
      <p>{t('settings.aboutText')}</p>
    </div>
  );
}

function WorldPerf({
  tick,
  sessionCount,
  perf,
}: {
  tick: number;
  sessionCount: number;
  perf: { fps: number; p50: number; p95: number } | null;
}) {
  const t = useT();
  return (
    <div className="drawer-section" data-testid="world-perf">
      <h3>{t('world.perf')}</h3>
      <dl>
        <div>
          <dt>{t('world.tick')}</dt>
          <dd>{tick}</dd>
        </div>
        <div>
          <dt>{t('world.sessions')}</dt>
          <dd>{sessionCount}</dd>
        </div>
        {perf !== null ? (
          <>
            <div>
              <dt>{t('world.fps')}</dt>
              <dd>{perf.fps.toFixed(0)}</dd>
            </div>
            <div>
              <dt>{t('world.p50')}</dt>
              <dd>{perf.p50.toFixed(2)} ms</dd>
            </div>
            <div>
              <dt>{t('world.p95')}</dt>
              <dd>{perf.p95.toFixed(2)} ms</dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
