import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '../src/core';
import { en, type Key } from '../src/i18n/en';
import { tr } from '../src/i18n/tr';
import { describeEvent, formatLocale, translate } from '../src/i18n/translate';

const placeholders = (value: string | { one: string; other: string }) =>
  [...new Set((typeof value === 'string' ? value : value.one + value.other).match(/\{\w+\}/g) ?? [])].sort();

describe('dictionaries', () => {
  it('use the same placeholders in every language', () => {
    for (const key of Object.keys(en) as Key[]) {
      expect(placeholders(tr[key]), key).toEqual(placeholders(en[key]));
    }
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
