import { baseName, type Chat } from '../core';

/**
 * Chats the user chose to keep, stored in the browser's private file system
 * for this site. Nothing here leaves the computer; clearing the browser's
 * site data removes it.
 */

const ROOT = 'chats';
const META = 'chat.json';

export interface SavedChat {
  id: string;
  title: string | null;
  messages: number;
  people: number;
  /** Wall-clock times of the first and last message, as in `Message.time`. */
  first: number;
  last: number;
  bytes: number;
  savedAt: number;
  /** Names in the store, which may be cleaned up. */
  files: string[];
  /** The names the export used, which messages refer to. */
  names?: string[];
}

export function libraryAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

async function root(): Promise<FileSystemDirectoryHandle> {
  const top = await navigator.storage.getDirectory();
  return top.getDirectoryHandle(ROOT, { create: true });
}

/** Same files, same id: picking an export twice does not store it twice. */
export function exportId(files: File[]): string {
  const key = files
    .map(f => `${baseName(f.name).normalize('NFC')}\u0000${f.size}`)
    .sort()
    .join('\u0001');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/** File names that are safe in the store and unique within one chat. */
export function storedNames(files: File[]): string[] {
  const used = new Set<string>();
  return files.map(f => {
    const clean = baseName(f.name).replace(/[\\/:*?"<>|\u0000-\u001f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '_').trim() || 'file';
    let name = clean;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const dot = clean.lastIndexOf('.');
      name = dot > 0 ? `${clean.slice(0, dot)} (${n})${clean.slice(dot)}` : `${clean} (${n})`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  if (typeof handle.createWritable === 'function') {
    const writable = await handle.createWritable();
    await data.stream().pipeTo(writable);
    return;
  }
  // Safari only writes from workers, through a synchronous handle.
  const access = await handle.createSyncAccessHandle();
  try {
    access.truncate(0);
    let at = 0;
    const reader = data.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      at += access.write(value, { at });
    }
    access.flush();
  } finally {
    access.close();
  }
}

async function readMeta(dir: FileSystemDirectoryHandle): Promise<SavedChat | null> {
  try {
    const file = await (await dir.getFileHandle(META)).getFile();
    return JSON.parse(await file.text()) as SavedChat;
  } catch {
    return null;
  }
}

export async function listSaved(): Promise<SavedChat[]> {
  if (!libraryAvailable()) return [];
  const out: SavedChat[] = [];
  try {
    const dir = await root();
    for await (const entry of dir.values()) {
      if (entry.kind !== 'directory') continue;
      const meta = await readMeta(entry as FileSystemDirectoryHandle);
      if (meta) out.push(meta);
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export async function removeSaved(id: string): Promise<void> {
  await (await root()).removeEntry(id, { recursive: true });
}

/** Copies the picked files into the store; the summary is written last, so a broken copy never lists. */
export async function saveExport(files: File[], chat: Chat): Promise<SavedChat> {
  const id = exportId(files);
  const dir = await (await root()).getDirectoryHandle(id, { create: true });
  const existing = await readMeta(dir);
  if (existing) return existing;
  const names = storedNames(files);
  for (let i = 0; i < files.length; i++) await writeFile(dir, names[i] as string, files[i] as File);
  const meta: SavedChat = {
    id,
    title: chat.title,
    messages: chat.messages.length,
    people: chat.people.length,
    first: chat.messages[0]?.time ?? 0,
    last: chat.messages[chat.messages.length - 1]?.time ?? 0,
    bytes: files.reduce((n, f) => n + f.size, 0),
    savedAt: Date.now(),
    files: names,
    names: files.map(f => baseName(f.name)),
  };
  await writeFile(dir, META, new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  return meta;
}

export async function loadSaved(id: string): Promise<File[]> {
  const dir = await (await root()).getDirectoryHandle(id);
  const meta = await readMeta(dir);
  if (!meta) throw new Error('missing');
  return Promise.all(
    meta.files.map(async (stored, i) => {
      const file = await (await dir.getFileHandle(stored)).getFile();
      const original = meta.names?.[i];
      return original && original !== stored ? new File([file], original, { type: file.type, lastModified: file.lastModified }) : file;
    }),
  );
}
