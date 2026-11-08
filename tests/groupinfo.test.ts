import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/core';
import { groupInfo, onThisDay, randomMessage } from '../src/ui/groupinfo';
import { fixture } from './helpers';

const chat = parseChat(fixture('android-en.txt'));

describe('groupInfo', () => {
  const info = groupInfo(chat);

  it('finds who created the group and every rename', () => {
    expect(info.created).toMatchObject({ actor: 'Deniz Kaya', value: 'Weekend Plans' });
    expect(info.renames.map(r => [r.value, r.actor])).toEqual([['Hiking Club', 'Deniz Kaya']]);
  });

  it('tells who is still in the group', () => {
    const status = Object.fromEntries(info.members.map(m => [m.name, m.inGroup]));
    expect(status).toMatchObject({ 'Mert Aydın': false, 'Can Öztürk': false, 'Elif Şahin': true, 'Ada Yılmaz': true });
    expect(info.members.at(-1)?.inGroup).toBe(false);
  });
});

describe('onThisDay', () => {
  it('finds the same date in earlier years', () => {
    expect(onThisDay(chat, new Date(2026, 9, 13))).toEqual([expect.objectContaining({ years: 1, count: 4 })]);
    expect(onThisDay(chat, new Date(2026, 9, 14))).toEqual([]);
  });
});

describe('randomMessage', () => {
  it('only picks what people wrote', () => {
    for (const r of [0, 0.3, 0.99]) expect(chat.messages[randomMessage(chat, () => r) ?? -1]?.sender).not.toBeNull();
  });
});
