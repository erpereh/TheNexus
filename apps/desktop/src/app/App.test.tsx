import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('renders the product brand and the simulator development surface', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TheNexus' })).toBeInTheDocument();
    expect(screen.getByTestId('simulator-panel')).toBeInTheDocument();
    expect(screen.getByText(/SIMULATOR DATA/i)).toBeInTheDocument();
  });
});
