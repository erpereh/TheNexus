import i18next, { type i18n as I18nInstance } from 'i18next';
import en from './locales/en.json';
import es from './locales/es.json';

/** Supported product locales: English base, Spanish ships in v1. */
export const APP_LOCALES = ['en', 'es'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

const RESOURCES: Record<AppLocale, { translation: typeof en }> = {
  en: { translation: en },
  es: { translation: es },
};

/**
 * Detects the app locale from a BCP-47 language tag (e.g. `es-MX`).
 * Unsupported languages fall back to English. When no tag is available
 * (tests, restricted environments) the default locale wins.
 */
export function detectLocale(language?: string): AppLocale {
  if (!language) return DEFAULT_LOCALE;
  const normalized = language.toLowerCase().replace('_', '-');
  if (normalized === 'es' || normalized.startsWith('es-')) return 'es';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return DEFAULT_LOCALE;
}

function buildInstance(locale: AppLocale): I18nInstance {
  const instance = i18next.createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    resources: RESOURCES,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

/**
 * Creates an initialized i18next instance for the requested locale.
 * Each call returns an independent instance so hosts (desktop UI, tests,
 * tutorial flows) cannot leak language state into each other.
 */
export async function createI18n(locale: AppLocale = DEFAULT_LOCALE): Promise<I18nInstance> {
  return buildInstance(locale);
}

/**
 * Returns a ready-to-translate instance synchronously. With inline
 * resources i18next completes its translation setup during init, so the
 * returned instance resolves `t()` immediately (verified by tests).
 */
export function createI18nSync(locale: AppLocale = DEFAULT_LOCALE): I18nInstance {
  return buildInstance(locale);
}

/** Recursively flattens nested translation JSON into dotted key paths. */
export function flattenKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...flattenKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}
