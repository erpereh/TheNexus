import { useEffect, useState } from 'react';
import { detectLocale, type AppLocale } from '@thenexus/i18n';
import { I18nProvider, useT } from './I18nProvider';
import { createDemoSession, WorldPanel, type DrawerTab } from '../world/WorldPanel';
import { useSessionPoll } from '../world/useSessionPoll';
import type { WorldSession } from '@thenexus/runtime';
import './app.css';

const TABS: readonly { id: DrawerTab; icon: string; labelKey: string }[] = [
  { id: 'home', icon: '⌂', labelKey: 'nav.home' },
  { id: 'agents', icon: '◉', labelKey: 'nav.agents' },
  { id: 'tasks', icon: '☰', labelKey: 'nav.tasks' },
  { id: 'settings', icon: '⚙', labelKey: 'nav.settings' },
];

export function App() {
  const [locale, setLocale] = useState<AppLocale>(() =>
    detectLocale(typeof navigator !== 'undefined' ? navigator.language : undefined),
  );
  return (
    <I18nProvider locale={locale}>
      <Shell locale={locale} onLocaleChange={setLocale} />
    </I18nProvider>
  );
}

function Shell({
  locale,
  onLocaleChange,
}: {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
}) {
  const t = useT();
  const [session] = useState<WorldSession>(() => createDemoSession());
  const [tab, setTab] = useState<DrawerTab>('home');
  const poll = useSessionPoll(session, 1000);
  const active = poll.started;
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>TheNexus</h1>
        </div>
        <nav aria-label={t('app.title')}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'nav-item nav-item-active' : 'nav-item'}
              aria-current={tab === item.id ? 'page' : undefined}
              data-testid={`nav-${item.id}`}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-projects">
          <p className="sidebar-heading">{t('nav.projects')}</p>
          <button
            type="button"
            className="nav-item nav-item-active"
            data-testid="nav-house"
            onClick={() => setTab('home')}
          >
            <span className="nav-icon" aria-hidden="true">
              ▦
            </span>
            <span className="nav-label">{t('nav.house')}</span>
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="status-card" data-testid="status-card">
            <p className="status-line">
              <span aria-hidden="true">{active ? '●' : '○'}</span> {t('world.characters')}:{' '}
              {poll.agentCount}
            </p>
            <p className="status-line">
              {t('world.sessions')}: {poll.sessionCount}
            </p>
            <p className="status-note">{t('status.local')}</p>
          </div>
          <div className="user-card">
            <span className="user-avatar" aria-hidden="true">
              ✦
            </span>
            <span className="user-meta">
              <strong>{t('status.role')}</strong>
              <small>{t('status.workspace')}</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-home" aria-hidden="true">
              ⌂
            </span>
            <strong>TheNexus</strong>
            <span className="topbar-status" data-testid="project-status">
              <span className={active ? 'dot dot-active' : 'dot'} aria-hidden="true">
                ●
              </span>{' '}
              {active ? t('topbar.projectActive') : t('topbar.projectIdle')}
            </span>
          </div>
          <p className="topbar-tagline">{t('topbar.tagline')} ✦</p>
          <div className="topbar-right">
            <span className="sim-pill" data-testid="sim-pill">
              {t('world.badgeShort')}
            </span>
            <Clock locale={locale} />
          </div>
        </header>
        <main className="world-main">
          <WorldPanel session={session} tab={tab} locale={locale} onLocaleChange={onLocaleChange} />
        </main>
      </div>
    </div>
  );
}

function Clock({ locale }: { locale: AppLocale }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const date = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return (
    <span className="clock" data-testid="clock">
      {date} · {time}
    </span>
  );
}
