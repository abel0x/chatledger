import { LoadError, openExport, type OpenedExport } from './open';
import type { WorkerRequest, WorkerResponse } from './protocol';

let opened: OpenedExport | null = null;

function send(message: WorkerResponse): void {
  postMessage(message);
}

async function handle(req: WorkerRequest): Promise<void> {
  if (req.type === 'open') {
    try {
      await opened?.close();
      opened = await openExport(req.files);
      const { chat, found, missing } = opened;
      send({ type: 'opened', chat, found, missing });
    } catch (err) {
      const code = err instanceof LoadError ? err.code : 'unknown';
      const cause = err instanceof LoadError ? err.cause : err;
      send({ type: 'failed', code, detail: cause instanceof Error ? cause.message : undefined });
    }
    return;
  }
  let blob: Blob | null = null;
  try {
    blob = (await opened?.read(req.file)) ?? null;
  } catch {
    blob = null;
  }
  send({ type: 'read', id: req.id, blob });
}

addEventListener('message', (e: MessageEvent<WorkerRequest>) => void handle(e.data));
