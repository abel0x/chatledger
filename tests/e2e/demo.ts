import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { landscape } from './png';

/**
 * A made-up group chat with made-up people, used for browser tests and for
 * the screenshots in the README. It never contains anything real.
 */
export const DEMO_TITLE = 'Weekend Hikers';
export const DEMO_FILE = `WhatsApp Chat with ${DEMO_TITLE}.zip`;

const PEOPLE = ['Ada Yılmaz', 'Mert Aydın', 'Elif Şahin', 'Can Öztürk', 'Deniz Kaya', 'Selin Arslan'];
const SELF = 'Ada Yılmaz';

const CHATTER = [
  'Who is in for Saturday?',
  'Me! What time do we leave?',
  'Let’s meet at the station at 8 😊',
  'Bring water, it will be hot ☀️',
  'Does anyone have a spare headlamp?',
  'I can bring one',
  'The forecast says clear skies all weekend 🙌',
  'Last time we got lost near the lake 😂',
  'That was the best trip though',
  'I will bake something for the summit 🍪',
  'Should we try the northern trail this time?',
  'It is longer but the view is worth it',
  'Count me in 👍',
  'Running 10 minutes late, sorry!',
  'Look at this sunrise',
  'Who took the group photo? Send it please 📸',
  'My legs still hurt from last week 😅',
  'Next month: two days with a night in the hut?',
  'Yes please! I will check if they have beds',
  'Booked for six people ✅',
];

const pad = (n: number) => String(n).padStart(2, '0');

function line(time: number, text: string, from?: string): string {
  const d = new Date(time * 1000);
  const head = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} - `;
  return head + (from ? `${from}: ${text}` : text);
}

export interface Demo {
  name: string;
  buffer: Buffer;
  images: string[];
}

export async function buildDemo(): Promise<Demo> {
  const lines: string[] = [];
  const images: string[] = [];
  let time = Date.UTC(2025, 3, 5, 18, 2) / 1000;
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  lines.push(line(time, 'Deniz Kaya created group "Weekend Plans"'));
  lines.push(line(time, 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.'));
  lines.push(line((time += 60), 'Deniz Kaya added you, Mert Aydın, Elif Şahin, Can Öztürk and Selin Arslan'));
  lines.push(line((time += 120), 'You deleted this message', SELF));

  for (let day = 0; day < 210; day++) {
    if (random() < 0.55) continue;
    let t = Date.UTC(2025, 3, 6 + day, 7 + Math.floor(random() * 4)) / 1000;
    const count = 1 + Math.floor(random() * (day % 7 === 4 ? 14 : 6));
    for (let k = 0; k < count; k++) {
      t += 60 * (2 + Math.floor(random() * (k % 3 === 0 ? 240 : 25)));
      const from = PEOPLE[Math.floor(random() * PEOPLE.length)] as string;
      if (random() < 0.06 && images.length < 18) {
        const d = new Date(t * 1000);
        const file = `IMG-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-WA${pad(images.length + 1).padStart(4, '0')}.png`;
        images.push(file);
        lines.push(line(t, `${file} (file attached)\n${random() < 0.5 ? 'View from the top' : ''}`.trimEnd(), from));
      } else {
        lines.push(line(t, CHATTER[Math.floor(random() * CHATTER.length)] as string, from));
      }
    }
    time = t;
  }

  time += 3600;
  lines.push(line(time, 'POLL:\nWhere should we go next?\nOPTION: Mountain hut (4 votes)\nOPTION: Lake loop (2 votes)\nOPTION: Coast path (1 vote)', 'Elif Şahin'));
  lines.push(line((time += 120), 'Trip plan.pdf (file attached)', 'Mert Aydın'));
  lines.push(line((time += 300), 'Route notes are here: https://example.org/trails/north-ridge', 'Can Öztürk'));
  lines.push(line((time += 600), 'Deniz Kaya changed the group name from "Weekend Plans" to "Weekend Hikers"'));
  lines.push(line((time += 60), 'This message was deleted', 'Selin Arslan'));
  lines.push(line((time += 60), 'See you all on Saturday 🥾', SELF));

  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await zip.add(`WhatsApp Chat with ${DEMO_TITLE}.txt`, new TextReader(`${lines.join('\n')}\n`));
  for (const [i, file] of images.entries()) await zip.add(file, new Uint8ArrayReader(landscape(i)));
  await zip.add('Trip plan.pdf', new TextReader(MINIMAL_PDF));
  return { name: DEMO_FILE, buffer: Buffer.from(await zip.close()), images };
}

const MINIMAL_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;
