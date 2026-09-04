import { describe, expect, it } from 'vitest';
import { APP_LOCALES, createI18n, createI18nSync, detectLocale, flattenKeys } from './index';
import en from './locales/en.json';
import es from './locales/es.json';

describe('locale resources', () => {
  it('every locale shares the exact same key set as English', () => {
    const enKeys = flattenKeys(en).sort();
    const esKeys = flattenKeys(es).sort();
    expect(esKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('declares exactly the supported locales', () => {
    expect(APP_LOCALES).toEqual(['en', 'es']);
  });
});

describe('createI18n', () => {
  it('translates in the requested locale', async () => {
    const en = await createI18n('en');
    expect(en.t('app.title')).toBe('TheNexus');
    const es = await createI18n('es');
    expect(es.t('app.title')).toBe('TheNexus');
    expect(es.t('simulator.badge')).not.toBe(en.t('simulator.badge'));
  });

  it('falls back to English for missing keys without throwing', async () => {
    const es = await createI18n('es');
    expect(es.t('simulator.badge')).toBeTypeOf('string');
    expect(es.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('detects locale from navigator language', () => {
    expect(detectLocale('es-ES')).toBe('es');
    expect(detectLocale('es_MX')).toBe('es');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('de-DE')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
});

describe('createI18nSync', () => {
  it('returns a ready-to-use instance synchronously', () => {
    const instance = createI18nSync('es');
    expect(instance.t('simulator.workspace')).toBe('Espacio de trabajo');
    expect(instance.language).toBe('es');
  });
});
