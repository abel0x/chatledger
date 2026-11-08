import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { describe, expect, it } from 'vitest';
import { isRiskyFile, LIMITS, mimeTypeFor, parseChat, safeFileName } from '../src/core';
import { LoadError, openExport } from '../src/loader/open';
import { parseStyles, richText } from '../src/ui/richtext';

async function zip(name: string, entries: Record<string, string>): Promise<File> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false });
  for (const [path, text] of Object.entries(entries)) await writer.add(path, new TextReader(text));
  return new File([await writer.close()], name);
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'opened';
  } catch (err) {
    return err instanceof LoadError ? err.code : String(err);
  }
}

const chat = '01/10/2025, 20:30 - Ada: hi\n';

describe('oversized exports', () => {
  it('refuses a chat text above the limit, packed or bare', async () => {
    const small = { ...LIMITS, chatTextBytes: 1000 };
    const big = chat.repeat(100);
    expect(await code(openExport([new File([big], 'chat.txt')], undefined, small))).toBe('tooLarge');
    expect(await code(openExport([await zip('a.zip', { 'chat.txt': big })], undefined, small))).toBe('tooLarge');
    expect(await code(openExport([await zip('a.zip', { 'chat.txt': chat })], undefined, small))).toBe('opened');
  });

  it('refuses archives with too many files', async () => {
    const entries = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}.txt`, 'x']));
    expect(await code(openExport([await zip('a.zip', { ...entries, 'chat.txt': chat })], undefined, { ...LIMITS, archiveEntries: 10 }))).toBe(
      'tooLarge',
    );
  });
});

describe('file names', () => {
  it('lose the hidden marks that disguise an extension', () => {
    const spoofed = 'invoice\u202Efdp.exe';
    expect(safeFileName(spoofed)).toBe('invoicefdp.exe');
    expect(safeFileName('a\u0000b\u2066c.pdf')).toBe('abc.pdf');
    expect(safeFileName('folder/\u200F')).toBe('file');
  });

  it('tell which files can run code', () => {
    for (const name of ['setup.exe', 'invoice\u202Efdp.exe', 'report.pdf.bat', 'app.apk', 'macro.docm', 'page.html', 'icon.svg']) {
      expect(isRiskyFile(name), name).toBe(true);
    }
    for (const name of ['photo.jpg', 'notes.pdf', 'voice.opus', 'list.docx', 'README']) expect(isRiskyFile(name), name).toBe(false);
  });

  it('never give a page-like type to attachments, so they cannot run in the app', () => {
    for (const name of ['a.html', 'a.htm', 'a.svg', 'a.xhtml', 'a.xml', 'a.js', 'a.mjs']) {
      expect(mimeTypeFor(name), name).toBe('application/octet-stream');
    }
  });
});

describe('crafted messages', () => {
  const quick = (fn: () => unknown) => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  };

  it('do not make formatting run away', () => {
    const marks = '(*a '.repeat(5000);
    expect(quick(() => parseStyles(marks))).toBeLessThan(500);
    expect(quick(() => richText(`${'_x '.repeat(4000)}${'@'.repeat(20000)}`, ['Ada', 'Mert']))).toBeLessThan(500);
    expect(parseStyles('*'.repeat(LIMITS.styledTextChars + 1))).toHaveLength(1);
  });

  it('do not make event patterns run away', () => {
    const long = `01/10/2025, 20:30 - ${'Ada, '.repeat(20000)}added Mert`;
    const quotes = `01/10/2025, 20:31 - Ada changed the group name from "${'a "'.repeat(5000)}" to "b"`;
    let parsed: ReturnType<typeof parseChat> | undefined;
    expect(quick(() => (parsed = parseChat(`${long}\n${quotes}\n${chat}`)))).toBeLessThan(1000);
    expect(parsed?.messages).toHaveLength(3);
  });
});
