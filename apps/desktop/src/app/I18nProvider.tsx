import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import { createI18nSync, detectLocale, DEFAULT_LOCALE, type AppLocale } from '@thenexus/i18n';

const I18nContext = createContext<I18nInstance | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  /** Testing/preview override; defaults to detected system locale. */
  locale?: AppLocale;
}

/**
 * Hosts the shared i18next instance. The instance is created eagerly with
 * inline resources, so translation is available on the very first render
 * and no raw key can flash in the UI.
 */
export function I18nProvider({ children, locale }: I18nProviderProps) {
  const instance = useMemo<I18nInstance>(
    () =>
      createI18nSync(
        locale ?? detectLocale(typeof navigator !== 'undefined' ? navigator.language : undefined),
      ),
    [locale],
  );
  return <I18nContext.Provider value={instance}>{children}</I18nContext.Provider>;
}

/** Returns the bound translation function for the active locale. */
export function useT(): I18nInstance['t'] {
  const instance = useContext(I18nContext);
  if (!instance) {
    throw new Error('useT must be used inside I18nProvider');
  }
  return instance.t.bind(instance);
}

export { DEFAULT_LOCALE };
