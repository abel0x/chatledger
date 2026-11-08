import type { ChatEvent, Party } from '../core';
import { de } from './de';
import { en, type Dictionary, type Key } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { pt } from './pt';
import { tr } from './tr';

export type Lang = 'en' | 'de' | 'es' | 'fr' | 'it' | 'pt' | 'tr';
/** In the order their own names sort, as the language menu lists them. */
export const LANGS: readonly Lang[] = ['en', 'de', 'es', 'fr', 'it', 'pt', 'tr'];

export const DICTIONARIES: Record<Lang, Dictionary> = { en, de, es, fr, it, pt, tr };

export type Params = Record<string, string | number>;

/**
 * Locale used for dates and numbers. The browser's own region wins when it
 * speaks the same language, so a British English system keeps 24-hour time.
 */
export function formatLocale(lang: Lang, preferred: readonly string[] = []): string {
  return preferred.find(l => l.toLowerCase().split('-')[0] === lang) ?? lang;
}

export function translate(lang: Lang, key: Key, params: Params = {}, locale: string = lang): string {
  const entry = DICTIONARIES[lang][key];
  let template: string;
  if (typeof entry === 'string') template = entry;
  else {
    const count = Number(params.count ?? 0);
    template = new Intl.PluralRules(locale).select(count) === 'one' ? entry.one : entry.other;
  }
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
  });
}

/** Writes a chat event in the reader's language instead of the exporting phone's. */
export function describeEvent(event: ChatEvent, lang: Lang, selfName: string | null, locale: string = lang): string {
  if (event.type === 'unknown') return event.raw;
  const who = (p: Party) => ('self' in p ? (selfName ?? translate(lang, 'party.you')) : p.name);
  if (event.type === 'onlyAdminsSend' && !event.actor) return translate(lang, 'event.adminsOnly');
  const actor = event.actor ? who(event.actor) : translate(lang, 'party.someone');
  const targets = new Intl.ListFormat(locale, { type: 'conjunction' }).format((event.targets ?? []).map(who));
  return translate(lang, `event.${event.type}`, { actor, targets, value: event.value ?? '' }, locale);
}
