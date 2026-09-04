import { SimulatorPanel } from '../dev/SimulatorPanel';
import { I18nProvider } from './I18nProvider';

const DEMO_OPTIONS = {
  seed: 42,
  workspaceId: 'ws_demo',
  agentCount: 3,
  eventsPerAgent: 12,
  startTime: '2026-09-03T21:00:00.000Z',
} as const;

export function App() {
  return (
    <I18nProvider>
      <main>
        <h1>TheNexus</h1>
        <SimulatorPanel options={DEMO_OPTIONS} />
      </main>
    </I18nProvider>
  );
}
