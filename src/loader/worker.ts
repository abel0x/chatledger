import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js/lib/zip-core-native.js';
import { extensionOf } from '../core';
import { parseDocumentXml } from './docx';
import { libraryAvailable, loadSaved, saveExport } from './library';
import { LoadError, openExport, type OpenedExport } from './open';
import type { DocPreview, Thumbnail, WorkerRequest, WorkerResponse } from './protocol';
import { limit } from './limit';

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

// Decoding a dozen phone photos at once would eat memory; a few at a time is plenty.
const decoding = limit(3);

async function encode(canvas: OffscreenCanvas): Promise<Blob> {
  const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
  return webp.type === 'image/webp' ? webp : canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}

async function thumbnail(file: string, size: number): Promise<Thumbnail | null> {
  const blob = await opened?.read(file);
  if (!blob || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return null;
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  try {
    const scale = Math.min(1, size / Math.max(width, height));
    if (scale >= 1) return { blob, width, height };
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { blob: await encode(canvas), width, height };
  } finally {
    bitmap.close();
  }
}

const TEXT_FILES = new Set(['txt', 'vcf', 'csv', 'md', 'json', 'log']);
const TEXT_LIMIT = 1_000_000;

async function documentPreview(file: string): Promise<DocPreview | null> {
  const blob = await opened?.read(file);
  if (!blob) return null;
  const ext = extensionOf(file);
  if (ext === 'docx') {
    const reader = new ZipReader(new BlobReader(blob));
    try {
      const entry = (await reader.getEntries()).find(e => e.filename === 'word/document.xml');
      if (!entry || entry.directory) return null;
      return { kind: 'docx', blocks: parseDocumentXml(await entry.getData(new TextWriter('utf-8'))) };
    } finally {
      await reader.close();
    }
  }
  if (TEXT_FILES.has(ext)) {
    const cut = blob.size > TEXT_LIMIT;
    return { kind: 'text', text: await blob.slice(0, TEXT_LIMIT).text(), cut };
  }
  return null;
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
      return;
    }
    case 'thumb': {
      let thumb: Thumbnail | null = null;
      try {
        thumb = await decoding(() => thumbnail(req.file, req.size));
      } catch {
        thumb = null;
      }
      send({ type: 'thumb', id: req.id, thumb });
      return;
    }
    case 'doc': {
      let doc: DocPreview | null = null;
      try {
        doc = await documentPreview(req.file);
      } catch {
        doc = null;
      }
      send({ type: 'doc', id: req.id, doc });
    }
  }
}

addEventListener('message', (e: MessageEvent<WorkerRequest>) => void handle(e.data));
