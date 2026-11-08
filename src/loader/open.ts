import { BlobReader, BlobWriter, TextWriter, ZipReader, configure } from '@zip.js/zip.js/lib/zip-core-native.js';
import {
  LIMITS,
  type Limits,
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

export type LoadErrorCode = 'empty' | 'noChat' | 'notAChat' | 'badArchive' | 'tooLarge' | 'notSaved' | 'unknown';

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

function fileSource(file: File, limits: Limits): Source {
  const path = pathOf(file);
  return {
    path,
    text: async () => {
      if (file.size > limits.chatTextBytes) throw new LoadError('tooLarge');
      return file.text();
    },
    blob: async () => (file.type ? file : file.slice(0, file.size, mimeTypeFor(path))),
  };
}

async function looksLikeZip(file: File): Promise<boolean> {
  if (isZipName(file.name)) return true;
  if (extensionOf(file.name)) return false;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

async function zipSources(file: File, readers: ZipReader<unknown>[], limits: Limits): Promise<Source[]> {
  const reader = new ZipReader(new BlobReader(file));
  readers.push(reader);
  const entries = [];
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (entries.length >= limits.archiveEntries) throw new LoadError('tooLarge');
      entries.push(entry);
    }
  } catch (cause) {
    if (cause instanceof LoadError) throw cause;
    throw new LoadError('badArchive', { cause });
  }
  const out: Source[] = [];
  for (const entry of entries) {
    if (entry.directory) continue;
    const path = entry.filename;
    out.push({
      path,
      async text(progress) {
        // The size in the archive can lie, so the unpacked bytes are counted as they come.
        if (entry.uncompressedSize > limits.chatTextBytes) throw new LoadError('tooLarge');
        const stop = new AbortController();
        try {
          return await entry.getData(new TextWriter('utf-8'), {
            signal: stop.signal,
            onprogress: async (done, total) => {
              if (done > limits.chatTextBytes) stop.abort();
              progress?.(done, total);
            },
          });
        } catch (cause) {
          if (stop.signal.aborted) throw new LoadError('tooLarge', { cause });
          throw cause;
        }
      },
      blob: () => entry.getData(new BlobWriter(mimeTypeFor(path))),
    });
  }
  return out;
}

/**
 * Opens what the user picked: an exported .zip, a bare .txt, or a folder of
 * loose files. Attachments are not read until something asks for them.
 */
export async function openExport(files: File[], onProgress?: Progress, limits: Limits = LIMITS): Promise<OpenedExport> {
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
        sources.push(...(await zipSources(file, readers, limits)));
      } else {
        sources.push(fileSource(file, limits));
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
