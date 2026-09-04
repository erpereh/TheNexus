import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('renders the product brand and the deterministic world surface', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TheNexus' })).toBeInTheDocument();
    expect(screen.getByTestId('world-panel')).toBeInTheDocument();
    expect(screen.getByText(/SIMULATOR DATA/i)).toBeInTheDocument();
    expect(screen.getByTestId('world-start')).toBeInTheDocument();
    expect(screen.getByTestId('world-reset')).toBeInTheDocument();
    expect(screen.getByTestId('world-preset')).toBeInTheDocument();
  });
});
