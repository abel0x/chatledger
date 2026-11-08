import { BlobReader, BlobWriter, TextWriter, ZipReader, configure } from '@zip.js/zip.js/lib/zip-core-native.js';
import {
  chatCandidates,
  extensionOf,
  FileIndex,
  isZipName,
  mimeTypeFor,
  NotAChatError,
  parseChat,
  type Chat,
} from '../core';

// This code already runs off the main thread; zip.js needs no workers of its own.
configure({ useWebWorkers: false });

export type LoadErrorCode = 'empty' | 'noChat' | 'notAChat' | 'badArchive' | 'notSaved' | 'unknown';

export class LoadError extends Error {
  constructor(
    readonly code: LoadErrorCode,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'LoadError';
  }
}

export type Phase = 'unpack' | 'parse';
export type Progress = (phase: Phase, done: number, total: number) => void;

interface Source {
  path: string;
  text(progress?: (done: number, total: number) => void): Promise<string>;
  blob(): Promise<Blob>;
}

export interface OpenedExport {
  chat: Chat;
  /** Attachment names the messages mention and the export really contains. */
  found: string[];
  /** Attachment names the messages mention but the export left out. */
  missing: string[];
  read(file: string): Promise<Blob | null>;
  close(): Promise<void>;
}

function pathOf(file: File): string {
  return file.webkitRelativePath || file.name;
}

function fileSource(file: File): Source {
  const path = pathOf(file);
  return {
    path,
    text: () => file.text(),
    blob: async () => (file.type ? file : file.slice(0, file.size, mimeTypeFor(path))),
  };
}

async function looksLikeZip(file: File): Promise<boolean> {
  if (isZipName(file.name)) return true;
  if (extensionOf(file.name)) return false;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

async function zipSources(file: File, readers: ZipReader<unknown>[]): Promise<Source[]> {
  const reader = new ZipReader(new BlobReader(file));
  readers.push(reader);
  let entries;
  try {
    entries = await reader.getEntries();
  } catch (cause) {
    throw new LoadError('badArchive', { cause });
  }
  const out: Source[] = [];
  for (const entry of entries) {
    if (entry.directory) continue;
    const path = entry.filename;
    out.push({
      path,
      text: progress =>
        entry.getData(new TextWriter('utf-8'), {
          onprogress: async (done, total) => progress?.(done, total),
        }),
      blob: () => entry.getData(new BlobWriter(mimeTypeFor(path))),
    });
  }
  return out;
}

/**
 * Opens what the user picked: an exported .zip, a bare .txt, or a folder of
 * loose files. Attachments are not read until something asks for them.
 */
export async function openExport(files: File[], onProgress?: Progress): Promise<OpenedExport> {
  if (!files.length) throw new LoadError('empty');
  const readers: ZipReader<unknown>[] = [];
  const close = async () => {
    await Promise.allSettled(readers.map(r => r.close()));
  };

  try {
    const sources: Source[] = [];
    const archiveNames: string[] = [];
    for (const file of files) {
      if (await looksLikeZip(file)) {
        archiveNames.push(file.name);
        sources.push(...(await zipSources(file, readers)));
      } else {
        sources.push(fileSource(file));
      }
    }

    const byPath = new Map(sources.map(s => [s.path, s]));
    const candidates = chatCandidates(sources.map(s => s.path));
    if (!candidates.length) throw new LoadError('noChat');

    let chat: Chat | null = null;
    let chatPath = '';
    for (const path of candidates) {
      const text = await (byPath.get(path) as Source).text((done, total) => onProgress?.('unpack', done, total));
      try {
        chat = parseChat(text, {
          fileName: [path, ...archiveNames],
          onProgress: (done, total) => onProgress?.('parse', done, total),
        });
        chatPath = path;
        break;
      } catch (err) {
        if (!(err instanceof NotAChatError)) throw err;
      }
    }
    if (!chat) throw new LoadError('notAChat');

    const index = new FileIndex<Source>();
    for (const s of sources) if (s.path !== chatPath) index.add(s.path, s);

    const found = new Set<string>();
    const missing = new Set<string>();
    for (const m of chat.messages) {
      if (!m.file) continue;
      (index.get(m.file) ? found : missing).add(m.file);
    }

    return {
      chat,
      found: [...found],
      missing: [...missing],
      read: async file => (await index.get(file)?.blob()) ?? null,
      close,
    };
  } catch (err) {
    await close();
    if (err instanceof LoadError) throw err;
    throw new LoadError('unknown', { cause: err });
  }
}
