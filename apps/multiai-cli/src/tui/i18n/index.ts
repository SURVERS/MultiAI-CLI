import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const TuiLanguageValues = ['en', 'ru'] as const;

export type TuiLanguage = (typeof TuiLanguageValues)[number];

function loadInitialLanguage(): TuiLanguage {
  if (
    process.env['VITEST'] !== undefined ||
    process.env['NODE_ENV'] === 'test' ||
    process.argv.some((argument) => argument.toLowerCase().includes('vitest'))
  ) return 'en';
  try {
    const dataDir = process.env['MULTIAI_HOME'] || join(homedir(), '.multiai');
    const config = readFileSync(join(dataDir, 'tui.toml'), 'utf-8');
    return /^language\s*=\s*"ru"\s*(?:#.*)?$/m.test(config) ? 'ru' : 'en';
  } catch {
    return 'en';
  }
}

let currentLanguage: TuiLanguage = loadInitialLanguage();

export function setTuiLanguage(language: TuiLanguage): void {
  currentLanguage = language;
}

export function getTuiLanguage(): TuiLanguage {
  return currentLanguage;
}

export function t(english: string, russian: string): string {
  return currentLanguage === 'ru' ? russian : english;
}

export function formatTuiLanguage(language: TuiLanguage): string {
  return language === 'ru' ? 'Русский' : 'English';
}
