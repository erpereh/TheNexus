import { I18nProvider } from './I18nProvider';
import { WorldPanel } from '../world/WorldPanel';
import './app.css';

export function App() {
  return (
    <I18nProvider>
      <main>
        <h1>TheNexus</h1>
        <WorldPanel />
      </main>
    </I18nProvider>
  );
}
