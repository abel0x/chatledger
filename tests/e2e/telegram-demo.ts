import { landscape } from './png';

/**
 * A made-up Telegram group, exported the way Telegram Desktop writes
 * result.json, for the README pictures and browser tests. Nothing in it is real.
 */
export const TELEGRAM_TITLE = 'Book Club';

const PEOPLE = {
  zeynep: ['Zeynep Arslan', 'user201'],
  jonas: ['Jonas Weber', 'user202'],
  lucia: ['Lucía Ortega', 'user203'],
  marc: ['Marc Dubois', 'user204'],
} as const;

type Who = keyof typeof PEOPLE;
type Part = string | { type: string; text: string; href?: string };

const START = Date.UTC(2025, 8, 12, 18, 30) / 1000;

function stamp(minutes: number) {
  const unix = START + minutes * 60;
  return { date: new Date(unix * 1000).toISOString().slice(0, 19), date_unixtime: String(unix) };
}

function entities(parts: Part[]) {
  return parts.map(p => (typeof p === 'string' ? { type: 'plain', text: p } : p));
}

let nextId = 1;

function say(minutes: number, who: Who, parts: Part[], extra: Record<string, unknown> = {}) {
  const [from, from_id] = PEOPLE[who];
  const text = parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
  return { id: nextId++, type: 'message', ...stamp(minutes), from, from_id, ...extra, text, text_entities: entities(parts) };
}

export const TELEGRAM_PHOTO = 'photo_1@12-09-2025_19-02-00.jpg';

export function buildTelegramDemo(): { json: Buffer; photo: Buffer } {
  nextId = 1;
  const [creator, creatorId] = PEOPLE.zeynep;
  const messages = [
    {
      id: nextId++,
      type: 'service',
      ...stamp(0),
      actor: creator,
      actor_id: creatorId,
      action: 'create_group',
      title: TELEGRAM_TITLE,
      members: [PEOPLE.jonas[0], PEOPLE.lucia[0], PEOPLE.marc[0]],
      text: '',
      text_entities: [],
    },
    say(2, 'zeynep', ['Welcome! This month we read ', { type: 'bold', text: 'The Long Way Home' }, '. We meet on Friday at 19:00.'], {
      reactions: [{ type: 'emoji', count: 3, emoji: '👍' }],
    }),
    say(5, 'jonas', ['Great choice, I started it yesterday']),
    say(6, 'lucia', ['Same here. The first chapter is so quiet and so good'], { reply_to_message_id: 3 }),
    say(9, 'marc', ['Do we have a list of the questions for Friday?']),
    say(11, 'zeynep', ['Here they are: ', { type: 'link', text: 'https://example.org/book-club/questions' }]),
    say(14, 'jonas', [{ type: 'italic', text: 'New edition out next month' }, ' with a short interview at the end.'], {
      forwarded_from: 'Town Library',
    }),
    say(15, 'lucia', ['Oh nice, I will ask them to keep a copy for us'], { reactions: [{ type: 'emoji', count: 2, emoji: '❤' }] }),
    say(32, 'marc', ['My reading spot this week'], {
      photo: `photos/${TELEGRAM_PHOTO}`,
      photo_file_size: 2048,
      width: 960,
      height: 640,
    }),
    say(33, 'zeynep', ['Looks perfect ☕']),
    say(40, 'lucia', ['Careful with chapter 9, ', { type: 'spoiler', text: 'the letter changes everything' }]),
    say(41, 'jonas', ['No spoilers please 😅'], { reply_to_message_id: 11 }),
    say(43, 'marc', ['I will bake something for Friday 🍪'], { reactions: [{ type: 'emoji', count: 4, emoji: '🔥' }] }),
    say(44, 'zeynep', ['See you all on Friday!']),
  ];
  const json = { name: TELEGRAM_TITLE, type: 'private_group', id: 1700000201, messages };
  return { json: Buffer.from(JSON.stringify(json, null, 1)), photo: landscape(3) };
}
