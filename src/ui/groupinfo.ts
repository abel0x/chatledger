import type { Chat, Party } from '../core';

export interface Member {
  /** Display name; null stands for the person who exported the chat when their name is unknown. */
  name: string | null;
  person: number | null;
  inGroup: boolean;
  messages: number;
}

export interface Rename {
  index: number;
  time: number;
  value: string;
  previous: string | null;
  actor: string | null;
}

export interface GroupInfo {
  created: { index: number; time: number; actor: string | null; value: string | null } | null;
  renames: Rename[];
  members: Member[];
}

export function groupInfo(chat: Chat): GroupInfo {
  const nameOf = (p: Party | undefined): string | null => (!p ? null : 'self' in p ? chat.self : p.name);
  const status = new Map<string | null, boolean>();
  const counts = new Map<number, number>();
  let created: GroupInfo['created'] = null;
  const renames: Rename[] = [];

  chat.messages.forEach((m, index) => {
    if (m.sender != null) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
    const ev = m.event;
    if (!ev) return;
    switch (ev.type) {
      case 'created':
        created ??= { index, time: m.time, actor: nameOf(ev.actor), value: ev.value ?? null };
        break;
      case 'renamed':
        if (ev.value) renames.push({ index, time: m.time, value: ev.value, previous: ev.previous ?? null, actor: nameOf(ev.actor) });
        break;
      case 'added':
        for (const p of ev.targets ?? []) status.set(nameOf(p), true);
        break;
      case 'joined':
        status.set(nameOf(ev.actor), true);
        break;
      case 'left':
        status.set(nameOf(ev.actor), false);
        break;
      case 'removed':
        for (const p of ev.targets ?? []) status.set(nameOf(p), false);
        break;
    }
  });

  const members = new Map<string | null, Member>();
  chat.people.forEach((name, person) => {
    members.set(name, { name, person, inGroup: status.get(name) ?? true, messages: counts.get(person) ?? 0 });
  });
  for (const [name, inGroup] of status) {
    if (!members.has(name)) members.set(name, { name, person: null, inGroup, messages: 0 });
  }

  return {
    created,
    renames: renames.reverse(),
    members: [...members.values()].sort((a, b) => Number(b.inGroup) - Number(a.inGroup) || b.messages - a.messages),
  };
}

export interface PastDay {
  years: number;
  day: number;
  count: number;
  /** First message of that day. */
  index: number;
}

/** The same calendar day in earlier years, most recent first. */
export function onThisDay(chat: Chat, today: Date): PastDay[] {
  const byDay = new Map<number, { count: number; index: number }>();
  chat.messages.forEach((m, index) => {
    if (m.sender == null) return;
    const day = Math.floor(m.time / 86400);
    const entry = byDay.get(day);
    if (entry) entry.count++;
    else byDay.set(day, { count: 1, index });
  });
  const out: PastDay[] = [];
  for (let years = 1; years <= 30; years++) {
    const day = Math.floor(Date.UTC(today.getFullYear() - years, today.getMonth(), today.getDate()) / 86400000);
    const entry = byDay.get(day);
    if (entry) out.push({ years, day, ...entry });
  }
  return out;
}

/** A message someone wrote, picked at random; null when there is none. */
export function randomMessage(chat: Chat, random: () => number = Math.random): number | null {
  const candidates: number[] = [];
  chat.messages.forEach((m, i) => {
    if (m.sender != null && (m.kind === 'text' || m.kind === 'file' || m.kind === 'poll')) candidates.push(i);
  });
  return candidates.length ? (candidates[Math.floor(random() * candidates.length)] ?? null) : null;
}
