import { BlobReader, BlobWriter, TextWriter, ZipReader, configure } from '@zip.js/zip.js/lib/zip-core-native.js';
import {
  baseName,
  LIMITS,
  type Limits,
  chatCandidates,
  extensionOf,
  DifferentChatsError,
  FileIndex,
  mergeChats,
  isZipName,
  mimeTypeFor,
  NotAChatError,
  parseChat,
  parseTelegramHtml,
  parseTelegramJson,
  telegramExports,
  WholeAccountError,
  type Chat,
} from '../core';

// This code already runs off the main thread; zip.js needs no workers of its own.
configure({ useWebWorkers: false });

export type LoadErrorCode =
  | 'empty'
  | 'noChat'
  | 'notAChat'
  | 'badArchive'
  | 'tooLarge'
  | 'differentChats'
  | 'wholeAccount'
  | 'notSaved'
  | 'unknown';

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
 * The Telegram Desktop exports among the files, if there are any; an empty
 * list lets the WhatsApp reader try.
 */
async function readTelegram(group: Source[], limits: Limits, onProgress?: Progress): Promise<{ chats: Chat[]; sources: Source[] }> {
  const paths = group.map(src => src.path);
  // An export of a whole account has an index page next to its chat folders.
  if (paths.some(p => baseName(p).toLowerCase() === 'export_results.html')) throw new LoadError('wholeAccount');
  // Loose files picked together can share a name, such as two result.json.
  const pool = new Map<string, Source[]>();
  for (const src of group) pool.set(src.path, [...(pool.get(src.path) ?? []), src]);
  const take = (path: string) => pool.get(path)?.shift() as Source;
  const chats: Chat[] = [];
  const sources: Source[] = [];
  const parse = (done: number, total: number) => onProgress?.('parse', done, total);
  for (const candidate of telegramExports(paths)) {
    try {
      if (candidate.format === 'json') {
        const source = take(candidate.path);
        const text = await source.text((done, total) => onProgress?.('unpack', done, total));
        chats.push(parseTelegramJson(text, { onProgress: parse }));
        sources.push(source);
        continue;
      }
      const pages: string[] = [];
      const read = candidate.paths.map(take);
      let bytes = 0;
      for (const [i, source] of read.entries()) {
        const page = await source.text();
        bytes += page.length;
        if (bytes > limits.chatTextBytes) throw new LoadError('tooLarge');
        pages.push(page);
        onProgress?.('unpack', i + 1, read.length);
      }
      chats.push(parseTelegramHtml(pages, { onProgress: parse }));
      sources.push(...read);
    } catch (err) {
      if (err instanceof WholeAccountError) throw new LoadError('wholeAccount', { cause: err });
      if (!(err instanceof NotAChatError)) throw err;
    }
  }
  return { chats, sources };
}

/**
 * Opens what the user picked: an exported .zip, a bare .txt, a Telegram
 * result.json or HTML pages, or a folder of loose files. Attachments are
 * not read until something asks for them.
 */
export async function openExport(files: File[], onProgress?: Progress, limits: Limits = LIMITS): Promise<OpenedExport> {
  if (!files.length) throw new LoadError('empty');
  const readers: ZipReader<unknown>[] = [];
  const close = async () => {
    await Promise.allSettled(readers.map(r => r.close()));
  };

  try {
    // Each archive is one export; loose files picked together make up another.
    const groups: { sources: Source[]; archive: string | null }[] = [];
    const loose: Source[] = [];
    for (const file of files) {
      if (await looksLikeZip(file)) groups.push({ sources: await zipSources(file, readers, limits), archive: file.name });
      else loose.push(fileSource(file, limits));
    }
    if (loose.length) groups.push({ sources: loose, archive: null });

    const archiveNames = groups.flatMap(g => (g.archive ? [g.archive] : []));
    const chats: Chat[] = [];
    const chatSources = new Set<Source>();
    let anyCandidate = false;
    for (const group of groups) {
      const byPath = new Map(group.sources.map(src => [src.path, src]));
      const paths = group.sources.map(src => src.path);
      const telegram = await readTelegram(group.sources, limits, onProgress);
      if (telegram.chats.length) {
        anyCandidate = true;
        chats.push(...telegram.chats);
        for (const src of telegram.sources) chatSources.add(src);
        continue;
      }
      for (const path of chatCandidates(paths)) {
        anyCandidate = true;
        const source = byPath.get(path) as Source;
        const text = await source.text((done, total) => onProgress?.('unpack', done, total));
        try {
          chats.push(
            parseChat(text, {
              fileName: group.archive ? [path, group.archive] : [path, ...archiveNames],
              onProgress: (done, total) => onProgress?.('parse', done, total),
            }),
          );
          chatSources.add(source);
          break;
        } catch (err) {
          if (!(err instanceof NotAChatError)) throw err;
        }
      }
    }
    if (!anyCandidate) throw new LoadError('noChat');
    if (!chats.length) throw new LoadError('notAChat');

    let chat: Chat;
    try {
      chat = mergeChats(chats);
    } catch (cause) {
      if (cause instanceof DifferentChatsError) throw new LoadError('differentChats', { cause });
      throw cause;
    }

    // Attachments may come from any of the exports.
    const index = new FileIndex<Source>();
    for (const group of groups) for (const src of group.sources) if (!chatSources.has(src)) index.add(src.path, src);

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
