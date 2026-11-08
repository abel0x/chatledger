import type { Chat } from '../core';
import type { LoadErrorCode } from './open';
import type { WorkerRequest, WorkerResponse } from './protocol';

export interface Session {
  chat: Chat;
  /** Whether the export contains this attachment. */
  has(file: string): boolean;
  /** Number of attachments the messages mention but the export left out. */
  missing: number;
  /** An object URL for the attachment, created on first use. */
  url(file: string): Promise<string | null>;
  close(): void;
}

export class SessionError extends Error {
  constructor(
    readonly code: LoadErrorCode,
    readonly detail?: string,
  ) {
    super(code);
    this.name = 'SessionError';
  }
}

/** Opens an export in a worker so the page stays responsive while it is read. */
export function openSession(files: File[]): Promise<Session> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const post = (req: WorkerRequest) => worker.postMessage(req);
  const pending = new Map<number, (blob: Blob | null) => void>();
  const urls = new Map<string, Promise<string | null>>();
  let nextId = 1;
  let closed = false;

  return new Promise<Session>((resolve, reject) => {
    worker.addEventListener('error', e => {
      e.preventDefault();
      worker.terminate();
      reject(new SessionError('unknown', e.message));
    });
    worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'failed') {
        worker.terminate();
        reject(new SessionError(msg.code, msg.detail));
      } else if (msg.type === 'read') {
        pending.get(msg.id)?.(msg.blob);
        pending.delete(msg.id);
      } else {
        const found = new Set(msg.found);
        resolve({
          chat: msg.chat,
          missing: msg.missing.length,
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
          close() {
            if (closed) return;
            closed = true;
            worker.terminate();
            for (const done of pending.values()) done(null);
            pending.clear();
            for (const url of urls.values()) void url.then(u => u && URL.revokeObjectURL(u));
            urls.clear();
          },
        });
      }
    });
    post({ type: 'open', files });
  });
}
