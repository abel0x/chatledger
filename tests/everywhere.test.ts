import { describe, expect, it } from 'vitest';
import type { Chat, Message } from '../src/core';
import { Everywhere, HITS_PER_CHAT, type ChatHits } from '../src/loader/everywhere';

function chat(title: string, texts: string[]): Chat {
  const messages: Message[] = texts.map((text, i) => ({ id: `${title}-${i}`, time: 1_700_000_000 + i * 60, sender: i % 2, kind: 'text', text }));
  return { title, platform: 'android', locale: 'en', self: null, people: ['Ada', 'Mert'], messages, warnings: [] };
}

const CHATS: Record<string, Chat> = {
  hikers: chat('Hikers', ['Meet at the station', 'Bring water', 'The station is closed', 'See you at the lake']),
  family: chat('Family', ['Dinner at eight', 'Who brings water?']),
  work: chat('Work', Array.from({ length: 12 }, (_, i) => `Report number ${i}`)),
};

function setup() {
  const loads: string[] = [];
  const everywhere = new Everywhere(async id => {
    loads.push(id);
    const found = CHATS[id];
    if (!found) throw new Error('missing');
    return found;
  });
  const run = async (query: string, ids = Object.keys(CHATS)) => {
    const out: ChatHits[] = [];
    const finished = await everywhere.search(query, ids, hits => out.push(hits));
    return { out, finished };
  };
  return { everywhere, loads, run };
}

describe('Everywhere', () => {
  it('finds a word in every saved chat, in the order the chats were given', async () => {
    const { run } = setup();
    const { out, finished } = await run('WATER');
    expect(finished).toBe(true);
    expect(out.map(c => [c.title, c.total, c.hits.map(m => m.text)])).toEqual([
      ['Hikers', 1, ['Bring water']],
      ['Family', 1, ['Who brings water?']],
    ]);
  });

  it('keeps only the newest matches of a chat, newest first, and counts them all', async () => {
    const { run } = setup();
    const [work] = (await run('report')).out;
    expect(work?.total).toBe(12);
    expect(work?.hits).toHaveLength(HITS_PER_CHAT);
    expect(work?.hits[0]?.text).toBe('Report number 11');
  });

  it('reads each chat once, however many searches follow', async () => {
    const { run, loads } = setup();
    await run('station');
    await run('lake');
    expect(loads.sort()).toEqual(['family', 'hikers', 'work']);
  });

  it('leaves out a chat that cannot be read', async () => {
    const { run } = setup();
    const { out } = await run('water', ['gone', 'family']);
    expect(out.map(c => c.id)).toEqual(['family']);
  });

  it('reads nothing for an empty search', async () => {
    const { run, loads } = setup();
    expect((await run('  "" ')).out).toEqual([]);
    expect(loads).toEqual([]);
  });

  it('stops an older search when a newer one starts', async () => {
    const { everywhere } = setup();
    const older: string[] = [];
    const first = everywhere.search('water', Object.keys(CHATS), hits => older.push(hits.id));
    const second = everywhere.search('dinner', Object.keys(CHATS), () => {});
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(older).toEqual([]);
  });

  it('forgets chats that are no longer saved', async () => {
    const { run, loads } = setup();
    await run('water');
    await run('water', ['family']);
    await run('water');
    expect(loads.filter(id => id === 'hikers')).toHaveLength(2);
  });
});
