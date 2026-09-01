import { createI18n } from 'vue-i18n';
import { messages } from './locales';
import { safeGetString, safeSetString, STORAGE_KEYS } from '../lib/storage';

export const availableLocales = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
] as const;

export type LocaleCode = (typeof availableLocales)[number]['code'];

function detect(): LocaleCode {
  const stored = safeGetString(STORAGE_KEYS.locale);
  if (stored === 'en' || stored === 'ru') return stored;
  return globalThis.navigator?.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export const i18n = createI18n({
  legacy: false,
  locale: detect(),
  fallbackLocale: 'en',
  messages,
});

export function setLocale(l: LocaleCode): void {
  i18n.global.locale.value = l;
  safeSetString(STORAGE_KEYS.locale, l);
}

export default i18n;
