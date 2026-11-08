import type { Chat } from '../core';
import type { SavedChat } from './library';
import type { LoadErrorCode } from './open';
import type { Thumbnail, WorkerRequest, WorkerResponse } from './protocol';

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
  close(): void;
}

export interface Thumb {
  url: string;
  width: number;
  height: number;
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
export function openSession(source: Source): Promise<Session> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const post = (req: WorkerRequest) => worker.postMessage(req);
  const pending = new Map<number, (blob: Blob | null) => void>();
  const pendingThumbs = new Map<number, (thumb: Thumbnail | null) => void>();
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
        case 'read':
          pending.get(msg.id)?.(msg.blob);
          pending.delete(msg.id);
          return;
        case 'thumb':
          pendingThumbs.get(msg.id)?.(msg.thumb);
          pendingThumbs.delete(msg.id);
          return;
        case 'opened': {
          const found = new Set(msg.found);
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
                const id = nextId++;
                url = new Promise<Blob | null>(done => pending.set(id, done)).then(blob =>
                  blob && !closed ? URL.createObjectURL(blob) : null,
                );
                urls.set(file, url);
                post({ type: 'read', id, file });
              }
              return url;
            },
            thumb(file) {
              if (closed || !found.has(file)) return Promise.resolve(null);
              let thumb = thumbs.get(file);
              if (!thumb) {
                const id = nextId++;
                thumb = new Promise<Thumbnail | null>(done => pendingThumbs.set(id, done)).then(t =>
                  t && !closed ? { url: URL.createObjectURL(t.blob), width: t.width, height: t.height } : null,
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
              pending.clear();
              pendingThumbs.clear();
              for (const url of urls.values()) void url.then(u => u && URL.revokeObjectURL(u));
              for (const thumb of thumbs.values()) void thumb.then(t => t && URL.revokeObjectURL(t.url));
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
