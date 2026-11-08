import { openAsBlob, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BlobReader, BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { describe, expect, it } from 'vitest';
import { chatCandidates, FileIndex } from '../src/core';
import { LoadError, openExport } from '../src/loader/open';
import { coldPath, fixture } from './helpers';

async function zip(name: string, entries: Record<string, string | Blob>): Promise<File> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false });
  for (const [path, data] of Object.entries(entries)) {
    await writer.add(path, typeof data === 'string' ? new TextReader(data) : new BlobReader(data));
  }
  return new File([await writer.close()], name);
}

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]);
const opus = () => new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53])]);

async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return err instanceof LoadError ? err.code : String(err);
  }
  return 'no error';
}

describe('chatCandidates', () => {
  it('puts the chat before other text files and skips archiver junk', () => {
    expect(
      chatCandidates([
        'notes.txt',
        '__MACOSX/._WhatsApp Chat with Hiking Club.txt',
        'WhatsApp Chat with Hiking Club.txt',
        'IMG-20251001-WA0001.jpg',
        'export/_chat.txt',
      ]),
    ).toEqual(['export/_chat.txt', 'WhatsApp Chat with Hiking Club.txt', 'notes.txt']);
  });
});

describe('FileIndex', () => {
  it('finds names stored decomposed or in another case', () => {
    const index = new FileIndex<number>();
    index.add('Media/Ödev Listesi.PDF'.normalize('NFD'), 1);
    index.add('İzmir.jpg', 2);
    expect(index.get('Ödev Listesi.PDF')).toBe(1);
    expect(index.get('ödev listesi.pdf')).toBe(1);
    expect(index.get('İzmir.jpg')).toBe(2);
    expect(index.get('Other.jpg')).toBeUndefined();
  });
});

describe('openExport', () => {
  const chatText = fixture('android-en.txt');

  it('opens an Android zip and reads attachments on demand', async () => {
    const file = await zip('WhatsApp Chat with Hiking Club.zip', {
      'WhatsApp Chat with Hiking Club.txt': chatText,
      'IMG-20251001-WA0001.jpg': jpeg(),
    });
    const opened = await openExport([file]);
    expect(opened.chat.title).toBe('Hiking Club');
    expect(opened.chat.messages).toHaveLength(24);
    expect(opened.found).toEqual(['IMG-20251001-WA0001.jpg']);
    expect(opened.missing).toEqual(['PTT-20251001-WA0002.opus']);

    const blob = await opened.read('IMG-20251001-WA0001.jpg');
    expect(blob?.type).toBe('image/jpeg');
    expect(blob?.size).toBe(4);
    expect(await opened.read('PTT-20251001-WA0002.opus')).toBeNull();
    await opened.close();
  });

  it('takes the title of an iOS export from the zip name', async () => {
    const file = await zip('WhatsApp Chat - Hiking Club.zip', {
      '_chat.txt': fixture('ios-en.txt'),
      '00000003-PHOTO-2025-10-01-20-17-30.jpg': jpeg(),
      '00000004-AUDIO-2025-10-01-20-18-00.opus': opus(),
    });
    const opened = await openExport([file]);
    expect(opened.chat.platform).toBe('ios');
    expect(opened.chat.title).toBe('Hiking Club');
    expect(opened.missing).toEqual([]);
    expect((await opened.read('00000004-AUDIO-2025-10-01-20-18-00.opus'))?.type).toBe('audio/ogg');
  });

  it('matches attachments whose names a Mac stored decomposed', async () => {
    const text = '01/10/2025, 20:30 - Ada: Ödev.pdf (file attached)\n';
    const file = await zip('chat.zip', { 'chat.txt': text, ['Ödev.pdf'.normalize('NFD')]: jpeg() });
    const opened = await openExport([file]);
    expect(opened.found).toEqual(['Ödev.pdf']);
  });

  it('opens a bare text export', async () => {
    const opened = await openExport([new File([chatText], 'WhatsApp Chat with Hiking Club.txt')]);
    expect(opened.chat.title).toBe('Hiking Club');
    expect(opened.found).toEqual([]);
    expect(opened.missing).toHaveLength(2);
  });

  it('opens a folder of loose files', async () => {
    const opened = await openExport([
      new File([jpeg()], 'IMG-20251001-WA0001.jpg'),
      new File([chatText], 'WhatsApp Chat with Hiking Club.txt'),
      new File([opus()], 'PTT-20251001-WA0002.opus'),
    ]);
    expect(opened.missing).toEqual([]);
    expect((await opened.read('PTT-20251001-WA0002.opus'))?.type).toBe('audio/ogg');
  });

  it('skips text files that are not the chat', async () => {
    const file = await zip('export.zip', { 'readme.txt': 'hello', 'chat.txt': chatText });
    expect((await openExport([file])).chat.messages).toHaveLength(24);
  });

  it('says what went wrong', async () => {
    expect(await failure(openExport([]))).toBe('empty');
    expect(await failure(openExport([new File([jpeg()], 'photo.jpg')]))).toBe('noChat');
    expect(await failure(openExport([new File(['hello'], 'notes.txt')]))).toBe('notAChat');
    expect(await failure(openExport([new File(['not a zip at all'], 'broken.zip')]))).toBe('badArchive');
  });
});

const dir = coldPath('');
const archives = dir ? readdirSync(dir).filter(f => f.toLowerCase().endsWith('.zip')) : [];

describe.skipIf(!archives.length)('real archives', () => {
  it.each(archives)('archive %# has every attachment it mentions', async name => {
    const blob = await openAsBlob(join(dir ?? '', name));
    const opened = await openExport([new File([blob], name)]);
    expect(opened.chat.messages.length).toBeGreaterThan(0);
    if (opened.found.length) {
      expect(opened.missing).toEqual([]);
      const first = await opened.read(opened.found[0] ?? '');
      expect(first?.size).toBeGreaterThan(0);
    }
    await opened.close();
  });
});

describe('several exports of one chat', () => {
  it('are joined into one timeline with attachments from all of them', async () => {
    const first = await zip('WhatsApp Chat with Hiking Club.zip', {
      'WhatsApp Chat with Hiking Club.txt': '01/10/2025, 20:00 - Ada: First\n01/10/2025, 20:17 - Elif: <Media omitted>\n',
    });
    const second = await zip('WhatsApp Chat with Hiking Club (1).zip', {
      'WhatsApp Chat with Hiking Club.txt':
        '01/10/2025, 20:17 - Elif: IMG-20251001-WA0001.jpg (file attached)\n02/10/2025, 09:00 - Ada: Later\n',
      'IMG-20251001-WA0001.jpg': jpeg(),
    });
    const opened = await openExport([first, second]);
    expect(opened.chat.messages.map(m => m.text ?? m.file)).toEqual(['First', 'IMG-20251001-WA0001.jpg', 'Later']);
    expect(opened.missing).toEqual([]);
    expect(opened.chat.title).toBe('Hiking Club');
  });

  it('are refused when they are different chats', async () => {
    const a = await zip('WhatsApp Chat with A.zip', { 'WhatsApp Chat with A.txt': '01/10/2025, 20:00 - Ada: hi\n' });
    const b = await zip('WhatsApp Chat with B.zip', { 'WhatsApp Chat with B.txt': '05/05/2024, 10:00 - Zoe: hey\n' });
    expect(await failure(openExport([a, b]))).toBe('differentChats');
  });
});
