import type { Chat, ChatStats } from '../core';
import type { SavedChat } from './library';
import type { LoadErrorCode, Phase } from './open';
import type { DocPreview, Thumbnail, WorkerRequest, WorkerResponse } from './protocol';

export type { DocPreview };

export interface Session {
  chat: Chat;
  /** Whether the export contains this attachment. */
  has(file: string): boolean;
  /** Number of attachments the messages mention but the export left out. */
  missing: number;
  /** Id in the library when the chat was opened from it. */
  savedId: string | null;
  /** Settles once a copy has been kept, or with null when none was made. */
  saved: Promise<SavedChat | null>;
  /** An object URL for the attachment, created on first use. */
  url(file: string): Promise<string | null>;
  /** A small copy of a picture for lists and bubbles; null when it cannot be made. */
  thumb(file: string): Promise<Thumb | null>;
  /** The attachment itself, for code that reads its bytes. */
  blob(file: string): Promise<Blob | null>;
  /** Text of a Word or plain-text attachment, prepared for preview. */
  doc(file: string): Promise<DocPreview | null>;
  /** Statistics, worked out in the worker so the page does not stall on long chats. */
  stats(): Promise<ChatStats | null>;
  close(): void;
}

export interface Thumb {
  /** Empty when the picture is too large to show; it is then never decoded. */
  url: string;
  width: number;
  height: number;
  tooLarge?: true;
}

/** Longest side of thumbnails; sharp at bubble size on high-density screens. */
const THUMB_SIZE = 720;

export class SessionError extends Error {
  constructor(
    readonly code: LoadErrorCode,
    readonly detail?: string,
  ) {
    super(code);
    this.name = 'SessionError';
  }
}

export type Source = { files: File[]; save: boolean } | { savedId: string };

/** Opens an export in a worker so the page stays responsive while it is read. */
export type { Phase };

export function openSession(source: Source, onProgress?: (phase: Phase, fraction: number) => void): Promise<Session> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const post = (req: WorkerRequest) => worker.postMessage(req);
  const pending = new Map<number, (blob: Blob | null) => void>();
  const pendingThumbs = new Map<number, (thumb: Thumbnail | null) => void>();
  const pendingDocs = new Map<number, (doc: DocPreview | null) => void>();
  const pendingStats = new Map<number, (stats: ChatStats | null) => void>();
  let statsCache: Promise<ChatStats | null> | null = null;
  const urls = new Map<string, Promise<string | null>>();
  const thumbs = new Map<string, Promise<Thumb | null>>();
  let nextId = 1;
  let closed = false;
  let settleSaved: (saved: SavedChat | null) => void = () => {};
  const saved = new Promise<SavedChat | null>(resolve => (settleSaved = resolve));
  if (!('files' in source) || !source.save) settleSaved(null);

  return new Promise<Session>((resolve, reject) => {
    worker.addEventListener('error', e => {
      e.preventDefault();
      worker.terminate();
      settleSaved(null);
      reject(new SessionError('unknown', e.message));
    });
    worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'failed':
          worker.terminate();
          settleSaved(null);
          reject(new SessionError(msg.code, msg.detail));
          return;
        case 'saved':
          settleSaved(msg.saved);
          return;
        case 'saveFailed':
          settleSaved(null);
          return;
        case 'progress':
          onProgress?.(msg.phase, msg.total ? msg.done / msg.total : 0);
          return;
        case 'stats':
          pendingStats.get(msg.id)?.(msg.stats);
          pendingStats.delete(msg.id);
          return;
        case 'read':
          pending.get(msg.id)?.(msg.blob);
          pending.delete(msg.id);
          return;
        case 'thumb':
          pendingThumbs.get(msg.id)?.(msg.thumb);
          pendingThumbs.delete(msg.id);
          return;
        case 'doc':
          pendingDocs.get(msg.id)?.(msg.doc);
          pendingDocs.delete(msg.id);
          return;
        case 'opened': {
          const found = new Set(msg.found);
          const blob = (file: string): Promise<Blob | null> => {
            if (closed || !found.has(file)) return Promise.resolve(null);
            const id = nextId++;
            const result = new Promise<Blob | null>(done => pending.set(id, done));
            post({ type: 'read', id, file });
            return result;
          };
          resolve({
            chat: msg.chat,
            missing: msg.missing.length,
            savedId: msg.savedId,
            saved,
            has: file => found.has(file),
            url(file) {
              if (closed || !found.has(file)) return Promise.resolve(null);
              let url = urls.get(file);
              if (!url) {
                url = blob(file).then(b => (b && !closed ? URL.createObjectURL(b) : null));
                urls.set(file, url);
              }
              return url;
            },
            blob,
            stats() {
              if (closed) return Promise.resolve(null);
              if (!statsCache) {
                const id = nextId++;
                statsCache = new Promise<ChatStats | null>(done => pendingStats.set(id, done));
                post({ type: 'stats', id });
              }
              return statsCache;
            },
            doc(file) {
              if (closed || !found.has(file)) return Promise.resolve(null);
              const id = nextId++;
              const doc = new Promise<DocPreview | null>(done => pendingDocs.set(id, done));
              post({ type: 'doc', id, file });
              return doc;
            },
            thumb(file) {
              if (closed || !found.has(file)) return Promise.resolve(null);
              let thumb = thumbs.get(file);
              if (!thumb) {
                const id = nextId++;
                thumb = new Promise<Thumbnail | null>(done => pendingThumbs.set(id, done)).then(t =>
                  !t || closed
                    ? null
                    : 'tooLarge' in t
                      ? { url: '', width: t.width, height: t.height, tooLarge: true as const }
                      : { url: URL.createObjectURL(t.blob), width: t.width, height: t.height },
                );
                thumbs.set(file, thumb);
                post({ type: 'thumb', id, file, size: THUMB_SIZE });
              }
              return thumb;
            },
            close() {
              if (closed) return;
              closed = true;
              worker.terminate();
              settleSaved(null);
              for (const done of pending.values()) done(null);
              for (const done of pendingThumbs.values()) done(null);
              for (const done of pendingDocs.values()) done(null);
              for (const done of pendingStats.values()) done(null);
              pendingStats.clear();
              pendingDocs.clear();
              pending.clear();
              pendingThumbs.clear();
              for (const url of urls.values()) void url.then(u => u && URL.revokeObjectURL(u));
              for (const thumb of thumbs.values()) void thumb.then(t => t?.url && URL.revokeObjectURL(t.url));
              urls.clear();
              thumbs.clear();
            },
          });
        }
      }
    });
    post('files' in source ? { type: 'open', files: source.files, save: source.save } : { type: 'openSaved', id: source.savedId });
  });
}
