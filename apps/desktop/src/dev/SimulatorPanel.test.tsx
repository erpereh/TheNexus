import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { generateScenario } from '@thenexus/simulator';
import { SimulatorPanel } from './SimulatorPanel';
import { I18nProvider } from '../app/I18nProvider';

afterEach(cleanup);

const options = {
  seed: 42,
  workspaceId: 'ws_demo',
  agentCount: 3,
  eventsPerAgent: 12,
  startTime: '2026-09-03T21:00:00.000Z',
} as const;

describe('SimulatorPanel', () => {
  it('shows the SIMULATOR DATA indicator before any run', () => {
    render(
      <I18nProvider>
        <SimulatorPanel options={options} />
      </I18nProvider>,
    );
    expect(screen.getByText(/SIMULATOR DATA/i)).toBeInTheDocument();
  });

  it('renders three distinct agents with their latest activity after Start', () => {
    render(
      <I18nProvider>
        <SimulatorPanel options={options} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    const events = generateScenario(options);
    const latest = new Map<string, string>();
    for (const event of events) {
      latest.set(event.agentId, event.activity);
    }
    expect(latest.size).toBe(3);

    for (const [agentId, activity] of latest) {
      expect(screen.getByTestId(`agent-${agentId}`)).toHaveTextContent(agentId);
      expect(screen.getByTestId(`agent-${agentId}`)).toHaveTextContent(activity);
    }
  });

  it('shows the workspace and session summary', () => {
    render(
      <I18nProvider>
        <SimulatorPanel options={options} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    const events = generateScenario(options);
    const sessions = new Set(events.map((e) => e.sessionId));
    expect(screen.getByTestId('simulator-workspace')).toHaveTextContent('ws_demo');
    expect(screen.getByTestId('simulator-sessions')).toHaveTextContent(String(sessions.size));
  });

  it('clears displayed agents on Reset', () => {
    render(
      <I18nProvider>
        <SimulatorPanel options={options} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(screen.getByTestId('agent-agent_0001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.queryByTestId('agent-agent_0001')).not.toBeInTheDocument();
  });
});
