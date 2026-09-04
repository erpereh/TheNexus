import { useCallback, useMemo, useRef, useState } from 'react';
import type { NormalizedEvent, SemanticActivity } from '@thenexus/contracts';
import { createEventBus, type EventBus } from '@thenexus/bridge';
import { generateScenario, type SimulatorScenarioOptions } from '@thenexus/simulator';
import { useT } from '../app/I18nProvider';

interface AgentRow {
  agentId: string;
  sessionId: string;
  parentAgentId: string | null;
  activity: SemanticActivity;
  sequence: number;
}

interface SimulatorPanelProps {
  options: SimulatorScenarioOptions;
}

/**
 * Development vertical slice: proves the simulator -> event bus -> UI
 * contract flow without any real harness or network access.
 *
 * The displayed state is derived ONLY from events flowing through the
 * EventBus, never from the generated array directly, so the same state
 * projection can later be reused for real adapter streams.
 */
export function SimulatorPanel({ options }: SimulatorPanelProps) {
  const t = useT();
  const [agents, setAgents] = useState<Map<string, AgentRow>>(new Map());
  const [sessions, setSessions] = useState<Set<string>>(new Set());
  const [runCount, setRunCount] = useState(0);
  const busRef = useRef<EventBus | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const applyEvent = useCallback((event: NormalizedEvent) => {
    setAgents((previous) => {
      const next = new Map(previous);
      const existing = next.get(event.agentId);
      // Latest activity per agent wins; sequences guard late/out-of-order
      // arrivals even though the current bus is synchronous.
      if (existing && existing.sequence >= event.sequence) {
        return previous;
      }
      next.set(event.agentId, {
        agentId: event.agentId,
        sessionId: event.sessionId,
        parentAgentId: event.parentAgentId,
        activity: event.activity,
        sequence: event.sequence,
      });
      return next;
    });
    setSessions((previous) => {
      if (previous.has(event.sessionId)) return previous;
      const next = new Set(previous);
      next.add(event.sessionId);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    unsubscribeRef.current?.();
    const bus = createEventBus();
    busRef.current = bus;
    unsubscribeRef.current = bus.subscribe(applyEvent);
    // Generate strictly from the explicit local options; no network, no
    // provider, no persistent state.
    const events = generateScenario(options);
    for (const event of events) {
      bus.publish(event);
    }
    setRunCount((n) => n + 1);
  }, [applyEvent, options]);

  const handleReset = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    busRef.current = null;
    setAgents(new Map());
    setSessions(new Set());
  }, []);

  const agentRows = useMemo(() => [...agents.values()], [agents]);

  return (
    <section aria-label={t('simulator.panelLabel')} data-testid="simulator-panel">
      <header>
        <h2>{t('simulator.title')}</h2>
        <p data-testid="simulator-badge">{t('simulator.badge')}</p>
      </header>
      <dl>
        <div>
          <dt>{t('simulator.workspace')}</dt>
          <dd data-testid="simulator-workspace">{options.workspaceId}</dd>
        </div>
        <div>
          <dt>{t('simulator.sessions')}</dt>
          <dd data-testid="simulator-sessions">{sessions.size}</dd>
        </div>
        <div>
          <dt>{t('simulator.agents')}</dt>
          <dd data-testid="simulator-agent-count">{agents.size}</dd>
        </div>
        <div>
          <dt>{t('simulator.runs')}</dt>
          <dd data-testid="simulator-run-count">{runCount}</dd>
        </div>
      </dl>
      <div>
        <button type="button" onClick={handleStart}>
          {t('simulator.start')}
        </button>
        <button type="button" onClick={handleReset}>
          {t('simulator.reset')}
        </button>
      </div>
      <ul data-testid="simulator-agents">
        {agentRows.map((row) => (
          <li key={row.agentId} data-testid={`agent-${row.agentId}`}>
            <span className="agent-id">{row.agentId}</span>
            <span className="agent-activity">{row.activity}</span>
            <span className="agent-session">{row.sessionId}</span>
            {row.parentAgentId !== null ? (
              <span className="agent-parent">
                {t('simulator.subagentOf', { agentId: row.parentAgentId })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
