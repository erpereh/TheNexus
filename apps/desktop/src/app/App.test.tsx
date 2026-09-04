import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('renders the product brand and the deterministic world surface', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TheNexus' })).toBeInTheDocument();
    expect(screen.getByTestId('world-panel')).toBeInTheDocument();
    // Honest simulator provenance: topbar pill + drawer badge.
    expect(screen.getByTestId('sim-pill')).toHaveTextContent(/SIMULATOR DATA/i);
    expect(screen.getByTestId('simulator-badge')).toHaveTextContent(/SIMULATOR DATA/i);
    expect(screen.getByTestId('world-start')).toBeInTheDocument();
    expect(screen.getByTestId('world-reset')).toBeInTheDocument();
    expect(screen.getByTestId('world-preset')).toBeInTheDocument();
  });

  it('renders the application chrome: nav, project status and clock', () => {
    render(<App />);
    expect(screen.getByTestId('nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('nav-agents')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tasks')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
    expect(screen.getByTestId('nav-house')).toBeInTheDocument();
    expect(screen.getByTestId('project-status')).toBeInTheDocument();
    expect(screen.getByTestId('status-card')).toBeInTheDocument();
    expect(screen.getByTestId('clock')).toBeInTheDocument();
  });
});
