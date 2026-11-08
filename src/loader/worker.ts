import { libraryAvailable, loadSaved, saveExport } from './library';
import { LoadError, openExport, type OpenedExport } from './open';
import type { WorkerRequest, WorkerResponse } from './protocol';

let opened: OpenedExport | null = null;

function send(message: WorkerResponse): void {
  postMessage(message);
}

function message(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}

async function open(files: File[], savedId: string | null, save: boolean): Promise<void> {
  try {
    await opened?.close();
    opened = await openExport(files);
  } catch (err) {
    const code = err instanceof LoadError ? err.code : 'unknown';
    send({ type: 'failed', code, detail: message(err instanceof LoadError ? err.cause : err) });
    return;
  }
  const { chat, found, missing } = opened;
  send({ type: 'opened', chat, found, missing, savedId });
  if (!save || !libraryAvailable()) return;
  try {
    send({ type: 'saved', saved: await saveExport(files, chat) });
  } catch (err) {
    send({ type: 'saveFailed', detail: message(err) });
  }
}

async function handle(req: WorkerRequest): Promise<void> {
  switch (req.type) {
    case 'open':
      return open(req.files, null, req.save);
    case 'openSaved': {
      let files: File[];
      try {
        files = await loadSaved(req.id);
      } catch (err) {
        send({ type: 'failed', code: 'notSaved', detail: message(err) });
        return;
      }
      return open(files, req.id, false);
    }
    case 'read': {
      let blob: Blob | null = null;
      try {
        blob = (await opened?.read(req.file)) ?? null;
      } catch {
        blob = null;
      }
      send({ type: 'read', id: req.id, blob });
    }
  }
}

addEventListener('message', (e: MessageEvent<WorkerRequest>) => void handle(e.data));
