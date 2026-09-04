import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrewCharacter } from '@thenexus/contracts';
import { WorldSession } from '@thenexus/runtime';
import { I18nProvider } from '../app/I18nProvider';
import { WorldPanel } from './WorldPanel';

function crewMember(id: string, displayName: string): CrewCharacter {
  return {
    id,
    displayName,
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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderPanel(session: WorldSession): void {
  render(
    <I18nProvider locale="en">
      <WorldPanel session={session} />
    </I18nProvider>,
  );
}

describe('WorldPanel', () => {
  it('renders scenario and camera controls', () => {
    const session = new WorldSession({
      roster: [crewMember('char_0001', 'Nova'), crewMember('char_0002', 'Vega')],
    });
    renderPanel(session);
    expect(screen.getByTestId('world-preset')).toBeInTheDocument();
    expect(screen.getByTestId('world-start')).toBeInTheDocument();
    expect(screen.getByTestId('world-reset')).toBeInTheDocument();
    expect(screen.getByTestId('world-overview')).toBeInTheDocument();
    expect(screen.getByTestId('world-zoom-in')).toBeInTheDocument();
    expect(screen.getByTestId('world-follow')).toBeInTheDocument();
    session.dispose();
  });

  it('starts a headless session and polls the roster without a renderer', () => {
    const session = new WorldSession({
      roster: [crewMember('char_0001', 'Nova'), crewMember('char_0002', 'Vega')],
    });
    renderPanel(session);
    act(() => {
      fireEvent.click(screen.getByTestId('world-start'));
      session.advance(8000);
      vi.advanceTimersByTime(600);
    });
    // nested-subagents default preset drives 8 agents (2 crew + 6 guests).
    expect(screen.getByTestId('world-agent-w_agent_0001')).toBeInTheDocument();
    session.dispose();
  });

  it('selects a character and shows its mapping trace', () => {
    const session = new WorldSession({
      roster: [crewMember('char_0001', 'Nova'), crewMember('char_0002', 'Vega')],
    });
    renderPanel(session);
    act(() => {
      session.start('single-agent');
      session.advance(5000);
      vi.advanceTimersByTime(600);
    });
    const row = screen.getByTestId('world-agent-w_agent_0001');
    const activity = row.textContent?.split('·')[1]?.trim();
    expect(activity).toBeTruthy();
    act(() => {
      fireEvent.click(row);
    });
    const trace = screen.getByTestId('world-trace');
    // event -> activity -> rule -> room -> station -> animationIntent
    expect(trace.children.length).toBe(6);
    expect(trace.textContent).toContain('evt_');
    expect(trace.textContent).toContain('rule_');
    expect(trace.textContent).toContain(activity as string);
    session.dispose();
  });
});
