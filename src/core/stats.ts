import type { Chat } from './model';

export interface PersonStats {
  person: number;
  messages: number;
  words: number;
  media: number;
  /** Messages sent between midnight and 5 a.m. */
  night: number;
}

export interface ChatStats {
  /** Messages people sent; system lines are not counted. */
  messages: number;
  first: number;
  last: number;
  activeDays: number;
  spanDays: number;
  /** Everyone who sent something, busiest first. */
  people: PersonStats[];
  /** Messages by weekday (Monday first) and hour: index = weekday * 24 + hour. */
  heat: number[];
  /** Every month from the first message to the last, empty ones included. */
  months: { month: number; count: number }[];
  busiestDay: { day: number; count: number } | null;
  longestStreak: { start: number; days: number } | null;
  longestSilence: { from: number; to: number } | null;
  emojis: { emoji: string; count: number }[];
  media: number;
  links: number;
  deleted: number;
  edited: number;
  polls: number;
}

const DAY = 86400;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const VARIATION = /️/g;
const LINK = /\b(?:https?:\/\/|www\.)\S/i;

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function countEmojis(text: string, into: Map<string, { emoji: string; count: number }>): void {
  if (!EMOJI.test(text)) return;
  const parts = segmenter ? Array.from(segmenter.segment(text), s => s.segment) : Array.from(text);
  for (const part of parts) {
    if (!EMOJI.test(part)) continue;
    const key = part.replace(VARIATION, '');
    const entry = into.get(key);
    if (entry) entry.count++;
    else into.set(key, { emoji: part, count: 1 });
  }
}

function monthOf(time: number): number {
  const d = new Date(time * 1000);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

export function chatStats(chat: Chat, topEmojis = 24): ChatStats {
  const people = chat.people.map((_, person): PersonStats => ({ person, messages: 0, words: 0, media: 0, night: 0 }));
  const heat = new Array<number>(7 * 24).fill(0);
  const perDay = new Map<number, number>();
  const perMonth = new Map<number, number>();
  const emojis = new Map<string, { emoji: string; count: number }>();
  let messages = 0;
  let media = 0;
  let links = 0;
  let deleted = 0;
  let edited = 0;
  let polls = 0;
  let first = Infinity;
  let last = -Infinity;
  let prevTime: number | null = null;
  let longestSilence: ChatStats['longestSilence'] = null;

  for (const m of chat.messages) {
    if (m.sender == null) continue;
    messages++;
    first = Math.min(first, m.time);
    last = Math.max(last, m.time);
    if (prevTime != null && (!longestSilence || m.time - prevTime > longestSilence.to - longestSilence.from)) {
      longestSilence = { from: prevTime, to: m.time };
    }
    prevTime = m.time;

    const day = Math.floor(m.time / DAY);
    const hour = Math.floor((m.time - day * DAY) / 3600);
    const weekday = (((day + 3) % 7) + 7) % 7;
    heat[weekday * 24 + hour] = (heat[weekday * 24 + hour] ?? 0) + 1;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    const month = monthOf(m.time);
    perMonth.set(month, (perMonth.get(month) ?? 0) + 1);

    const p = people[m.sender];
    if (p) {
      p.messages++;
      if (hour < 5) p.night++;
      if (m.kind === 'file' || m.kind === 'omitted') p.media++;
      if (m.text && m.kind === 'text') p.words += m.text.split(/\s+/).filter(Boolean).length;
    }
    if (m.kind === 'file' || m.kind === 'omitted') media++;
    if (m.kind === 'deleted') deleted++;
    if (m.kind === 'poll') polls++;
    if (m.edited) edited++;
    if (m.text) {
      if (LINK.test(m.text)) links++;
      countEmojis(m.text, emojis);
    }
  }

  const days = [...perDay.keys()].sort((a, b) => a - b);
  let busiestDay: ChatStats['busiestDay'] = null;
  for (const [day, count] of perDay) {
    if (!busiestDay || count > busiestDay.count || (count === busiestDay.count && day < busiestDay.day)) busiestDay = { day, count };
  }

  let longestStreak: ChatStats['longestStreak'] = null;
  let runStart = days[0];
  for (let i = 0; i < days.length; i++) {
    const day = days[i] as number;
    if (i > 0 && day !== (days[i - 1] as number) + 1) runStart = day;
    const length = day - (runStart as number) + 1;
    if (!longestStreak || length > longestStreak.days) longestStreak = { start: runStart as number, days: length };
  }

  const months: ChatStats['months'] = [];
  if (messages) {
    for (let month = monthOf(first); month <= monthOf(last); month++) months.push({ month, count: perMonth.get(month) ?? 0 });
  }

  return {
    messages,
    first: messages ? first : 0,
    last: messages ? last : 0,
    activeDays: days.length,
    spanDays: messages ? Math.floor(last / DAY) - Math.floor(first / DAY) + 1 : 0,
    people: people.filter(p => p.messages > 0).sort((a, b) => b.messages - a.messages || a.person - b.person),
    heat,
    months,
    busiestDay,
    longestStreak,
    longestSilence,
    emojis: [...emojis.values()].sort((a, b) => b.count - a.count).slice(0, topEmojis),
    media,
    links,
    deleted,
    edited,
    polls,
  };
}
