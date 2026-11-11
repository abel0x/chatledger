import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '../src/core';
import { en, type Key } from '../src/i18n/en';
import { describeEvent, DICTIONARIES, formatLocale, LANGS, translate } from '../src/i18n/translate';

const placeholders = (value: string | { one: string; other: string }) =>
  [...new Set((typeof value === 'string' ? value : value.one + value.other).match(/\{\w+\}/g) ?? [])].sort();

describe('dictionaries', () => {
  it('use the same placeholders in every language', () => {
    for (const lang of LANGS) {
      for (const key of Object.keys(en) as Key[]) {
        expect(placeholders(DICTIONARIES[lang][key]), `${lang} ${key}`).toEqual(placeholders(en[key]));
      }
    }
  });

  it('are all translated, not copied from English', () => {
    for (const lang of LANGS.filter(l => l !== 'en')) {
      const same = (Object.keys(en) as Key[]).filter(k => JSON.stringify(DICTIONARIES[lang][k]) === JSON.stringify(en[k]));
      // Single words ("Video", "message") can be the same in another language; whole sentences never are.
      expect(same.filter(k => typeof en[k] === 'string' && (en[k] as string).split(' ').length >= 3), lang).toEqual([]);
    }
  });

  it('keep French punctuation on the same line as the word before it', () => {
    expect(translate('fr', 'lock.forgot')).toBe('Mot de passe oublié\u202f?');
    expect(translate('fr', 'msg.view', { what: 'Photo' })).toBe('Ouvrir\u202f: Photo');
    expect(describeEvent({ type: 'renamed', actor: { name: 'Ada' }, value: 'Rando', raw: '' }, 'fr', null)).toBe(
      'Ada a renommé le groupe en «\u202fRando\u202f»',
    );
    for (const key of Object.keys(en) as Key[]) {
      const text = translate('fr', key, { count: 2 });
      expect(text, key).not.toMatch(/ [?!:;»]|« /);
    }
    // Names and other filled-in values are left exactly as they are.
    expect(translate('fr', 'msg.forwarded', { name: 'Radio : Info' })).toBe('Transféré de Radio : Info');
  });

  it('plural forms work with each language’s own rules', () => {
    expect(translate('fr', 'chat.messages', { count: 0 })).toBe('0 message');
    expect(translate('de', 'chat.messages', { count: 1200 })).toBe('1.200 Nachrichten');
    expect(translate('es', 'chat.people', { count: 1 })).toBe('1 persona');
  });
});

describe('translate', () => {
  it('fills in placeholders and picks plural forms', () => {
    expect(translate('en', 'chat.people', { count: 1 })).toBe('1 person');
    expect(translate('en', 'chat.people', { count: 1200 })).toBe('1,200 people');
    expect(translate('tr', 'chat.messages', { count: 1200 })).toBe('1.200 mesaj');
  });

  it('keeps the region the browser asks for', () => {
    expect(formatLocale('en', ['en-GB', 'tr-TR'])).toBe('en-GB');
    expect(formatLocale('tr', ['en-GB', 'tr-TR'])).toBe('tr-TR');
    expect(formatLocale('tr', ['de-DE'])).toBe('tr');
  });
});

describe('describeEvent', () => {
  const added: ChatEvent = {
    type: 'added',
    actor: { name: 'Deniz Kaya' },
    targets: [{ self: true }, { name: 'Mert Aydın' }, { name: 'Elif Şahin' }],
    raw: 'Deniz Kaya added you, Mert Aydın and Elif Şahin',
  };

  it('writes the event in the reader’s language', () => {
    expect(describeEvent(added, 'en', 'Ada Yılmaz')).toBe('Deniz Kaya added Ada Yılmaz, Mert Aydın, and Elif Şahin');
    expect(describeEvent(added, 'tr', null)).toBe('Deniz Kaya gruba ekledi: Siz, Mert Aydın ve Elif Şahin');
  });

  it('copes with events that name nobody', () => {
    expect(describeEvent({ type: 'onlyAdminsSend', raw: 'Only admins can message this group' }, 'en', null)).toBe(
      'Only admins can send messages to this group',
    );
    expect(describeEvent({ type: 'unknown', raw: 'Something new' }, 'tr', null)).toBe('Something new');
  });
});
