import type { ChatEvent } from '../core';
import { readSetting, writeSetting } from '../ui/settings';
import type { Key } from './en';
import { describeEvent, formatLocale, LANGS, translate, type Lang, type Params } from './translate';

export { LANGS, type Lang };

function browserLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : navigator.languages;
}

function initialLang(): Lang {
  const saved = readSetting('lang');
  if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  for (const l of browserLanguages()) {
    const base = l.toLowerCase().split('-')[0];
    if ((LANGS as readonly string[]).includes(base ?? '')) return base as Lang;
  }
  return 'en';
}

const state = $state({ lang: initialLang() });

export function lang(): Lang {
  return state.lang;
}

export function locale(): string {
  return formatLocale(state.lang, browserLanguages());
}

export function setLang(next: Lang): void {
  state.lang = next;
  document.documentElement.lang = next;
  writeSetting('lang', next);
}

export function t(key: Key, params?: Params): string {
  return translate(state.lang, key, params, locale());
}

export function eventText(event: ChatEvent, selfName: string | null): string {
  return describeEvent(event, state.lang, selfName, locale());
}
