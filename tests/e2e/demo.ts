import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { landscape, png } from './png';

/**
 * A made-up group chat with made-up people, used for browser tests and for
 * the screenshots in the README. It never contains anything real.
 */
export const DEMO_TITLE = 'Weekend Hikers';
export const DEMO_FILE = `WhatsApp Chat with ${DEMO_TITLE}.zip`;
/** A program whose name uses a hidden right-to-left mark to pass for a PDF. */
export const SPOOFED = 'invoice\u202Efdp.exe';

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
  lines.push(line(time, '*Plan for Saturday*: meet at _8:00_ ~or 9~ at the station, bring `water`', 'Deniz Kaya'));
  lines.push(line((time += 60), '@\u2068Mert Aydın\u2069 can you bring the map?', 'Elif Şahin'));
  lines.push(line((time += 60), '🥾⛰️', 'Can Öztürk'));
  lines.push(line((time += 60), 'PTT-20251101-WA0100.wav (file attached)', 'Mert Aydın'));
  lines.push(line((time += 60), 'STK-20251101-WA0101.png (file attached)', 'Selin Arslan'));
  lines.push(line((time += 60), 'Packing list.docx (file attached)', 'Ada Yılmaz'));
  lines.push(line((time += 60), `${SPOOFED} (file attached)`, 'Deniz Kaya'));
  lines.push(line((time += 3600), 'POLL:\nWhere should we go next?\nOPTION: Mountain hut (4 votes)\nOPTION: Lake loop (2 votes)\nOPTION: Coast path (1 vote)', 'Elif Şahin'));
  lines.push(line((time += 120), 'Trip plan.pdf (file attached)', 'Mert Aydın'));
  lines.push(line((time += 300), 'Route notes are here: https://example.org/trails/north-ridge', 'Can Öztürk'));
  lines.push(line((time += 600), 'Deniz Kaya changed the group name from "Weekend Plans" to "Weekend Hikers"'));
  lines.push(line((time += 60), 'This message was deleted', 'Selin Arslan'));
  lines.push(line((time += 60), 'See you all on Saturday 🥾', SELF));

  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await zip.add(`WhatsApp Chat with ${DEMO_TITLE}.txt`, new TextReader(`${lines.join('\n')}\n`));
  for (const [i, file] of images.entries()) await zip.add(file, new Uint8ArrayReader(landscape(i)));
  await zip.add('Trip plan.pdf', new TextReader(MINIMAL_PDF));
  await zip.add('PTT-20251101-WA0100.wav', new Uint8ArrayReader(tone()));
  await zip.add('STK-20251101-WA0101.png', new Uint8ArrayReader(sticker()));
  await zip.add('Packing list.docx', new Uint8ArrayReader(await docx()));
  await zip.add(SPOOFED, new TextReader('MZ not a real program'));
  return { name: DEMO_FILE, buffer: Buffer.from(await zip.close()), images };
}

const MINIMAL_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 52>>stream
BT /F1 24 Tf 30 60 Td (Trip plan: north ridge) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;

/** A second and a half of a soft tone, as a WAV file every browser plays. */
function tone(): Uint8Array {
  const rate = 8000;
  const samples = Math.round(rate * 1.5);
  const out = Buffer.alloc(44 + samples * 2);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + samples * 2, 4);
  out.write('WAVEfmt ', 8, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) out.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 6000), 44 + i * 2);
  return out;
}

/** A round sticker face. */
function sticker(): Uint8Array {
  return png(160, 160, (x, y) => {
    const d = Math.hypot(x - 80, y - 80);
    if (d > 70) return [255, 255, 255];
    if (Math.hypot(x - 55, y - 62) < 9 || Math.hypot(x - 105, y - 62) < 9) return [40, 40, 40];
    if (d > 35 && d < 45 && y > 85) return [40, 40, 40];
    return [255, 205, 60];
  });
}

/** The smallest Word document that Word and chatledger both open. */
async function docx(): Promise<Uint8Array> {
  const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document ${w}><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Packing list</w:t></w:r></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Water, two litres</w:t></w:r></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Rain jacket</w:t></w:r></w:p></w:body></w:document>`,
  };
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  for (const [path, text] of Object.entries(files)) await zip.add(path, new TextReader(text));
  return zip.close();
}
